import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { generateModuleDocs } from "../../src/generators/markdown.js";
import type { ContextBundle } from "../../src/core/types.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-docs");

const SAMPLE_BUNDLES: ContextBundle[] = [
  {
    module: "auth",
    files: [
      {
        path: "src/auth/middleware.ts",
        summary: "Auth middleware for request validation",
        exports: ["authMiddleware", "requireAuth", "AuthUser"],
        imports: [
          { source: "jsonwebtoken", specifiers: ["verify"] },
          { source: "next/server", specifiers: ["NextRequest"] },
        ],
        kind: "lib",
        loc: 35,
      },
      {
        path: "src/auth/session.ts",
        summary: "Session storage",
        exports: ["SessionStore", "sessionStore"],
        imports: [{ source: "./middleware", specifiers: ["AuthUser"] }],
        kind: "lib",
        loc: 20,
      },
    ],
    schema: { tables: [], mermaid: "" },
    dependencies: {
      internal: ["billing"],
      external: ["jsonwebtoken", "next"],
    },
    decisions: [
      {
        id: "decision-001",
        date: "2025-01-01",
        author: "agent",
        module: "auth",
        title: "Use JWT for authentication",
        context: "Need stateless auth",
        decision: "JWT with RS256",
        status: "active",
      },
    ],
    recent_changes: [
      {
        commit: "abc12345",
        date: "2025-01-15T10:00:00Z",
        author: "Test User",
        summary: "Add rate limiting",
        files_changed: ["src/auth/middleware.ts"],
      },
    ],
    contributors: [{ name: "Test User", commits: 5, last_active: "2025-01-15" }],
    conventions: ["All auth functions must validate tokens before proceeding"],
    warnings: ["middleware.ts has high complexity (15)"],
  },
  {
    module: "billing",
    files: [
      {
        path: "src/billing/stripe.ts",
        summary: "Stripe integration",
        exports: ["createCheckout", "cancelSubscription"],
        imports: [{ source: "stripe", specifiers: ["Stripe"] }],
        kind: "lib",
        loc: 25,
      },
    ],
    schema: { tables: [], mermaid: "" },
    dependencies: { internal: [], external: ["stripe"] },
    decisions: [],
    recent_changes: [],
    contributors: [],
    conventions: [],
    warnings: [],
  },
];

describe("docs generation: generateModuleDocs", () => {
  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("generates markdown files for each bundle", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const docsDir = join(TMP_DIR, ".agentnorth", "docs", "modules");
    expect(existsSync(join(docsDir, "auth.md"))).toBe(true);
    expect(existsSync(join(docsDir, "billing.md"))).toBe(true);
  });

  it("includes module name as heading", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("# auth");
  });

  it("includes file list with exports and LOC", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("src/auth/middleware.ts");
    expect(authDoc).toContain("authMiddleware");
    expect(authDoc).toContain("35");
    expect(authDoc).toContain("src/auth/session.ts");
  });

  it("includes dependencies section", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("Dependencies");
    expect(authDoc).toContain("jsonwebtoken");
    expect(authDoc).toContain("billing");
    expect(authDoc).toContain("Internal modules");
    expect(authDoc).toContain("External packages");
  });

  it("includes decisions in the output", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("Decisions");
    expect(authDoc).toContain("Use JWT for authentication");
    expect(authDoc).toContain("decision-001");
  });

  it("includes recent changes", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("Recent Changes");
    expect(authDoc).toContain("Add rate limiting");
  });

  it("includes conventions as blockquote", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("> All auth functions must validate tokens");
  });

  it("includes warnings", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("Warnings");
    expect(authDoc).toContain("middleware.ts has high complexity");
  });

  it("includes stats table", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const authDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "auth.md"),
      "utf-8",
    );
    expect(authDoc).toContain("Files | 2");
    expect(authDoc).toContain("Lines of code | 55");
    expect(authDoc).toContain("Decisions | 1");
  });

  it("handles module with no dependencies or decisions", async () => {
    await generateModuleDocs(TMP_DIR, SAMPLE_BUNDLES);

    const billingDoc = await readFile(
      join(TMP_DIR, ".agentnorth", "docs", "modules", "billing.md"),
      "utf-8",
    );
    expect(billingDoc).toContain("# billing");
    expect(billingDoc).toContain("stripe");
    // Should not contain decisions section
    expect(billingDoc).not.toContain("## Decisions");
  });

  it("generates empty docs for empty bundles array", async () => {
    await generateModuleDocs(TMP_DIR, []);

    const docsDir = join(TMP_DIR, ".agentnorth", "docs", "modules");
    expect(existsSync(docsDir)).toBe(true);
    const files = await readdir(docsDir);
    expect(files).toHaveLength(0);
  });
});
