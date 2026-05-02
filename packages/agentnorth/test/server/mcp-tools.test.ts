import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { loadConfig, getBundlesDir, getDecisionsDir } from "../../src/core/config.js";
import { loadDecisions, writeDecision } from "../../src/core/decisions.js";
import { writeChangelog } from "../../src/core/changelog.js";
import type { AgentNorthConfig, ContextBundle } from "../../src/core/types.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-mcp-tools");

const TEST_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-mcp" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Authentication module" },
    billing: { paths: ["src/billing/"], description: "Billing module" },
  },
};

const SAMPLE_BUNDLE: ContextBundle = {
  module: "auth",
  files: [
    {
      path: "src/auth/middleware.ts",
      summary: "Auth middleware",
      exports: ["authMiddleware", "requireAuth"],
      imports: [{ source: "jsonwebtoken", specifiers: ["verify"] }],
      kind: "lib",
      loc: 35,
    },
  ],
  schema: { tables: [], mermaid: "" },
  dependencies: { internal: [], external: ["jsonwebtoken"] },
  decisions: [],
  recent_changes: [],
  contributors: [],
  conventions: [],
  warnings: [],
};

describe("MCP tools: list_modules", () => {
  beforeEach(async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("returns all module names from config", async () => {
    const config = await loadConfig(TMP_DIR);
    const modules = Object.entries(config.modules).map(([name, mod]) => ({
      name,
      paths: mod.paths,
      description: mod.description ?? "",
    }));

    expect(modules).toHaveLength(2);
    expect(modules[0]!.name).toBe("auth");
    expect(modules[0]!.description).toBe("Authentication module");
    expect(modules[1]!.name).toBe("billing");
  });

  it("returns module paths correctly", async () => {
    const config = await loadConfig(TMP_DIR);
    expect(config.modules["auth"]!.paths).toEqual(["src/auth/"]);
    expect(config.modules["billing"]!.paths).toEqual(["src/billing/"]);
  });
});

describe("MCP tools: get_context", () => {
  beforeEach(async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
    await writeFile(
      join(TMP_DIR, ".agentnorth", "bundles", "auth.json"),
      JSON.stringify(SAMPLE_BUNDLE, null, 2),
    );
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("returns full bundle for an existing module", async () => {
    const bundlePath = join(getBundlesDir(TMP_DIR), "auth.json");
    const raw = await readFile(bundlePath, "utf-8");
    const bundle = JSON.parse(raw);

    expect(bundle.module).toBe("auth");
    expect(bundle.files).toHaveLength(1);
    expect(bundle.files[0].exports).toContain("authMiddleware");
    expect(bundle.dependencies.external).toContain("jsonwebtoken");
  });

  it("throws for non-existent module bundle", async () => {
    const bundlePath = join(getBundlesDir(TMP_DIR), "nonexistent.json");
    await expect(readFile(bundlePath, "utf-8")).rejects.toThrow();
  });

  it("estimates token count from bundle size", async () => {
    const bundlePath = join(getBundlesDir(TMP_DIR), "auth.json");
    const raw = await readFile(bundlePath, "utf-8");
    const tokenEstimate = Math.round(raw.length / 4);

    expect(tokenEstimate).toBeGreaterThan(0);
    expect(typeof tokenEstimate).toBe("number");
  });
});

describe("MCP tools: get_decisions", () => {
  beforeEach(async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );

    // Write two decision files
    await writeFile(
      join(TMP_DIR, ".agentnorth", "decisions", "decision-001.md"),
      `---
id: decision-001
date: 2025-01-01
author: agent
module: auth
status: active
---

# Use JWT for authentication

## Contexto
We need stateless auth.

## Decision
Use JWT tokens with RS256.
`,
    );

    await writeFile(
      join(TMP_DIR, ".agentnorth", "decisions", "decision-002.md"),
      `---
id: decision-002
date: 2025-01-02
author: agent
module: billing
status: active
---

# Use Stripe for payments

## Contexto
Need payment processing.

## Decision
Integrate Stripe checkout.
`,
    );
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("returns all decisions when no module filter", async () => {
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions).toHaveLength(2);
  });

  it("filters decisions by module", async () => {
    const decisions = await loadDecisions(TMP_DIR, "auth");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.title).toBe("Use JWT for authentication");
    expect(decisions[0]!.module).toBe("auth");
  });

  it("returns empty array for module with no decisions", async () => {
    const decisions = await loadDecisions(TMP_DIR, "nonexistent");
    expect(decisions).toHaveLength(0);
  });

  it("parses decision frontmatter correctly", async () => {
    const decisions = await loadDecisions(TMP_DIR, "auth");
    const d = decisions[0]!;

    expect(d.id).toBe("decision-001");
    expect(d.date).toBe("2025-01-01");
    expect(d.author).toBe("agent");
    expect(d.status).toBe("active");
    expect(d.context).toBe("We need stateless auth.");
    expect(d.decision).toBe("Use JWT tokens with RS256.");
  });

  it("returns empty array when decisions directory does not exist", async () => {
    await rm(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true, force: true });
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions).toHaveLength(0);
  });
});

describe("MCP tools: log_decision", () => {
  beforeEach(async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("writes a decision markdown file", async () => {
    const input = {
      module: "auth",
      title: "Use bcrypt for hashing",
      context: "Need secure password hashing",
      decision: "Use bcrypt with 12 rounds",
    };

    const result = await writeDecision(TMP_DIR, input, "agent");

    expect(result.id).toBe("decision-001");
    expect(result.module).toBe("auth");
    expect(result.title).toBe("Use bcrypt for hashing");
    expect(result.status).toBe("active");

    // Verify the file was written
    const decisionsDir = getDecisionsDir(TMP_DIR);
    const files = await readdir(decisionsDir);
    expect(files).toContain("decision-001.md");

    // Verify file content
    const content = await readFile(join(decisionsDir, "decision-001.md"), "utf-8");
    expect(content).toContain("Use bcrypt for hashing");
    expect(content).toContain("Need secure password hashing");
    expect(content).toContain("Use bcrypt with 12 rounds");
    expect(content).toContain("module: auth");
  });

  it("increments decision ID", async () => {
    await writeDecision(TMP_DIR, {
      module: "auth",
      title: "Decision 1",
      context: "ctx",
      decision: "dec",
    }, "agent");

    const second = await writeDecision(TMP_DIR, {
      module: "billing",
      title: "Decision 2",
      context: "ctx2",
      decision: "dec2",
    }, "agent");

    expect(second.id).toBe("decision-002");

    const files = await readdir(getDecisionsDir(TMP_DIR));
    expect(files).toContain("decision-001.md");
    expect(files).toContain("decision-002.md");
  });

  it("creates decisions directory if it does not exist", async () => {
    await rm(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true, force: true });

    const result = await writeDecision(TMP_DIR, {
      module: "auth",
      title: "Test",
      context: "ctx",
      decision: "dec",
    }, "agent");

    expect(result.id).toBe("decision-001");
  });
});

describe("MCP tools: log_change", () => {
  beforeEach(async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "changelog"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(TEST_CONFIG),
    );
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("writes a changelog entry", async () => {
    const input = {
      module: "auth",
      summary: "Added rate limiting to auth middleware",
      files_changed: ["src/auth/middleware.ts", "src/auth/rate-limit.ts"],
      breaking: false,
      notes: "Uses sliding window algorithm",
    };

    const entry = await writeChangelog(TMP_DIR, input, "agent");

    expect(entry.module).toBe("auth");
    expect(entry.summary).toBe("Added rate limiting to auth middleware");
    expect(entry.files_changed).toEqual(["src/auth/middleware.ts", "src/auth/rate-limit.ts"]);
    expect(entry.breaking).toBe(false);
    expect(entry.notes).toBe("Uses sliding window algorithm");
  });

  it("writes a breaking change entry", async () => {
    const input = {
      module: "billing",
      summary: "Changed invoice API response format",
      files_changed: ["src/billing/invoices.ts"],
      breaking: true,
    };

    const entry = await writeChangelog(TMP_DIR, input, "agent");
    expect(entry.breaking).toBe(true);
  });

  it("creates changelog directory if missing", async () => {
    await rm(join(TMP_DIR, ".agentnorth", "changelog"), { recursive: true, force: true });

    const entry = await writeChangelog(TMP_DIR, {
      module: "auth",
      summary: "Test change",
      files_changed: ["src/auth/test.ts"],
    }, "agent");

    expect(entry.module).toBe("auth");
  });

  it("writes markdown file with correct frontmatter", async () => {
    const entry = await writeChangelog(TMP_DIR, {
      module: "auth",
      summary: "Updated middleware",
      files_changed: ["src/auth/middleware.ts"],
      notes: "Some notes here",
    }, "agent");

    const changelogDir = join(TMP_DIR, ".agentnorth", "changelog");
    const files = await readdir(changelogDir);
    expect(files.length).toBeGreaterThan(0);

    const content = await readFile(join(changelogDir, files[0]!), "utf-8");
    expect(content).toContain("module: auth");
    expect(content).toContain("# Updated middleware");
    expect(content).toContain("src/auth/middleware.ts");
    expect(content).toContain("Some notes here");
  });
});
