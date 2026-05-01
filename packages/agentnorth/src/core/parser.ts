import { readFile } from "node:fs/promises";
import { Lang, parse as astParse } from "@ast-grep/napi";
import type { ScannedFile } from "./scanner.js";

export interface ParsedFile {
  path: string;
  imports: ImportInfo[];
  exports: string[];
  functions: string[];
  classes: string[];
  loc: number;
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

  return { path: file.path, imports, exports, functions, classes, loc };
}

function extractImports(root: any, lang: Lang): ImportInfo[] {
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

function extractExports(root: any, lang: Lang): string[] {
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

function extractFunctions(root: any, lang: Lang): string[] {
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

function extractClasses(root: any, lang: Lang): string[] {
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
