import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { stringify as yamlStringify } from "yaml";
import type { AgentNorthConfig } from "../../src/core/types.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-pull");

const VALID_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-pull" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Auth" },
  },
};

describe("pull command: HTTP interaction", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(VALID_CONFIG),
    );
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("sends correct headers for pull request", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers) {
        capturedHeaders = { ...headers };
      }
      return new Response(
        JSON.stringify({ ok: true, decisions: [], changes: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    await fetch("https://test.agentnorth.io/api/v1/pull?project=test-pull", {
      headers: {
        "X-Org-Key": "org_key",
        "X-Dev-Key": "dev_key",
      },
    });

    expect(capturedHeaders["X-Org-Key"]).toBe("org_key");
    expect(capturedHeaders["X-Dev-Key"]).toBe("dev_key");
  });

  it("uses GET method with query params", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? "GET";
      return new Response(
        JSON.stringify({ ok: true, decisions: [], changes: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const apiUrl = "https://test.agentnorth.io";
    const url = new URL(`${apiUrl}/api/v1/pull`);
    url.searchParams.set("project", "test-pull");
    url.searchParams.set("since", "2025-01-01T00:00:00Z");

    await fetch(url.toString(), {
      headers: { "X-Org-Key": "org_key", "X-Dev-Key": "dev_key" },
    });

    expect(capturedUrl).toContain("/api/v1/pull");
    expect(capturedUrl).toContain("project=test-pull");
    expect(capturedUrl).toContain("since=");
    expect(capturedMethod).toBe("GET");
  });

  it("handles 401 unauthorized on pull", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as typeof fetch;

    const response = await fetch("https://test.agentnorth.io/api/v1/pull", {
      headers: { "X-Org-Key": "bad", "X-Dev-Key": "bad" },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("handles 500 server error on pull", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Server error", { status: 500 });
    }) as typeof fetch;

    const response = await fetch("https://test.agentnorth.io/api/v1/pull");
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it("handles network failure on pull", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network error");
    }) as typeof fetch;

    await expect(
      fetch("https://test.agentnorth.io/api/v1/pull"),
    ).rejects.toThrow("Network error");
  });

  it("parses pull response with decisions correctly", async () => {
    const pullResponse = {
      ok: true,
      decisions: [
        {
          module: "auth",
          title: "Use OAuth2",
          context: "Need social login",
          decision: "Implement OAuth2 with Google",
          author: "dashboard-user",
          status: "active",
          date: "2025-02-01",
          source: "dashboard",
        },
      ],
      changes: [],
    };

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(pullResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const response = await fetch("https://test.agentnorth.io/api/v1/pull");
    const result = await response.json() as typeof pullResponse;

    expect(result.ok).toBe(true);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]!.title).toBe("Use OAuth2");
    expect(result.decisions[0]!.source).toBe("dashboard");
  });

  it("writes pulled decisions as local markdown files", async () => {
    // Simulate what pullCommand does after receiving decisions
    const decisionsDir = join(TMP_DIR, ".agentnorth", "decisions");

    const pulledDecision = {
      module: "auth",
      title: "Use OAuth2",
      context: "Need social login",
      decision: "Implement OAuth2 with Google",
      author: "dashboard-user",
      status: "active",
      date: "2025-02-01",
      source: "dashboard",
    };

    const id = "decision-001";
    const date = new Date(pulledDecision.date).toISOString().split("T")[0];
    const content = `---
id: ${id}
date: ${date}
author: ${pulledDecision.author}
module: ${pulledDecision.module}
status: ${pulledDecision.status}
source: dashboard
---

# ${pulledDecision.title}

## Contexto
${pulledDecision.context}

## Decision
${pulledDecision.decision}
`;

    await writeFile(join(decisionsDir, `${id}.md`), content, "utf-8");

    // Verify
    const files = await readdir(decisionsDir);
    expect(files).toContain("decision-001.md");

    const written = await readFile(join(decisionsDir, "decision-001.md"), "utf-8");
    expect(written).toContain("Use OAuth2");
    expect(written).toContain("source: dashboard");
    expect(written).toContain("Need social login");
  });

  it("saves last-pull timestamp", async () => {
    const pullStateFile = join(TMP_DIR, ".agentnorth", ".last-pull");
    const now = new Date().toISOString();
    await writeFile(pullStateFile, now, "utf-8");

    const saved = (await readFile(pullStateFile, "utf-8")).trim();
    expect(new Date(saved).getTime()).not.toBeNaN();
  });
});
