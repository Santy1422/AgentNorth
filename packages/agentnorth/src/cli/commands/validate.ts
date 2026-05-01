import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, getAgentNorthDir, getBundlesDir, getDecisionsDir } from "../../core/config.js";

interface ValidationResult {
  ok: boolean;
  checks: { name: string; status: "pass" | "warn" | "fail"; message: string }[];
}

export async function validateCommand(): Promise<void> {
  const rootDir = process.cwd();
  const result = await validate(rootDir);

  for (const check of result.checks) {
    const icon = check.status === "pass" ? "+" : check.status === "warn" ? "!" : "x";
    console.error(`  [${icon}] ${check.name}: ${check.message}`);
  }

  const passed = result.checks.filter((c) => c.status === "pass").length;
  const warned = result.checks.filter((c) => c.status === "warn").length;
  const failed = result.checks.filter((c) => c.status === "fail").length;

  console.error(
    `\n  ${passed} passed, ${warned} warnings, ${failed} failed`,
  );

  if (failed > 0) process.exitCode = 1;
}

async function validate(rootDir: string): Promise<ValidationResult> {
  const checks: ValidationResult["checks"] = [];

  // 1. Config exists
  const agentnorthDir = getAgentNorthDir(rootDir);
  const configPath = join(agentnorthDir, "config.yaml");
  if (!existsSync(configPath)) {
    checks.push({ name: "config", status: "fail", message: ".agentnorth/config.yaml not found. Run `agentnorth init`." });
    return { ok: false, checks };
  }
  checks.push({ name: "config", status: "pass", message: ".agentnorth/config.yaml exists" });

  // 2. Config is valid
  let config;
  try {
    config = await loadConfig(rootDir);
    checks.push({ name: "config-valid", status: "pass", message: `${Object.keys(config.modules).length} modules defined` });
  } catch (e: any) {
    checks.push({ name: "config-valid", status: "fail", message: `Invalid config: ${e.message}` });
    return { ok: false, checks };
  }

  // 3. Bundles exist for all modules
  const bundlesDir = getBundlesDir(rootDir);
  const moduleNames = Object.keys(config.modules);
  let bundlesOk = 0;
  let bundlesMissing: string[] = [];

  for (const name of moduleNames) {
    const bundlePath = join(bundlesDir, `${name}.json`);
    if (existsSync(bundlePath)) {
      bundlesOk++;
    } else {
      bundlesMissing.push(name);
    }
  }

  if (bundlesMissing.length === 0) {
    checks.push({ name: "bundles", status: "pass", message: `${bundlesOk}/${moduleNames.length} modules indexed` });
  } else if (bundlesMissing.length === moduleNames.length) {
    checks.push({ name: "bundles", status: "fail", message: `No bundles found. Run \`agentnorth index\`.` });
  } else {
    checks.push({ name: "bundles", status: "warn", message: `${bundlesMissing.length} modules not indexed: ${bundlesMissing.join(", ")}` });
  }

  // 4. Bundle freshness (check if source files are newer than bundle)
  for (const name of moduleNames) {
    const bundlePath = join(bundlesDir, `${name}.json`);
    if (!existsSync(bundlePath)) continue;

    const bundleStat = await stat(bundlePath);
    const mod = config.modules[name];
    let stale = false;

    for (const p of mod.paths) {
      const fullPath = join(rootDir, p);
      if (existsSync(fullPath)) {
        const dirStat = await stat(fullPath);
        if (dirStat.mtimeMs > bundleStat.mtimeMs) {
          stale = true;
          break;
        }
      }
    }

    if (stale) {
      checks.push({ name: `freshness:${name}`, status: "warn", message: `Bundle may be stale. Run \`agentnorth index --module ${name}\`.` });
    }
  }

  // 5. Enforcement setup
  const claudeSettings = join(rootDir, ".claude", "settings.json");
  if (existsSync(claudeSettings)) {
    try {
      const settings = JSON.parse(await readFile(claudeSettings, "utf-8"));
      if (settings.mcpServers?.agentnorth) {
        checks.push({ name: "enforcement", status: "pass", message: "MCP server configured in .claude/settings.json" });
      } else {
        checks.push({ name: "enforcement", status: "warn", message: ".claude/settings.json exists but agentnorth MCP not configured. Run `agentnorth setup`." });
      }
    } catch {
      checks.push({ name: "enforcement", status: "warn", message: ".claude/settings.json is invalid JSON" });
    }
  } else {
    checks.push({ name: "enforcement", status: "warn", message: "No .claude/settings.json. Run `agentnorth setup` for enforcement." });
  }

  // 6. CLAUDE.md
  const claudeMd = join(rootDir, "CLAUDE.md");
  if (existsSync(claudeMd)) {
    const content = await readFile(claudeMd, "utf-8");
    if (content.includes("agentnorth") || content.includes("AgentNorth")) {
      checks.push({ name: "claude-md", status: "pass", message: "CLAUDE.md references AgentNorth" });
    } else {
      checks.push({ name: "claude-md", status: "warn", message: "CLAUDE.md exists but doesn't reference AgentNorth" });
    }
  } else {
    checks.push({ name: "claude-md", status: "warn", message: "No CLAUDE.md. Run `agentnorth setup`." });
  }

  // 7. Decisions directory
  const decisionsDir = getDecisionsDir(rootDir);
  if (existsSync(decisionsDir)) {
    checks.push({ name: "decisions", status: "pass", message: "Decisions directory exists" });
  }

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, checks };
}
