import { readFile } from "node:fs/promises";
import { Lang, parse as astParse, type SgNode } from "@ast-grep/napi";
import type { ScannedFile } from "./scanner.js";

export interface ParsedFile {
  path: string;
  imports: ImportInfo[];
  exports: string[];
  functions: string[];
  classes: string[];
  loc: number;
  complexity: number;
  jsdoc: string[];
  typeExports: string[];
  hasDefaultExport: boolean;
  topLevelStatements: number;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

const EXT_TO_LANG: Record<string, Lang> = {
  ".ts": Lang.TypeScript,
  ".tsx": Lang.Tsx,
  ".js": Lang.JavaScript,
  ".jsx": Lang.JavaScript,
  ".mjs": Lang.JavaScript,
  ".cjs": Lang.JavaScript,
};

export async function parseFile(file: ScannedFile): Promise<ParsedFile> {
  const lang = EXT_TO_LANG[file.extension];
  if (!lang) {
    return {
      path: file.path,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      loc: 0,
      complexity: 0,
      jsdoc: [],
      typeExports: [],
      hasDefaultExport: false,
      topLevelStatements: 0,
    };
  }

  const content = await readFile(file.absolutePath, "utf-8");
  const loc = content.split("\n").length;
  const tree = astParse(lang, content);
  const root = tree.root();

  const imports = extractImports(root, lang);
  const exports = extractExports(root, lang);
  const functions = extractFunctions(root, lang);
  const classes = extractClasses(root, lang);
  const complexity = extractComplexity(root, lang);
  const jsdoc = extractJSDoc(root, lang);
  const typeExports = extractTypeExports(root, lang);
  const hasDefaultExport = checkDefaultExport(root, lang);
  const topLevelStatements = countTopLevelStatements(root, lang);

  return {
    path: file.path,
    imports,
    exports,
    functions,
    classes,
    loc,
    complexity,
    jsdoc,
    typeExports,
    hasDefaultExport,
    topLevelStatements,
  };
}

function extractImports(root: SgNode, lang: Lang): ImportInfo[] {
  const imports: ImportInfo[] = [];

  if (lang === Lang.TypeScript || lang === Lang.Tsx || lang === Lang.JavaScript) {
    // Match: import { X } from 'source'
    const importNodes = root.findAll({
      rule: { kind: "import_statement" },
    });

    for (const node of importNodes) {
      const sourceNode = node.find({ rule: { kind: "string" } });
      if (!sourceNode) continue;

      const source = sourceNode.text().replace(/['"]/g, "");
      const specifiers: string[] = [];

      const namedImports = node.findAll({ rule: { kind: "import_specifier" } });
      for (const spec of namedImports) {
        specifiers.push(spec.text());
      }

      // Default import
      const identifier = node.find({ rule: { kind: "identifier" } });
      if (identifier && !specifiers.includes(identifier.text())) {
        const text = identifier.text();
        if (text !== "type") specifiers.push(text);
      }

      imports.push({
        source,
        specifiers,
        isRelative: source.startsWith(".") || source.startsWith("/"),
      });
    }
  }

  return imports;
}

function extractExports(root: SgNode, lang: Lang): string[] {
  const exports: string[] = [];

  if (lang === Lang.TypeScript || lang === Lang.Tsx || lang === Lang.JavaScript) {
    // Named exports: export function X, export const X, export class X
    const exportStatements = root.findAll({
      rule: { kind: "export_statement" },
    });

    for (const node of exportStatements) {
      // export function name
      const funcDecl = node.find({ rule: { kind: "function_declaration" } });
      if (funcDecl) {
        const name = funcDecl.find({ rule: { kind: "identifier" } });
        if (name) exports.push(name.text());
        continue;
      }

      // export class name
      const classDecl = node.find({ rule: { kind: "class_declaration" } });
      if (classDecl) {
        const name = classDecl.find({ rule: { kind: "type_identifier" } });
        if (name) exports.push(name.text());
        continue;
      }

      // export const/let/var name
      const varDecl = node.find({ rule: { kind: "variable_declarator" } });
      if (varDecl) {
        const name = varDecl.find({ rule: { kind: "identifier" } });
        if (name) exports.push(name.text());
        continue;
      }

      // export interface/type
      const typeDecl = node.find({ rule: { kind: "interface_declaration" } });
      if (typeDecl) {
        const name = typeDecl.find({ rule: { kind: "type_identifier" } });
        if (name) exports.push(name.text());
        continue;
      }

      const typeAlias = node.find({ rule: { kind: "type_alias_declaration" } });
      if (typeAlias) {
        const name = typeAlias.find({ rule: { kind: "type_identifier" } });
        if (name) exports.push(name.text());
      }
    }
  }

  return exports;
}

function extractFunctions(root: SgNode, lang: Lang): string[] {
  const functions: string[] = [];

  if (lang === Lang.TypeScript || lang === Lang.Tsx || lang === Lang.JavaScript) {
    const funcDecls = root.findAll({ rule: { kind: "function_declaration" } });
    for (const node of funcDecls) {
      const name = node.find({ rule: { kind: "identifier" } });
      if (name) functions.push(name.text());
    }

    // Arrow functions assigned to const
    const arrowFuncs = root.findAll({ rule: { kind: "arrow_function" } });
    for (const node of arrowFuncs) {
      const parent = node.parent();
      if (parent?.kind() === "variable_declarator") {
        const name = parent.find({ rule: { kind: "identifier" } });
        if (name) functions.push(name.text());
      }
    }
  }

  return [...new Set(functions)];
}

function extractClasses(root: SgNode, lang: Lang): string[] {
  const classes: string[] = [];

  if (lang === Lang.TypeScript || lang === Lang.Tsx || lang === Lang.JavaScript) {
    const classDecls = root.findAll({ rule: { kind: "class_declaration" } });
    for (const node of classDecls) {
      const name = node.find({ rule: { kind: "type_identifier" } });
      if (name) classes.push(name.text());
    }
  }

  return classes;
}

function extractComplexity(root: SgNode, lang: Lang): number {
  if (lang !== Lang.TypeScript && lang !== Lang.Tsx && lang !== Lang.JavaScript) {
    return 0;
  }

  // Base complexity of 1 for the file itself
  let complexity = 1;

  const branchKinds = [
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_case",
    "catch_clause",
  ];

  for (const kind of branchKinds) {
    try {
      complexity += root.findAll({ rule: { kind } }).length;
    } catch { /* skip invalid kind */ }
  }

  // Count && and || in binary expressions
  let binaryExprs: SgNode[] = [];
  try {
    binaryExprs = root.findAll({ rule: { kind: "binary_expression" } });
  } catch {}
  for (const node of binaryExprs) {
    const children = node.children();
    for (const child of children) {
      const k = child.kind();
      if (k === "&&" || k === "||") {
        complexity++;
      }
    }
  }

  return complexity;
}

function extractJSDoc(root: SgNode, lang: Lang): string[] {
  if (lang !== Lang.TypeScript && lang !== Lang.Tsx && lang !== Lang.JavaScript) {
    return [];
  }

  const jsdocs: string[] = [];
  const comments = root.findAll({ rule: { kind: "comment" } });

  for (const node of comments) {
    const text = node.text();
    if (text.startsWith("/**")) {
      // Strip comment markers: leading /**, trailing */, and leading * on each line
      const cleaned = text
        .replace(/^\/\*\*\s*/, "")
        .replace(/\s*\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, ""))
        .join("\n")
        .trim();
      if (cleaned) jsdocs.push(cleaned);
    }
  }

  return jsdocs;
}

function extractTypeExports(root: SgNode, lang: Lang): string[] {
  if (lang !== Lang.TypeScript && lang !== Lang.Tsx && lang !== Lang.JavaScript) {
    return [];
  }

  const typeExports: string[] = [];

  const exportStatements = root.findAll({
    rule: { kind: "export_statement" },
  });

  for (const node of exportStatements) {
    // export interface X
    const typeDecl = node.find({ rule: { kind: "interface_declaration" } });
    if (typeDecl) {
      const name = typeDecl.find({ rule: { kind: "type_identifier" } });
      if (name) typeExports.push(name.text());
      continue;
    }

    // export type X = ...
    const typeAlias = node.find({ rule: { kind: "type_alias_declaration" } });
    if (typeAlias) {
      const name = typeAlias.find({ rule: { kind: "type_identifier" } });
      if (name) typeExports.push(name.text());
    }
  }

  return typeExports;
}

function checkDefaultExport(root: SgNode, lang: Lang): boolean {
  if (lang !== Lang.TypeScript && lang !== Lang.Tsx && lang !== Lang.JavaScript) {
    return false;
  }

  const exportStatements = root.findAll({
    rule: { kind: "export_statement" },
  });

  for (const node of exportStatements) {
    const text = node.text();
    if (text.includes("export default")) {
      return true;
    }
  }

  return false;
}

function countTopLevelStatements(root: SgNode, lang: Lang): number {
  if (lang !== Lang.TypeScript && lang !== Lang.Tsx && lang !== Lang.JavaScript) {
    return 0;
  }

  // Top-level statements are direct children of the root (program) node
  let count = 0;
  const children = root.children();
  for (const child of children) {
    const kind = child.kind();
    // Skip comment nodes — they are not statements
    if (kind !== "comment") {
      count++;
    }
  }

  return count;
}
