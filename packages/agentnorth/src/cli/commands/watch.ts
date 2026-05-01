import { watch } from "node:fs";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../../core/config.js";
import { indexCommand } from "./index.js";
import { syncCommand } from "./sync.js";

export async function watchCommand(): Promise<void> {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir);

  console.error("[agentnorth] Watching for changes...");
  console.error(`  Project: ${config.project.name}`);
  console.error(`  Modules: ${Object.keys(config.modules).join(", ")}`);
  console.error("  Press Ctrl+C to stop.\n");

  // Debounce: avoid multiple syncs for rapid changes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let syncing = false;

  const scheduleSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (syncing) return;
      syncing = true;
      try {
        console.error(`[agentnorth] Change detected, re-indexing...`);
        await indexCommand({});
        console.error(`[agentnorth] Syncing to dashboard...`);
        await syncCommand();
        console.error(`[agentnorth] Synced at ${new Date().toLocaleTimeString()}\n`);
      } catch (e: unknown) {
        console.error(`[agentnorth] Sync error: ${e instanceof Error ? e.message : String(e)}`);
      }
      syncing = false;
    }, 2000); // 2s debounce
  };

  // Watch all module paths
  const watchers: ReturnType<typeof watch>[] = [];

  for (const [name, mod] of Object.entries(config.modules)) {
    for (const p of mod.paths) {
      const fullPath = join(rootDir, p);
      if (!existsSync(fullPath)) continue;

      try {
        const watcher = watch(fullPath, { recursive: true }, (eventType, filename) => {
          // Skip node_modules, .git, dist, etc.
          if (!filename) return;
          if (filename.includes("node_modules")) return;
          if (filename.includes(".git")) return;
          if (filename.includes("dist/")) return;
          if (filename.includes(".next/")) return;

          // Only watch source files
          if (!/\.(tsx?|jsx?|json|yaml|yml|md)$/.test(filename)) return;

          console.error(`  [${name}] ${eventType}: ${filename}`);
          scheduleSync();
        });
        watchers.push(watcher);
      } catch {
        console.error(`  Warning: Could not watch ${fullPath}`);
      }
    }
  }

  // Also watch .agentnorth/decisions/ for local decision changes
  const decisionsDir = join(rootDir, ".agentnorth", "decisions");
  if (existsSync(decisionsDir)) {
    try {
      const watcher = watch(decisionsDir, { recursive: false }, (eventType, filename) => {
        if (!filename || !filename.endsWith(".md")) return;
        console.error(`  [decisions] ${eventType}: ${filename}`);
        scheduleSync();
      });
      watchers.push(watcher);
    } catch {}
  }

  // Keep alive
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.error("\n[agentnorth] Stopping watcher...");
      for (const w of watchers) w.close();
      resolve();
    });
  });
}
