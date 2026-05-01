import { describe, it, expect } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { extractSchemas } from "../../src/core/schema-extractor.js";
import type { ScannedFile } from "../../src/core/scanner.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-schema");

describe("Schema Extractor", () => {
  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    await mkdir(TMP_DIR, { recursive: true });
  });

  it("extracts tables from Prisma schema", async () => {
    const prismaContent = `
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
`;
    const filePath = join(TMP_DIR, "schema.prisma");
    await writeFile(filePath, prismaContent);

    const files: ScannedFile[] = [
      { path: "prisma/schema.prisma", absolutePath: filePath, extension: ".prisma" },
    ];

    const tables = await extractSchemas(files);

    expect(tables.length).toBe(2);
    expect(tables[0]!.name).toBe("User");
    expect(tables[0]!.columns.some((c) => c.name === "email")).toBe(true);
    expect(tables[0]!.columns.some((c) => c.name === "name" && c.nullable)).toBe(true);
    expect(tables[1]!.name).toBe("Post");
  });

  it("extracts tables from Drizzle schema", async () => {
    const drizzleContent = `
import { pgTable, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  age: integer('age'),
  createdAt: timestamp('created_at').defaultNow(),
});
`;
    const filePath = join(TMP_DIR, "schema.ts");
    await writeFile(filePath, drizzleContent);

    const files: ScannedFile[] = [
      { path: "src/db/schema.ts", absolutePath: filePath, extension: ".ts" },
    ];

    const tables = await extractSchemas(files);

    expect(tables.length).toBe(1);
    expect(tables[0]!.name).toBe("users");
    expect(tables[0]!.columns.some((c) => c.name === "id" && c.type === "varchar")).toBe(true);
    expect(tables[0]!.columns.some((c) => c.name === "email")).toBe(true);
  });

  it("returns empty for files without schemas", async () => {
    const content = `export function hello() { return "world"; }`;
    const filePath = join(TMP_DIR, "utils.ts");
    await writeFile(filePath, content);

    const files: ScannedFile[] = [
      { path: "src/utils.ts", absolutePath: filePath, extension: ".ts" },
    ];

    const tables = await extractSchemas(files);
    expect(tables.length).toBe(0);
  });
});
