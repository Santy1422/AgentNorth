import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { AgentNorthConfigSchema } from "../schemas/config.js";
import type { AgentNorthConfig } from "./types.js";

const CONFIG_DIR = ".agentnorth";
const CONFIG_FILE = "config.yaml";

export async function loadConfig(rootDir: string): Promise<AgentNorthConfig> {
  const configPath = join(rootDir, CONFIG_DIR, CONFIG_FILE);
  const raw = await readFile(configPath, "utf-8");
  const parsed = parseYaml(raw);
  return AgentNorthConfigSchema.parse(parsed);
}

export function getAgentNorthDir(rootDir: string): string {
  return join(rootDir, CONFIG_DIR);
}

export function getBundlesDir(rootDir: string): string {
  return join(rootDir, CONFIG_DIR, "bundles");
}

export function getDecisionsDir(rootDir: string): string {
  return join(rootDir, CONFIG_DIR, "decisions");
}

export function getChangelogDir(rootDir: string): string {
  return join(rootDir, CONFIG_DIR, "changelog");
}
