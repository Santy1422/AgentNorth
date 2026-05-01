import { describe, it, expect, beforeEach } from "vitest";
import { rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { indexAll } from "../../src/core/indexer.js";
import { generateModuleDocs } from "../../src/generators/markdown.js";
import { generateArchitectureDoc } from "../../src/generators/architecture.js";
import { generateDependencyGraph } from "../../src/generators/mermaid.js";
import type { AgentNorthConfig } from "../../src/core/types.js";

const FIXTURE_DIR = join(import.meta.dirname, "../fixtures/repo-nuevo");
const TOKENDOC_DIR = join(FIXTURE_DIR, ".agentnorth");

const TEST_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-project", framework: "express" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Authentication" },
    billing: { paths: ["src/billing/"], description: "Billing and payments" },
  },
  ignore: ["node_modules/", "dist/"],
};

describe("Generators", () => {
  beforeEach(async () => {
    await rm(TOKENDOC_DIR, { recursive: true, force: true });
    await mkdir(join(TOKENDOC_DIR, "bundles"), { recursive: true });
    await mkdir(join(TOKENDOC_DIR, "decisions"), { recursive: true });
    await writeFile(
      join(TOKENDOC_DIR, "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  it("generates module markdown docs", async () => {
    const bundles = await indexAll(FIXTURE_DIR, TEST_CONFIG);
    await generateModuleDocs(FIXTURE_DIR, bundles);

    const authDoc = await readFile(
      join(TOKENDOC_DIR, "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("# auth");
    expect(authDoc).toContain("middleware.ts");
    expect(authDoc).toContain("jwt.ts");
    expect(authDoc).toContain("verifyJwt");
  });

  it("generates ARCHITECTURE.md", async () => {
    const bundles = await indexAll(FIXTURE_DIR, TEST_CONFIG);
    await generateArchitectureDoc(FIXTURE_DIR, TEST_CONFIG, bundles);

    const archDoc = await readFile(
      join(TOKENDOC_DIR, "docs", "ARCHITECTURE.md"),
      "utf-8",
    );
    expect(archDoc).toContain("# test-project");
    expect(archDoc).toContain("auth");
    expect(archDoc).toContain("billing");
    expect(archDoc).toContain("```mermaid");
    expect(archDoc).toContain("Framework");
  });

  it("generates dependency graph mermaid", async () => {
    const bundles = await indexAll(FIXTURE_DIR, TEST_CONFIG);
    await generateDependencyGraph(FIXTURE_DIR, bundles);

    const graph = await readFile(
      join(TOKENDOC_DIR, "docs", "DEPENDENCY-MAP.mmd"),
      "utf-8",
    );
    expect(graph).toContain("graph TD");
    expect(graph).toContain("auth");
    expect(graph).toContain("billing");
  });
});
