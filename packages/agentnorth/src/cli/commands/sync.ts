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
      const files = (bundle.files || []).map((f: {
        path?: string; exports?: string[]; imports?: { source: string; specifiers: string[] }[];
        kind?: string; loc?: number; summary?: string; complexity?: number;
        has_default_export?: boolean; type_exports?: string[]; jsdoc?: string[];
        last_modified?: string; authors?: { author: string; lines: number }[];
        change_frequency?: number;
      }) => ({
        path: f.path || "",
        exports: f.exports || [],
        imports: f.imports || [],
        kind: f.kind || "unknown",
        loc: f.loc || 0,
        summary: f.summary || "",
        complexity: f.complexity || 0,
        has_default_export: f.has_default_export || false,
        type_exports: f.type_exports || [],
        jsdoc: f.jsdoc || [],
        last_modified: f.last_modified || "",
        authors: f.authors || [],
        change_frequency: f.change_frequency || 0,
      }));

      modules.push({
        name,
        description: mod.description || "",
        paths: mod.paths,
        files_count: files.length,
        files,
        loc: files.reduce((sum: number, f: { loc: number }) => sum + f.loc, 0),
        exports_count: files.reduce((sum: number, f: { exports: string[] }) => sum + f.exports.length, 0),
        dependencies: bundle.dependencies || { internal: [], external: [] },
        contributors: bundle.contributors || [],
        warnings: bundle.warnings || [],
        recent_changes: bundle.recent_changes || [],
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

  // Scan package.json files for dependencies + audit
  const deps = await scanDependencies(rootDir);
  const audit = await runAudit(rootDir);

  const payload = {
    project: config.project.name,
    github_url: githubUrl,
    modules,
    deps,
    audit,
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

    // Auto-create/refresh agent session so dashboard shows "en vivo"
    try {
      await fetch(`${apiUrl}/api/v1/sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Org-Key": orgKey,
          "X-Dev-Key": devKey,
        },
        body: JSON.stringify({ repo: config.project.name }),
      });
    } catch {}
  } catch (e: unknown) {
    console.error(`[agentnorth] Sync error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

interface AuditVuln {
  name: string;
  severity: string;
  title: string;
  url: string;
  range: string;
}

async function runAudit(rootDir: string): Promise<AuditVuln[]> {
  const vulns: AuditVuln[] = [];
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);

    // Try npm audit first
    const { stdout } = await exec("npm", ["audit", "--json"], { cwd: rootDir }).catch(() => ({ stdout: "{}" }));
    const data = JSON.parse(stdout);
    const vulnerabilities = data.vulnerabilities || {};

    for (const [name, info] of Object.entries(vulnerabilities) as [string, { severity?: string; via?: { title?: string; url?: string }[]; range?: string }][]) {
      const via = Array.isArray(info.via) ? info.via[0] : null;
      vulns.push({
        name,
        severity: info.severity || "unknown",
        title: (via && typeof via === "object" ? via.title : "") || "",
        url: (via && typeof via === "object" ? via.url : "") || "",
        range: info.range || "",
      });
    }
  } catch {}
  return vulns;
}

interface DepInfo {
  name: string;
  version: string;
  kind: "prod" | "dev";
  source: string;
}

async function scanDependencies(rootDir: string): Promise<DepInfo[]> {
  const deps: DepInfo[] = [];
  const seen = new Set<string>();

  // Find all package.json files (max 2 levels deep)
  const candidates = [
    join(rootDir, "package.json"),
  ];

  try {
    const topEntries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of topEntries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        candidates.push(join(rootDir, entry.name, "package.json"));
        try {
          const subEntries = await readdir(join(rootDir, entry.name), { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isDirectory() && !sub.name.startsWith(".") && sub.name !== "node_modules") {
              candidates.push(join(rootDir, entry.name, sub.name, "package.json"));
            }
          }
        } catch {}
      }
    }
  } catch {}

  for (const pkgPath of candidates) {
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      const source = pkgPath.replace(rootDir + "/", "");

      const addDeps = (obj: Record<string, string> | undefined, kind: "prod" | "dev") => {
        if (!obj) return;
        for (const [name, version] of Object.entries(obj)) {
          const key = `${name}@${kind}`;
          if (!seen.has(key)) {
            seen.add(key);
            deps.push({ name, version, kind, source });
          }
        }
      };

      addDeps(pkg.dependencies, "prod");
      addDeps(pkg.devDependencies, "dev");
    } catch {}
  }

  return deps;
}
