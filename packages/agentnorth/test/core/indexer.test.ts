import { describe, it, expect, beforeEach, vi } from "vitest";

vi.setConfig({ testTimeout: 30000 });
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { loadConfig } from "../../src/core/config.js";
import { scanModule } from "../../src/core/scanner.js";
import { parseFile } from "../../src/core/parser.js";
import { indexModule } from "../../src/core/indexer.js";
import type { AgentNorthConfig } from "../../src/core/types.js";

const FIXTURE_DIR = join(import.meta.dirname, "../fixtures/repo-nuevo");
const TOKENDOC_DIR = join(FIXTURE_DIR, ".agentnorth");

const TEST_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-project" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Authentication" },
    billing: { paths: ["src/billing/"], description: "Billing and payments" },
  },
  ignore: ["node_modules/", "dist/"],
};

describe("Scanner", () => {
  it("finds TypeScript files in module paths", async () => {
    const files = await scanModule(FIXTURE_DIR, TEST_CONFIG.modules.auth!);
    expect(files.length).toBe(2);
    expect(files.map((f) => f.path)).toContain("src/auth/middleware.ts");
    expect(files.map((f) => f.path)).toContain("src/auth/jwt.ts");
  });

  it("returns empty for non-existent paths", async () => {
    const files = await scanModule(FIXTURE_DIR, { paths: ["src/nope/"] });
    expect(files.length).toBe(0);
  });
});

describe("Parser", () => {
  it("extracts imports and exports from TypeScript", async () => {
    const files = await scanModule(FIXTURE_DIR, TEST_CONFIG.modules.auth!);
    const jwtFile = files.find((f) => f.path.includes("jwt.ts"))!;
    const parsed = await parseFile(jwtFile);

    expect(parsed.imports.length).toBeGreaterThan(0);
    expect(parsed.imports[0]!.source).toBe("jsonwebtoken");
    expect(parsed.exports).toContain("verifyJwt");
    expect(parsed.exports).toContain("signJwt");
    expect(parsed.loc).toBeGreaterThan(0);
  });

  it("extracts classes", async () => {
    const files = await scanModule(FIXTURE_DIR, TEST_CONFIG.modules.billing!);
    const invoicesFile = files.find((f) => f.path.includes("invoices.ts"))!;
    const parsed = await parseFile(invoicesFile);

    expect(parsed.classes).toContain("InvoiceService");
  });
});

describe("Indexer", () => {
  beforeEach(async () => {
    await rm(TOKENDOC_DIR, { recursive: true, force: true });
    await mkdir(join(TOKENDOC_DIR, "bundles"), { recursive: true });
    await mkdir(join(TOKENDOC_DIR, "decisions"), { recursive: true });
    await writeFile(
      join(TOKENDOC_DIR, "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  it("generates a valid bundle for a module", async () => {
    const bundle = await indexModule(FIXTURE_DIR, "auth", TEST_CONFIG);

    expect(bundle.module).toBe("auth");
    expect(bundle.files.length).toBe(2);
    expect(bundle.files.some((f) => f.exports.includes("verifyJwt"))).toBe(true);
    expect(bundle.dependencies.external).toContain("jsonwebtoken");
  });

  it("resolves external dependencies correctly", async () => {
    const bundle = await indexModule(FIXTURE_DIR, "billing", TEST_CONFIG);

    expect(bundle.dependencies.external).toContain("stripe");
  });

  it("throws for unknown module", async () => {
    await expect(
      indexModule(FIXTURE_DIR, "nonexistent", TEST_CONFIG),
    ).rejects.toThrow("not found in config");
  });
});

describe("Config loader", () => {
  beforeEach(async () => {
    await rm(TOKENDOC_DIR, { recursive: true, force: true });
    await mkdir(TOKENDOC_DIR, { recursive: true });
    await writeFile(
      join(TOKENDOC_DIR, "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  it("loads and validates config", async () => {
    const config = await loadConfig(FIXTURE_DIR);
    expect(config.project.name).toBe("test-project");
    expect(Object.keys(config.modules)).toEqual(["auth", "billing"]);
  });
});
