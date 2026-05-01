import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentNorthConfig, ContextBundle, FileRef } from "./types.js";
import { scanModule } from "./scanner.js";
import { parseFile, type ParsedFile } from "./parser.js";
import { getRecentChanges } from "./git.js";
import { loadDecisions } from "./decisions.js";
import { extractSchemas } from "./schema-extractor.js";
import { getBundlesDir } from "./config.js";

export async function indexModule(
  rootDir: string,
  moduleName: string,
  config: AgentNorthConfig,
): Promise<ContextBundle> {
  const moduleConfig = config.modules[moduleName];
  if (!moduleConfig) {
    throw new Error(`Module "${moduleName}" not found in config`);
  }

  const files = await scanModule(rootDir, moduleConfig, config.ignore);
  const parsed: ParsedFile[] = [];

  for (const file of files) {
    try {
      const result = await parseFile(file);
      parsed.push(result);
    } catch {
      // Skip files that fail to parse
    }
  }

  // Build FileRef[]
  const fileRefs: FileRef[] = parsed.map((p) => ({
    path: p.path,
    summary: buildSummary(p),
    exports: p.exports,
    imports: p.imports.map((i) => ({ source: i.source, specifiers: i.specifiers })),
    kind: classifyFile(p),
    loc: p.loc,
  }));

  // Resolve dependencies
  const internal = resolveInternalDeps(parsed, config);
  const external = resolveExternalDeps(parsed);

  // Get recent git changes
  const recentChanges = await getRecentChanges(rootDir, moduleConfig.paths);

  // Extract schemas
  const tables = await extractSchemas(files);

  // Load decisions for this module
  const decisions = await loadDecisions(rootDir, moduleName);

  const bundle: ContextBundle = {
    module: moduleName,
    files: fileRefs,
    schema: { tables, mermaid: "" },
    dependencies: { internal, external },
    decisions,
    recent_changes: recentChanges,
    conventions: moduleConfig.description ? [moduleConfig.description] : [],
    warnings: [],
  };

  return bundle;
}

export async function indexAll(
  rootDir: string,
  config: AgentNorthConfig,
): Promise<ContextBundle[]> {
  const bundlesDir = getBundlesDir(rootDir);
  await mkdir(bundlesDir, { recursive: true });

  const bundles: ContextBundle[] = [];

  for (const moduleName of Object.keys(config.modules)) {
    const bundle = await indexModule(rootDir, moduleName, config);
    bundles.push(bundle);

    const bundlePath = join(bundlesDir, `${moduleName}.json`);
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf-8");
  }

  return bundles;
}

function buildSummary(parsed: ParsedFile): string {
  const parts: string[] = [];
  if (parsed.exports.length > 0) {
    parts.push(`exports: ${parsed.exports.slice(0, 5).join(", ")}`);
  }
  if (parsed.classes.length > 0) {
    parts.push(`classes: ${parsed.classes.join(", ")}`);
  }
  parts.push(`${parsed.loc} lines`);
  return parts.join(" · ");
}

function classifyFile(parsed: ParsedFile): FileRef["kind"] {
  const p = parsed.path.toLowerCase();
  const name = p.split("/").pop() || "";

  if (name.includes(".test.") || name.includes(".spec.") || p.includes("/tests/") || p.includes("/__tests__/")) return "test";
  if (name === "page.tsx" || name === "page.ts" || p.includes("/pages/")) return "page";
  if (name === "layout.tsx" || name === "layout.ts") return "page";
  if (p.includes("/api/") && (name === "route.ts" || name === "route.tsx")) return "route";
  if (p.includes("/hooks/") || name.startsWith("use")) return "hook";
  if (p.includes("/models/") || p.includes("/schemas/") || name.endsWith(".schema.ts")) return "model";
  if (p.includes("/components/") || (name.endsWith(".tsx") && parsed.exports.some((e) => /^[A-Z]/.test(e)))) return "component";
  if (p.includes("/lib/") || p.includes("/utils/") || p.includes("/helpers/")) return "lib";
  if (p.includes("/core/") || p.includes("/cli/") || p.includes("/server/")) return "lib";
  if (name.endsWith(".config.ts") || name.endsWith(".config.js") || name === "config.yaml") return "config";
  if (name.endsWith(".sql") || name.endsWith(".prisma")) return "schema";

  // Default: if it exports PascalCase names and is tsx, it's a component
  if (name.endsWith(".tsx") && parsed.exports.some((e) => /^[A-Z]/.test(e))) return "component";

  return "unknown";
}

function resolveInternalDeps(
  parsed: ParsedFile[],
  config: AgentNorthConfig,
): string[] {
  const moduleNames = Object.keys(config.modules);
  const deps = new Set<string>();

  for (const file of parsed) {
    for (const imp of file.imports) {
      if (imp.isRelative) continue;
      // Check if import source matches any module path pattern
      for (const modName of moduleNames) {
        const modConfig = config.modules[modName]!;
        if (modConfig.paths.some((p) => imp.source.includes(p.replace(/\/$/, "")))) {
          deps.add(modName);
        }
      }
    }
  }

  return [...deps];
}

function resolveExternalDeps(parsed: ParsedFile[]): string[] {
  const deps = new Set<string>();

  for (const file of parsed) {
    for (const imp of file.imports) {
      if (imp.isRelative) continue;
      // Extract package name (handle scoped packages)
      const source = imp.source;
      if (source.startsWith("@")) {
        const parts = source.split("/");
        if (parts.length >= 2) deps.add(`${parts[0]}/${parts[1]}`);
      } else {
        const parts = source.split("/");
        if (parts[0]) deps.add(parts[0]);
      }
    }
  }

  // Filter out node builtins
  const builtins = new Set(["node", "fs", "path", "crypto", "http", "https", "url", "util", "stream", "events", "os", "child_process"]);
  return [...deps].filter((d) => !builtins.has(d) && !d.startsWith("node:"));
}
