import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ModuleConfig } from "./types.js";

const DEFAULT_IGNORE = [
  "node_modules",
  "dist",
  ".git",
  ".next",
  "__pycache__",
  ".agentnorth",
];

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".swift", ".php", ".vue", ".svelte",
]);

export interface ScannedFile {
  path: string;
  absolutePath: string;
  extension: string;
}

export async function scanModule(
  rootDir: string,
  moduleConfig: ModuleConfig,
  ignorePatterns: string[] = [],
): Promise<ScannedFile[]> {
  const allIgnore = [...DEFAULT_IGNORE, ...ignorePatterns];
  const files: ScannedFile[] = [];

  for (const modulePath of moduleConfig.paths) {
    const absPath = join(rootDir, modulePath);
    await walkDir(absPath, rootDir, allIgnore, files);
  }

  return files;
}

async function walkDir(
  dir: string,
  rootDir: string,
  ignore: string[],
  result: ScannedFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignore.some((pattern) => entry.name === pattern || entry.name.match(globToRegex(pattern)))) {
      continue;
    }

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkDir(fullPath, rootDir, ignore, result);
    } else if (entry.isFile()) {
      const ext = getExtension(entry.name);
      if (CODE_EXTENSIONS.has(ext)) {
        result.push({
          path: relative(rootDir, fullPath),
          absolutePath: fullPath,
          extension: ext,
        });
      }
    }
  }
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
