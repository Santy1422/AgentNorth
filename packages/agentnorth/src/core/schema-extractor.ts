import { readFile } from "node:fs/promises";
import { Lang, parse as astParse } from "@ast-grep/napi";
import type { TableDef } from "./types.js";
import type { ScannedFile } from "./scanner.js";

/**
 * Extracts schema/table definitions from ORM model files.
 * Supports: Prisma schema, TypeORM entities, Drizzle schemas.
 */
export async function extractSchemas(files: ScannedFile[]): Promise<TableDef[]> {
  const tables: TableDef[] = [];

  for (const file of files) {
    const content = await readFile(file.absolutePath, "utf-8");

    // Prisma schema detection
    if (file.path.endsWith(".prisma")) {
      tables.push(...parsePrismaSchema(content));
      continue;
    }

    // TypeORM / Drizzle detection (TypeScript files)
    if (file.extension === ".ts" || file.extension === ".tsx") {
      tables.push(...parseTypeORMEntities(content));
      tables.push(...parseDrizzleSchema(content));
    }
  }

  return tables;
}

function parsePrismaSchema(content: string): TableDef[] {
  const tables: TableDef[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;

  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const columns: TableDef["columns"] = [];

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

      const colMatch = trimmed.match(/^(\w+)\s+(\w+)(\??)/);
      if (colMatch) {
        columns.push({
          name: colMatch[1]!,
          type: colMatch[2]!,
          nullable: colMatch[3] === "?",
        });
      }
    }

    if (columns.length > 0) {
      tables.push({ name, columns });
    }
  }

  return tables;
}

function parseTypeORMEntities(content: string): TableDef[] {
  const tables: TableDef[] = [];

  // Detect @Entity() decorator
  if (!content.includes("@Entity")) return tables;

  const tree = astParse(Lang.TypeScript, content);
  const root = tree.root();

  const classDecls = root.findAll({ rule: { kind: "class_declaration" } });

  for (const classNode of classDecls) {
    // Check if class has @Entity decorator
    const decorators = classNode.findAll({ rule: { kind: "decorator" } });
    const isEntity = decorators.some((d) => d.text().includes("Entity"));
    if (!isEntity) continue;

    const nameNode = classNode.find({ rule: { kind: "type_identifier" } });
    if (!nameNode) continue;

    const tableName = nameNode.text();
    const columns: TableDef["columns"] = [];

    // Find @Column() properties
    const properties = classNode.findAll({ rule: { kind: "public_field_definition" } });
    for (const prop of properties) {
      const propDecorators = prop.findAll({ rule: { kind: "decorator" } });
      const isColumn = propDecorators.some(
        (d) => d.text().includes("Column") || d.text().includes("PrimaryGeneratedColumn"),
      );
      if (!isColumn) continue;

      const propName = prop.find({ rule: { kind: "property_identifier" } });
      if (propName) {
        columns.push({
          name: propName.text(),
          type: "unknown",
          nullable: prop.text().includes("nullable: true"),
        });
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

function parseDrizzleSchema(content: string): TableDef[] {
  const tables: TableDef[] = [];

  // Detect pgTable/mysqlTable/sqliteTable — find the table name and extract
  // columns by scanning line-by-line from the match position
  const tableStartRegex = /(?:pg|mysql|sqlite)Table\s*\(\s*['"](\w+)['"]\s*,\s*\{/g;

  let match;
  while ((match = tableStartRegex.exec(content)) !== null) {
    const name = match[1]!;
    const startIdx = match.index + match[0].length;

    // Find matching closing brace accounting for nesting
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < content.length && depth > 0) {
      if (content[endIdx] === "{") depth++;
      else if (content[endIdx] === "}") depth--;
      endIdx++;
    }

    const body = content.slice(startIdx, endIdx - 1);
    const columns: TableDef["columns"] = [];

    // Parse column definitions: key: type(...)
    const colRegex = /(\w+)\s*:\s*(\w+)\(/g;
    let colMatch;
    while ((colMatch = colRegex.exec(body)) !== null) {
      columns.push({
        name: colMatch[1]!,
        type: colMatch[2]!,
      });
    }

    if (columns.length > 0) {
      tables.push({ name, columns });
    }
  }

  return tables;
}
