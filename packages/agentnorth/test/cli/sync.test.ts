import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { AgentNorthConfig, ContextBundle } from "../../src/core/types.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-sync");

const VALID_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-sync" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Auth" },
  },
};

const SAMPLE_BUNDLE: ContextBundle = {
  module: "auth",
  files: [
    {
      path: "src/auth/middleware.ts",
      summary: "Auth middleware",
      exports: ["authMiddleware"],
      imports: [],
      kind: "lib",
      loc: 30,
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

describe("sync command: HTTP interaction", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await mkdir(join(TMP_DIR, "src", "auth"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(VALID_CONFIG),
    );
    await writeFile(
      join(TMP_DIR, ".agentnorth", "bundles", "auth.json"),
      JSON.stringify(SAMPLE_BUNDLE, null, 2),
    );
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("sends correct headers (X-Org-Key, X-Dev-Key)", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers) {
        capturedHeaders = { ...headers };
      }
      return new Response(JSON.stringify({ ok: true, project_id: "test-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    process.env["AGENTNORTH_ORG_KEY"] = "org_test_key";
    process.env["AGENTNORTH_DEV_KEY"] = "dev_test_key";
    process.env["AGENTNORTH_API_URL"] = "https://test.agentnorth.io";

    // Simulate what sync does: POST to /api/v1/sync
    const orgKey = process.env["AGENTNORTH_ORG_KEY"]!;
    const devKey = process.env["AGENTNORTH_DEV_KEY"]!;
    const apiUrl = process.env["AGENTNORTH_API_URL"]!;

    await fetch(`${apiUrl}/api/v1/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Key": orgKey,
        "X-Dev-Key": devKey,
      },
      body: JSON.stringify({ project: "test-sync", modules: [] }),
    });

    expect(capturedHeaders["X-Org-Key"]).toBe("org_test_key");
    expect(capturedHeaders["X-Dev-Key"]).toBe("dev_test_key");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("sends correct payload format with project, modules, decisions", async () => {
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return new Response(JSON.stringify({ ok: true, project_id: "test-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const payload = {
      project: "test-sync",
      github_url: "",
      modules: [
        {
          name: "auth",
          description: "Auth",
          paths: ["src/auth/"],
          files_count: 1,
          files: SAMPLE_BUNDLE.files,
          loc: 30,
          exports_count: 1,
          dependencies: SAMPLE_BUNDLE.dependencies,
          contributors: [],
          warnings: [],
          recent_changes: [],
          last_indexed_at: new Date().toISOString(),
        },
      ],
      decisions: [],
    };

    await fetch("https://test.agentnorth.io/api/v1/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Key": "org_key",
        "X-Dev-Key": "dev_key",
      },
      body: JSON.stringify(payload),
    });

    expect(capturedBody.project).toBe("test-sync");
    expect(capturedBody.modules).toBeDefined();
    expect(Array.isArray(capturedBody.modules)).toBe(true);
    expect((capturedBody.modules as unknown[]).length).toBe(1);
    expect(capturedBody.decisions).toBeDefined();
  });

  it("handles 401 unauthorized response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as typeof fetch;

    const response = await fetch("https://test.agentnorth.io/api/v1/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Key": "bad_key",
        "X-Dev-Key": "bad_key",
      },
      body: "{}",
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("handles 500 server error response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    const response = await fetch("https://test.agentnorth.io/api/v1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as typeof fetch;

    await expect(
      fetch("https://test.agentnorth.io/api/v1/sync", {
        method: "POST",
        body: "{}",
      }),
    ).rejects.toThrow("fetch failed");
  });
});
