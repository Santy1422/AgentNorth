import { describe, it, expect, beforeEach } from "vitest";
import { writeFile, readFile, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadDecisions, writeDecision } from "../../src/core/decisions.js";
import type { Decision } from "../../src/core/types.js";
import type { LogDecisionInput } from "../../src/schemas/decision.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-decisions");
const DECISIONS_DIR = join(TMP_DIR, ".agentnorth", "decisions");

beforeEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(DECISIONS_DIR, { recursive: true });
});

describe("Decision — Parse markdown format", () => {
  it("parses a well-formed decision markdown file", async () => {
    const md = `---
id: decision-001
date: 2025-01-15
author: dev-agent
module: auth
status: active
---

# Use JWT for authentication

## Contexto
We need stateless auth for the API.

## Decision
Use JWT tokens with RS256 signing.
`;
    await writeFile(join(DECISIONS_DIR, "decision-001.md"), md, "utf-8");
    const decisions = await loadDecisions(TMP_DIR);

    expect(decisions).toHaveLength(1);
    const d = decisions[0]!;
    expect(d.id).toBe("decision-001");
    expect(d.date).toBe("2025-01-15");
    expect(d.author).toBe("dev-agent");
    expect(d.module).toBe("auth");
    expect(d.status).toBe("active");
    expect(d.title).toBe("Use JWT for authentication");
    expect(d.context).toBe("We need stateless auth for the API.");
    expect(d.decision).toBe("Use JWT tokens with RS256 signing.");
  });

  it("filters by module when specified", async () => {
    const md1 = `---\nid: decision-001\ndate: 2025-01-10\nauthor: a\nmodule: auth\nstatus: active\n---\n\n# Auth decision\n\n## Contexto\nCtx\n\n## Decision\nDec\n`;
    const md2 = `---\nid: decision-002\ndate: 2025-01-11\nauthor: a\nmodule: billing\nstatus: active\n---\n\n# Billing decision\n\n## Contexto\nCtx\n\n## Decision\nDec\n`;

    await writeFile(join(DECISIONS_DIR, "decision-001.md"), md1, "utf-8");
    await writeFile(join(DECISIONS_DIR, "decision-002.md"), md2, "utf-8");

    const authDecisions = await loadDecisions(TMP_DIR, "auth");
    expect(authDecisions).toHaveLength(1);
    expect(authDecisions[0]!.module).toBe("auth");

    const allDecisions = await loadDecisions(TMP_DIR);
    expect(allDecisions).toHaveLength(2);
  });

  it("sorts decisions by date descending", async () => {
    const mkDecision = (id: string, date: string) =>
      `---\nid: ${id}\ndate: ${date}\nauthor: a\nmodule: m\nstatus: active\n---\n\n# Title\n\n## Contexto\nCtx\n\n## Decision\nDec\n`;

    await writeFile(join(DECISIONS_DIR, "decision-001.md"), mkDecision("decision-001", "2025-01-01"), "utf-8");
    await writeFile(join(DECISIONS_DIR, "decision-002.md"), mkDecision("decision-002", "2025-06-15"), "utf-8");
    await writeFile(join(DECISIONS_DIR, "decision-003.md"), mkDecision("decision-003", "2025-03-10"), "utf-8");

    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions.map((d) => d.id)).toEqual(["decision-002", "decision-003", "decision-001"]);
  });

  it("returns empty array when directory does not exist", async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions).toEqual([]);
  });

  it("skips non-.md files", async () => {
    await writeFile(join(DECISIONS_DIR, "readme.txt"), "not a decision", "utf-8");
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions).toEqual([]);
  });

  it("skips files without frontmatter", async () => {
    await writeFile(join(DECISIONS_DIR, "bad.md"), "# No frontmatter here\nJust text.\n", "utf-8");
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions).toEqual([]);
  });

  it("parses status correctly including superseded", async () => {
    const md = `---\nid: decision-001\ndate: 2025-01-01\nauthor: a\nmodule: m\nstatus: superseded\n---\n\n# Old decision\n\n## Contexto\nCtx\n\n## Decision\nDec\n`;
    await writeFile(join(DECISIONS_DIR, "decision-001.md"), md, "utf-8");
    const decisions = await loadDecisions(TMP_DIR);
    expect(decisions[0]!.status).toBe("superseded");
  });
});

describe("Decision — Write decision to markdown", () => {
  it("writes a decision file with correct format", async () => {
    const input: LogDecisionInput = {
      module: "auth",
      title: "Use bcrypt for passwords",
      context: "Need secure password hashing",
      decision: "Use bcrypt with 12 rounds",
    };

    const result = await writeDecision(TMP_DIR, input, "test-agent");

    expect(result.id).toBe("decision-001");
    expect(result.module).toBe("auth");
    expect(result.title).toBe("Use bcrypt for passwords");
    expect(result.author).toBe("test-agent");
    expect(result.status).toBe("active");

    // Verify file was actually written
    const files = await readdir(DECISIONS_DIR);
    expect(files).toContain("decision-001.md");

    const content = await readFile(join(DECISIONS_DIR, "decision-001.md"), "utf-8");
    expect(content).toContain("id: decision-001");
    expect(content).toContain("module: auth");
    expect(content).toContain("# Use bcrypt for passwords");
    expect(content).toContain("## Contexto");
    expect(content).toContain("Need secure password hashing");
    expect(content).toContain("## Decision");
    expect(content).toContain("Use bcrypt with 12 rounds");
  });

  it("increments ID based on existing decisions", async () => {
    // Write two decisions
    const input1: LogDecisionInput = {
      module: "auth",
      title: "First",
      context: "c1",
      decision: "d1",
    };
    const input2: LogDecisionInput = {
      module: "auth",
      title: "Second",
      context: "c2",
      decision: "d2",
    };

    const r1 = await writeDecision(TMP_DIR, input1, "agent");
    const r2 = await writeDecision(TMP_DIR, input2, "agent");

    expect(r1.id).toBe("decision-001");
    expect(r2.id).toBe("decision-002");
  });
});

describe("Decision — Roundtrip (write -> read -> compare)", () => {
  it("roundtrips a decision correctly", async () => {
    const input: LogDecisionInput = {
      module: "billing",
      title: "Use Stripe for payments",
      context: "We evaluated multiple payment processors and Stripe has the best API.",
      decision: "Integrate Stripe via their Node.js SDK with webhooks for async events.",
    };

    const written = await writeDecision(TMP_DIR, input, "roundtrip-agent");

    // Now read it back
    const loaded = await loadDecisions(TMP_DIR, "billing");
    expect(loaded).toHaveLength(1);

    const read = loaded[0]!;
    expect(read.id).toBe(written.id);
    expect(read.module).toBe(written.module);
    expect(read.title).toBe(written.title);
    expect(read.context).toBe(written.context);
    expect(read.decision).toBe(written.decision);
    expect(read.author).toBe(written.author);
    expect(read.status).toBe(written.status);
    expect(read.date).toBe(written.date);
  });

  it("roundtrips multiple decisions", async () => {
    const inputs: LogDecisionInput[] = [
      { module: "auth", title: "JWT tokens", context: "Need stateless auth", decision: "Use JWT" },
      { module: "auth", title: "Rate limiting", context: "Prevent abuse", decision: "Use redis-based rate limiter" },
      { module: "billing", title: "Invoicing", context: "Need invoice gen", decision: "Use PDF generation" },
    ];

    for (const input of inputs) {
      await writeDecision(TMP_DIR, input, "agent");
    }

    const authDecisions = await loadDecisions(TMP_DIR, "auth");
    expect(authDecisions).toHaveLength(2);

    const allDecisions = await loadDecisions(TMP_DIR);
    expect(allDecisions).toHaveLength(3);

    // Verify each has correct module
    for (const d of allDecisions) {
      const original = inputs.find((i) => i.title === d.title);
      expect(original).toBeDefined();
      expect(d.module).toBe(original!.module);
      expect(d.context).toBe(original!.context);
      expect(d.decision).toBe(original!.decision);
    }
  });
});
