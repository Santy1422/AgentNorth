import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { stringify } from "yaml";

const FIXTURE_DIR = join(import.meta.dirname, "../fixtures/repo-setup");

describe("setup command", () => {
  beforeEach(async () => {
    await mkdir(join(FIXTURE_DIR, ".agentnorth"), { recursive: true });
    const config = {
      version: 1,
      project: { name: "test-project" },
      modules: { auth: { paths: ["src/auth"] } },
      enforcement: {
        level: "soft",
        track_sessions: true,
        require_log_change: true,
        require_log_decision: false,
      },
    };
    await writeFile(
      join(FIXTURE_DIR, ".agentnorth", "config.yaml"),
      stringify(config),
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });

  it("generates .claude/hooks directory with 4 scripts", async () => {
    // Import dynamically to use fresh state
    const { setupCommand } = await import("../../src/cli/commands/setup.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;
    try {
      await setupCommand();
    } finally {
      process.cwd = origCwd;
    }

    const hooksDir = join(FIXTURE_DIR, ".claude", "hooks");
    expect(existsSync(join(hooksDir, "agentnorth-session-start.sh"))).toBe(true);
    expect(existsSync(join(hooksDir, "agentnorth-enforce-context.sh"))).toBe(true);
    expect(existsSync(join(hooksDir, "agentnorth-track-usage.sh"))).toBe(true);
    expect(existsSync(join(hooksDir, "agentnorth-session-end.sh"))).toBe(true);
  });

  it("generates settings.json with MCP and hooks config", async () => {
    const { setupCommand } = await import("../../src/cli/commands/setup.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;
    try {
      await setupCommand();
    } finally {
      process.cwd = origCwd;
    }

    const settings = JSON.parse(
      await readFile(join(FIXTURE_DIR, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.mcpServers.agentnorth).toBeDefined();
    expect(settings.hooks.SessionStart).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeDefined();
    expect(settings.hooks.PostToolUse).toBeDefined();
    expect(settings.hooks.Stop).toBeDefined();
  });

  it("respects strict enforcement level", async () => {
    // Rewrite config with strict level
    const config = {
      version: 1,
      project: { name: "test-project" },
      modules: { auth: { paths: ["src/auth"] } },
      enforcement: {
        level: "strict",
        track_sessions: true,
        require_log_change: true,
        require_log_decision: false,
      },
    };
    await writeFile(
      join(FIXTURE_DIR, ".agentnorth", "config.yaml"),
      stringify(config),
      "utf-8",
    );

    const { setupCommand } = await import("../../src/cli/commands/setup.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;
    try {
      await setupCommand();
    } finally {
      process.cwd = origCwd;
    }

    const enforceHook = await readFile(
      join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-enforce-context.sh"),
      "utf-8",
    );
    expect(enforceHook).toContain('"permissionDecision": "deny"');
    expect(enforceHook).toContain("Enforcement level: strict");
  });

  it("generates CLAUDE.md when it does not exist", async () => {
    const { setupCommand } = await import("../../src/cli/commands/setup.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;
    try {
      await setupCommand();
    } finally {
      process.cwd = origCwd;
    }

    const claudeMd = await readFile(join(FIXTURE_DIR, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("AgentNorth");
    expect(claudeMd).toContain("agentnorth_get_context");
  });
});
