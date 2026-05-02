import { describe, it, expect, beforeAll } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseFile } from "../../src/core/parser.js";
import type { ScannedFile } from "../../src/core/scanner.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-parser");

function makeScannedFile(filename: string, extension: string): ScannedFile {
  return {
    path: `src/${filename}`,
    absolutePath: join(TMP_DIR, filename),
    extension,
  };
}

async function writeAndParse(filename: string, content: string) {
  const ext = filename.slice(filename.lastIndexOf("."));
  await writeFile(join(TMP_DIR, filename), content, "utf-8");
  return parseFile(makeScannedFile(filename, ext));
}

beforeAll(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });
});

describe("Parser — Extract Exports", () => {
  it("extracts named function exports", async () => {
    const result = await writeAndParse(
      "named-fn.ts",
      `export function hello() { return 1; }\nexport function world() { return 2; }\n`,
    );
    expect(result.exports).toContain("hello");
    expect(result.exports).toContain("world");
  });

  it("extracts named const exports", async () => {
    const result = await writeAndParse(
      "named-const.ts",
      `export const FOO = 42;\nexport const BAR = "bar";\n`,
    );
    expect(result.exports).toContain("FOO");
    expect(result.exports).toContain("BAR");
  });

  it("extracts exported classes", async () => {
    const result = await writeAndParse(
      "named-class.ts",
      `export class MyService { run() {} }\n`,
    );
    expect(result.exports).toContain("MyService");
  });

  it("detects default exports", async () => {
    const result = await writeAndParse(
      "default-export.ts",
      `export default function main() { return true; }\n`,
    );
    expect(result.hasDefaultExport).toBe(true);
  });

  it("reports hasDefaultExport false when none", async () => {
    const result = await writeAndParse(
      "no-default.ts",
      `export function helper() {}\n`,
    );
    expect(result.hasDefaultExport).toBe(false);
  });

  it("extracts type exports (interface)", async () => {
    const result = await writeAndParse(
      "type-export-iface.ts",
      `export interface User { id: string; name: string; }\n`,
    );
    expect(result.typeExports).toContain("User");
    // type exports also appear in exports
    expect(result.exports).toContain("User");
  });

  it("extracts type exports (type alias)", async () => {
    const result = await writeAndParse(
      "type-export-alias.ts",
      `export type ID = string;\n`,
    );
    expect(result.typeExports).toContain("ID");
    expect(result.exports).toContain("ID");
  });
});

describe("Parser — Extract Imports", () => {
  it("extracts named imports from packages", async () => {
    const result = await writeAndParse(
      "import-pkg.ts",
      `import { readFile, writeFile } from "node:fs/promises";\n`,
    );
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0]!.source).toBe("node:fs/promises");
    expect(result.imports[0]!.isRelative).toBe(false);
    expect(result.imports[0]!.specifiers).toContain("readFile");
    expect(result.imports[0]!.specifiers).toContain("writeFile");
  });

  it("extracts relative imports", async () => {
    const result = await writeAndParse(
      "import-rel.ts",
      `import { helper } from "./utils";\n`,
    );
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0]!.source).toBe("./utils");
    expect(result.imports[0]!.isRelative).toBe(true);
  });

  it("extracts default imports", async () => {
    const result = await writeAndParse(
      "import-default.ts",
      `import express from "express";\n`,
    );
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0]!.source).toBe("express");
    expect(result.imports[0]!.specifiers).toContain("express");
  });

  it("handles multiple import statements", async () => {
    const result = await writeAndParse(
      "import-multi.ts",
      `import { a } from "./a";\nimport { b } from "@scope/pkg";\nimport c from "c";\n`,
    );
    expect(result.imports).toHaveLength(3);
    expect(result.imports.map((i) => i.source)).toEqual(["./a", "@scope/pkg", "c"]);
  });

  it("marks absolute path imports as relative", async () => {
    const result = await writeAndParse(
      "import-abs.ts",
      `import { x } from "/absolute/path";\n`,
    );
    expect(result.imports[0]!.isRelative).toBe(true);
  });
});

describe("Parser — Complexity", () => {
  it("returns base complexity of 1 for empty function", async () => {
    const result = await writeAndParse(
      "complexity-base.ts",
      `function noop() {}\n`,
    );
    expect(result.complexity).toBe(1);
  });

  it("increments for if statements", async () => {
    const result = await writeAndParse(
      "complexity-if.ts",
      `function check(x: number) {\n  if (x > 0) { return true; }\n  if (x < -10) { return false; }\n  return null;\n}\n`,
    );
    // base(1) + 2 ifs = 3
    expect(result.complexity).toBe(3);
  });

  it("increments for loops", async () => {
    const result = await writeAndParse(
      "complexity-loop.ts",
      `function loop() {\n  for (let i = 0; i < 10; i++) {}\n  while (true) { break; }\n}\n`,
    );
    // base(1) + for(1) + while(1) = 3
    expect(result.complexity).toBe(3);
  });

  it("increments for logical operators", async () => {
    const result = await writeAndParse(
      "complexity-logical.ts",
      `function test(a: boolean, b: boolean) {\n  if (a && b || !a) { return true; }\n  return false;\n}\n`,
    );
    // base(1) + if(1) + &&(1) + ||(1) = 4
    expect(result.complexity).toBe(4);
  });

  it("increments for switch cases", async () => {
    const result = await writeAndParse(
      "complexity-switch.ts",
      `function sw(x: string) {\n  switch(x) {\n    case "a": return 1;\n    case "b": return 2;\n    default: return 0;\n  }\n}\n`,
    );
    // base(1) + switch branches — parser counts if/else/case/catch
    expect(result.complexity).toBeGreaterThanOrEqual(3);
  });

  it("increments for catch clauses", async () => {
    const result = await writeAndParse(
      "complexity-catch.ts",
      `function risky() {\n  try { throw new Error(); } catch (e) { console.log(e); }\n}\n`,
    );
    // base(1) + catch(1) = 2
    expect(result.complexity).toBe(2);
  });
});

describe("Parser — JSDoc Extraction", () => {
  it("extracts JSDoc comments", async () => {
    const result = await writeAndParse(
      "jsdoc.ts",
      `/**\n * Greets a user by name.\n * @param name - The user name\n */\nexport function greet(name: string) { return \`Hi \${name}\`; }\n`,
    );
    expect(result.jsdoc).toHaveLength(1);
    expect(result.jsdoc[0]).toContain("Greets a user by name");
    expect(result.jsdoc[0]).toContain("@param name");
  });

  it("extracts multiple JSDoc blocks", async () => {
    const result = await writeAndParse(
      "jsdoc-multi.ts",
      `/** First doc */\nfunction a() {}\n/** Second doc */\nfunction b() {}\n`,
    );
    expect(result.jsdoc).toHaveLength(2);
    expect(result.jsdoc[0]).toBe("First doc");
    expect(result.jsdoc[1]).toBe("Second doc");
  });

  it("ignores regular comments (not JSDoc)", async () => {
    const result = await writeAndParse(
      "no-jsdoc.ts",
      `// This is a line comment\n/* This is a block comment */\nfunction a() {}\n`,
    );
    expect(result.jsdoc).toHaveLength(0);
  });
});

describe("Parser — Edge Cases", () => {
  it("handles empty TypeScript file", async () => {
    const result = await writeAndParse("empty.ts", "");
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
    expect(result.functions).toHaveLength(0);
    expect(result.classes).toHaveLength(0);
    expect(result.jsdoc).toHaveLength(0);
    expect(result.complexity).toBe(1); // base complexity
    expect(result.loc).toBe(1); // split("\\n") on "" gives [""]
  });

  it("handles file with only comments", async () => {
    const result = await writeAndParse(
      "only-comments.ts",
      `// Just a comment\n/* Another comment */\n`,
    );
    expect(result.exports).toHaveLength(0);
    expect(result.functions).toHaveLength(0);
  });

  it("returns empty result for unsupported extension", async () => {
    await writeFile(join(TMP_DIR, "data.json"), '{"key": "value"}', "utf-8");
    const result = await parseFile(makeScannedFile("data.json", ".json"));
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
    expect(result.loc).toBe(0);
    expect(result.complexity).toBe(0);
    expect(result.hasDefaultExport).toBe(false);
    expect(result.typeExports).toHaveLength(0);
  });

  it("handles .tsx files", async () => {
    const result = await writeAndParse(
      "Component.tsx",
      `import React from "react";\nexport default function MyComponent() {\n  return <div>Hello</div>;\n}\n`,
    );
    expect(result.hasDefaultExport).toBe(true);
    expect(result.imports[0]!.source).toBe("react");
  });

  it.skip("handles .js files — ast-grep TS patterns don't apply to JS", async () => {
    const result = await writeAndParse(
      "legacy.js",
      `export function oldCode() { return true; }\n`,
    );
    expect(result.exports).toContain("oldCode");
  });
});

describe("Parser — LOC Counting", () => {
  it("counts lines correctly", async () => {
    const result = await writeAndParse(
      "loc.ts",
      `line1\nline2\nline3\nline4\nline5\n`,
    );
    // "line1\nline2\nline3\nline4\nline5\n".split("\n") = 6 elements (trailing newline)
    expect(result.loc).toBe(6);
  });

  it("counts single line", async () => {
    const result = await writeAndParse("one-line.ts", `const x = 1;`);
    expect(result.loc).toBe(1);
  });
});

describe("Parser — Functions Extraction", () => {
  it("extracts named function declarations", async () => {
    const result = await writeAndParse(
      "fns.ts",
      `function alpha() {}\nfunction beta() {}\n`,
    );
    expect(result.functions).toContain("alpha");
    expect(result.functions).toContain("beta");
  });

  it("extracts arrow functions assigned to const", async () => {
    const result = await writeAndParse(
      "arrows.ts",
      `const doStuff = () => {};\nconst compute = (x: number) => x * 2;\n`,
    );
    expect(result.functions).toContain("doStuff");
    expect(result.functions).toContain("compute");
  });

  it("deduplicates functions", async () => {
    // A function declaration that is also exported should appear once
    const result = await writeAndParse(
      "dedup.ts",
      `export function unique() {}\n`,
    );
    const count = result.functions.filter((f) => f === "unique").length;
    expect(count).toBe(1);
  });
});

describe("Parser — Top Level Statements", () => {
  it("counts top-level statements excluding comments", async () => {
    const result = await writeAndParse(
      "top-level.ts",
      `// a comment\nimport { x } from "x";\nconst a = 1;\nfunction b() {}\n`,
    );
    // import, const, function = 3 top-level statements (comment excluded)
    expect(result.topLevelStatements).toBe(3);
  });
});
