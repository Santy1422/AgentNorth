import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { AgentNorthConfig } from "../../core/types.js";
import { getAgentNorthDir } from "../../core/config.js";

export async function initCommand(_opts: { interactive?: boolean }) {
  const rootDir = process.cwd();
  const agentnorthDir = getAgentNorthDir(rootDir);

  console.error("[agentnorth] Initializing in", rootDir);

  // Detect scenario
  const scenario = await detectScenario(rootDir);
  console.error(`[agentnorth] Detected scenario: ${scenario}`);

  // Detect modules from directory structure
  const modules = await detectModules(rootDir);
  console.error(`[agentnorth] Found ${Object.keys(modules).length} candidate modules`);

  // Generate config
  const config: AgentNorthConfig = {
    version: 1,
    project: {
      name: inferProjectName(rootDir),
    },
    modules,
    ignore: ["node_modules/", "dist/", "*.test.ts", "*.spec.ts"],
  };

  // Write files
  await mkdir(agentnorthDir, { recursive: true });
  await mkdir(join(agentnorthDir, "bundles"), { recursive: true });
  await mkdir(join(agentnorthDir, "decisions"), { recursive: true });
  await mkdir(join(agentnorthDir, "changelog"), { recursive: true });

  const configPath = join(agentnorthDir, "config.yaml");
  await writeFile(configPath, yamlStringify(config), "utf-8");

  console.error(`[agentnorth] Created .agentnorth/config.yaml with ${Object.keys(modules).length} modules`);
  console.error("[agentnorth] Run `agentnorth index` to generate bundles.");
}

type Scenario = "A" | "B" | "C";

async function detectScenario(rootDir: string): Promise<Scenario> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const hasDocs = entries.some(
    (e) =>
      (e.name === "docs" && e.isDirectory()) ||
      (e.name === "README.md" && e.isFile()),
  );
  const hasSrc = entries.some(
    (e) => (e.name === "src" || e.name === "app" || e.name === "packages") && e.isDirectory(),
  );

  if (hasDocs && hasSrc) return "C";
  if (hasSrc) return "B";
  return "A";
}

async function detectModules(rootDir: string): Promise<AgentNorthConfig["modules"]> {
  const modules: AgentNorthConfig["modules"] = {};

  // Try src/ first
  const candidates = ["src", "app", "packages", "lib"];
  for (const candidate of candidates) {
    try {
      const entries = await readdir(join(rootDir, candidate), { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_")) {
          modules[entry.name] = {
            paths: [`${candidate}/${entry.name}/`],
          };
        }
      }
      if (Object.keys(modules).length > 0) break;
    } catch {
      continue;
    }
  }

  // Fallback: use top-level if nothing found
  if (Object.keys(modules).length === 0) {
    modules["main"] = { paths: ["./"] };
  }

  return modules;
}

function inferProjectName(rootDir: string): string {
  return rootDir.split("/").pop() ?? "project";
}
