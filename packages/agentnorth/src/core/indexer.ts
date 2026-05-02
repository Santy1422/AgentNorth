import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentNorthConfig, ContextBundle, FileRef, Contributor } from "./types.js";
import { scanModule } from "./scanner.js";
import { parseFile, type ParsedFile } from "./parser.js";
import { getRecentChanges, getFileLastModified, getFileAuthors, getFileChangeFrequency, getContributors } from "./git.js";
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

  // Get change frequency for all paths at once (batch)
  const changeFreq = await getFileChangeFrequency(rootDir, moduleConfig.paths);

  // Get contributors for the module
  let contributors: Contributor[] = [];
  try {
    contributors = await getContributors(rootDir, moduleConfig.paths);
  } catch {}

  // Build FileRef[] with enriched data
  const fileRefs: FileRef[] = [];
  for (const p of parsed) {
    const lastMod = await getFileLastModified(rootDir, p.path);
    const authors = await getFileAuthors(rootDir, p.path);

    fileRefs.push({
      path: p.path,
      summary: buildSummary(p),
      exports: p.exports,
      imports: p.imports.map((i) => ({ source: i.source, specifiers: i.specifiers })),
      kind: classifyFile(p),
      loc: p.loc,
      complexity: p.complexity,
      has_default_export: p.hasDefaultExport,
      type_exports: p.typeExports,
      jsdoc: p.jsdoc?.length > 0 ? p.jsdoc : undefined,
      last_modified: lastMod || undefined,
      authors: authors.length > 0 ? authors : undefined,
      change_frequency: changeFreq[p.path] || undefined,
    });
  }

  // Resolve dependencies
  const internal = resolveInternalDeps(parsed, config);
  const external = resolveExternalDeps(parsed);

  // Get recent git changes
  const recentChanges = await getRecentChanges(rootDir, moduleConfig.paths);

  // Extract schemas
  const tables = await extractSchemas(files);

  // Load decisions for this module
  const decisions = await loadDecisions(rootDir, moduleName);

  // Generate smart warnings
  const warnings = generateWarnings(fileRefs, internal, external);

  const bundle: ContextBundle = {
    module: moduleName,
    files: fileRefs,
    schema: { tables, mermaid: "" },
    dependencies: { internal, external },
    decisions,
    recent_changes: recentChanges,
    contributors,
    conventions: moduleConfig.description ? [moduleConfig.description] : [],
    warnings,
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
  if (parsed.functions.length > 0 && parsed.functions.length <= 3) {
    parts.push(`fns: ${parsed.functions.join(", ")}`);
  } else if (parsed.functions.length > 3) {
    parts.push(`${parsed.functions.length} functions`);
  }
  if (parsed.jsdoc && parsed.jsdoc.length > 0) {
    // Use first jsdoc comment as primary description
    const firstDoc = parsed.jsdoc[0]!.slice(0, 120);
    parts.unshift(firstDoc);
  }
  parts.push(`${parsed.loc} lines`);
  if (parsed.complexity > 10) {
    parts.push(`complexity: ${parsed.complexity}`);
  }
  return parts.join(" · ");
}

function generateWarnings(files: FileRef[], internalDeps: string[], externalDeps: string[]): string[] {
  const warnings: string[] = [];

  // Large files
  const largeFiles = files.filter((f) => f.loc > 500);
  if (largeFiles.length > 0) {
    warnings.push(`${largeFiles.length} archivo(s) con >500 LOC: ${largeFiles.map((f) => f.path.split("/").pop()).join(", ")}`);
  }

  // High complexity
  const complexFiles = files.filter((f) => (f.complexity || 0) > 15);
  if (complexFiles.length > 0) {
    warnings.push(`${complexFiles.length} archivo(s) con complejidad alta: ${complexFiles.map((f) => f.path.split("/").pop()).join(", ")}`);
  }

  // Files with many imports (high coupling)
  const highCoupling = files.filter((f) => f.imports.length > 10);
  if (highCoupling.length > 0) {
    warnings.push(`${highCoupling.length} archivo(s) con >10 imports (alto acoplamiento)`);
  }

  // Hot files (changed frequently)
  const hotFiles = files.filter((f) => (f.change_frequency || 0) > 5);
  if (hotFiles.length > 0) {
    warnings.push(`${hotFiles.length} archivo(s) cambiados >5 veces en 3 meses (hot files)`);
  }

  // No exports (potential dead code)
  const noExports = files.filter((f) => f.exports.length === 0 && !["page", "route", "test", "config"].includes(f.kind));
  if (noExports.length > 0) {
    warnings.push(`${noExports.length} archivo(s) sin exports (posible codigo muerto)`);
  }

  // Missing documentation
  const undocumented = files.filter((f) => !f.jsdoc || f.jsdoc.length === 0);
  const docPct = files.length > 0 ? Math.round(((files.length - undocumented.length) / files.length) * 100) : 0;
  if (docPct < 30 && files.length > 3) {
    warnings.push(`Solo ${docPct}% de archivos tienen JSDoc — considerar documentar funciones publicas`);
  }

  return warnings;
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
