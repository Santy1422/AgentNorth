import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, getBundlesDir, getDecisionsDir } from "../../core/config.js";

export async function statusCommand() {
  const rootDir = process.cwd();

  try {
    const config = await loadConfig(rootDir);
    const bundlesDir = getBundlesDir(rootDir);
    const decisionsDir = getDecisionsDir(rootDir);

    console.error(`[agentnorth] Project: ${config.project.name}`);
    console.error(`[agentnorth] Modules: ${Object.keys(config.modules).length}`);
    console.error("");

    for (const [name, mod] of Object.entries(config.modules)) {
      const bundlePath = join(bundlesDir, `${name}.json`);
      let status = "not indexed";
      try {
        const s = await stat(bundlePath);
        const age = Date.now() - s.mtimeMs;
        const ageStr = age < 60000 ? "just now" : `${Math.floor(age / 60000)}m ago`;
        status = `indexed (${ageStr})`;
      } catch {
        // not indexed
      }
      console.error(`  ${name}: ${mod.paths.join(", ")} — ${status}`);
    }

    // Count decisions
    try {
      const decFiles = await readdir(decisionsDir);
      const count = decFiles.filter((f) => f.endsWith(".md")).length;
      console.error(`\n[agentnorth] Decisions: ${count}`);
    } catch {
      console.error("\n[agentnorth] Decisions: 0");
    }
  } catch (e: any) {
    console.error(`[agentnorth] Error: ${e.message}`);
    console.error("[agentnorth] Run `agentnorth init` first.");
    process.exit(1);
  }
}
