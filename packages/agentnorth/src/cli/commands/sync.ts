import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, getBundlesDir, getDecisionsDir } from "../../core/config.js";
import { loadDecisions } from "../../core/decisions.js";

export async function syncCommand(): Promise<void> {
  const rootDir = process.cwd();

  const orgKey = process.env["AGENTNORTH_ORG_KEY"];
  const devKey = process.env["AGENTNORTH_DEV_KEY"];
  const apiUrl = process.env["AGENTNORTH_API_URL"] || "https://agentnorth.io";

  if (!orgKey || !devKey) {
    console.error("[agentnorth] Error: AGENTNORTH_ORG_KEY and AGENTNORTH_DEV_KEY must be set.");
    console.error("  Set them in your environment or in ~/.claude/settings.json");
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const bundlesDir = getBundlesDir(rootDir);

  // Read all bundles
  const modules = [];
  for (const [name, mod] of Object.entries(config.modules)) {
    const bundlePath = join(bundlesDir, `${name}.json`);
    if (existsSync(bundlePath)) {
      const bundle = JSON.parse(await readFile(bundlePath, "utf-8"));
      modules.push({
        name,
        description: mod.description || "",
        paths: mod.paths,
        files_count: bundle.files?.length || 0,
        loc: bundle.files?.reduce((sum: number, f: any) => sum + (f.loc || 0), 0) || 0,
        exports_count: bundle.files?.reduce((sum: number, f: any) => sum + (f.exports?.length || 0), 0) || 0,
        dependencies: bundle.dependencies || { internal: [], external: [] },
        schema: {
          tables: bundle.schema?.tables || [],
          mermaid_erd: bundle.schema?.mermaid || "",
        },
        last_indexed_at: new Date().toISOString(),
      });
    }
  }

  // Read decisions
  const decisions = await loadDecisions(rootDir);

  // Get git info
  let githubUrl = "";
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], { cwd: rootDir });
    githubUrl = stdout.trim();
  } catch {}

  const payload = {
    project: config.project.name,
    github_url: githubUrl,
    modules,
    decisions: decisions.map((d) => ({
      module: d.module,
      title: d.title,
      context: d.context,
      decision: d.decision,
      author: d.author,
      status: d.status,
      date: d.date,
    })),
  };

  console.error(`[agentnorth] Syncing ${modules.length} modules, ${decisions.length} decisions to ${apiUrl}...`);

  try {
    const response = await fetch(`${apiUrl}/api/v1/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Key": orgKey,
        "X-Dev-Key": devKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[agentnorth] Sync failed (${response.status}): ${text}`);
      process.exit(1);
    }

    const result = await response.json();
    console.error(`[agentnorth] Synced successfully. Project ID: ${result.project_id}`);
  } catch (e: any) {
    console.error(`[agentnorth] Sync error: ${e.message}`);
    process.exit(1);
  }
}
