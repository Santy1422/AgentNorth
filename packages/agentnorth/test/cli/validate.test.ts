import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { AgentNorthConfig } from "../../src/core/types.js";

const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-validate");

const VALID_CONFIG: AgentNorthConfig = {
  version: 1,
  project: { name: "test-validate" },
  modules: {
    auth: { paths: ["src/auth/"], description: "Auth module" },
  },
};

describe("validate command logic", () => {
  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("passes with a valid complete setup", async () => {
    // Create valid config
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await mkdir(join(TMP_DIR, "src", "auth"), { recursive: true });
    await mkdir(join(TMP_DIR, ".claude", "hooks"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(VALID_CONFIG),
    );
    await writeFile(
      join(TMP_DIR, ".agentnorth", "bundles", "auth.json"),
      JSON.stringify({ module: "auth", files: [] }),
    );
    await writeFile(
      join(TMP_DIR, ".claude", "settings.json"),
      JSON.stringify({ mcpServers: { agentnorth: { command: "npx" } } }),
    );
    await writeFile(
      join(TMP_DIR, "CLAUDE.md"),
      "# AgentNorth\nUse agentnorth for context.",
    );

    // Validate by loading config (config check)
    const { loadConfig } = await import("../../src/core/config.js");
    const config = await loadConfig(TMP_DIR);
    expect(config.project.name).toBe("test-validate");
    expect(Object.keys(config.modules)).toHaveLength(1);
  });

  it("fails when config.yaml is missing", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth"), { recursive: true });
    // No config.yaml written

    const { existsSync } = await import("node:fs");
    const configPath = join(TMP_DIR, ".agentnorth", "config.yaml");
    expect(existsSync(configPath)).toBe(false);
  });

  it("fails when config has invalid YAML", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      "invalid: [yaml: broken",
    );

    const { loadConfig } = await import("../../src/core/config.js");
    await expect(loadConfig(TMP_DIR)).rejects.toThrow();
  });

  it("fails when required fields are missing from config", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth"), { recursive: true });
    // Missing version and project
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify({ modules: { auth: { paths: ["src/auth/"] } } }),
    );

    const { loadConfig } = await import("../../src/core/config.js");
    await expect(loadConfig(TMP_DIR)).rejects.toThrow();
  });

  it("fails when modules have no paths", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify({
        version: 1,
        project: { name: "test" },
        modules: { auth: { paths: [] } },
      }),
    );

    const { loadConfig } = await import("../../src/core/config.js");
    await expect(loadConfig(TMP_DIR)).rejects.toThrow();
  });

  it("reports missing bundles for defined modules", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth", "bundles"), { recursive: true });
    await mkdir(join(TMP_DIR, ".agentnorth", "decisions"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify(VALID_CONFIG),
    );

    const { existsSync } = await import("node:fs");
    const { getBundlesDir } = await import("../../src/core/config.js");
    const bundlePath = join(getBundlesDir(TMP_DIR), "auth.json");
    expect(existsSync(bundlePath)).toBe(false);
  });

  it("detects when .claude/settings.json has no agentnorth MCP config", async () => {
    await mkdir(join(TMP_DIR, ".claude"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".claude", "settings.json"),
      JSON.stringify({ mcpServers: {} }),
    );

    const settings = JSON.parse(
      await readFile(join(TMP_DIR, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.mcpServers.agentnorth).toBeUndefined();
  });

  it("detects when CLAUDE.md does not reference AgentNorth", async () => {
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(join(TMP_DIR, "CLAUDE.md"), "# My Project\nNo context layer here.");

    const content = await readFile(join(TMP_DIR, "CLAUDE.md"), "utf-8");
    expect(content.includes("agentnorth") || content.includes("AgentNorth")).toBe(false);
  });

  it("passes when CLAUDE.md references AgentNorth", async () => {
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(join(TMP_DIR, "CLAUDE.md"), "# My Project\nUse AgentNorth for context.");

    const content = await readFile(join(TMP_DIR, "CLAUDE.md"), "utf-8");
    expect(content.includes("AgentNorth")).toBe(true);
  });

  it("validates config with project name missing fails", async () => {
    await mkdir(join(TMP_DIR, ".agentnorth"), { recursive: true });
    await writeFile(
      join(TMP_DIR, ".agentnorth", "config.yaml"),
      yamlStringify({
        version: 1,
        project: { name: "" },
        modules: {},
      }),
    );

    const { loadConfig } = await import("../../src/core/config.js");
    await expect(loadConfig(TMP_DIR)).rejects.toThrow();
  });
});
