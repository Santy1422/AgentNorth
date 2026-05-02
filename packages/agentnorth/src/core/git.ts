import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RecentChange } from "./types.js";

const exec = promisify(execFile);

// In-memory cache for batch git operations (per CLI session)
const lastModifiedCache = new Map<string, Map<string, string>>();
const authorsCache = new Map<string, Map<string, { author: string; lines: number }[]>>();

function getCacheKey(rootDir: string, paths: string[]): string {
  return `${rootDir}::${paths.sort().join(",")}`;
}

export async function getRecentChanges(
  rootDir: string,
  paths: string[],
  limit = 10,
): Promise<RecentChange[]> {
  try {
    const args = [
      "log",
      `--max-count=${limit}`,
      "--format=%H|%aI|%an|%s",
      "--name-only",
      "--",
      ...paths,
    ];

    const { stdout } = await exec("git", args, {
      cwd: rootDir,
      timeout: 5000,
    });

    return parseGitLog(stdout);
  } catch (err) {
    console.error(`[agentnorth] Warning: git log failed for paths [${paths.join(", ")}]:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function parseGitLog(output: string): RecentChange[] {
  const changes: RecentChange[] = [];
  const lines = output.trim().split("\n");
  let current: Partial<RecentChange> | null = null;

  for (const line of lines) {
    if (line.includes("|")) {
      // Header line: hash|date|author|summary
      if (current?.commit) {
        changes.push(current as RecentChange);
      }
      const [commit, date, author, summary] = line.split("|");
      current = {
        commit: commit?.slice(0, 8) ?? "",
        date: date ?? "",
        author: author ?? "",
        summary: summary ?? "",
        files_changed: [],
      };
    } else if (line.trim() && current) {
      current.files_changed!.push(line.trim());
    }
  }

  if (current?.commit) {
    changes.push(current as RecentChange);
  }

  return changes;
}

export async function getFileAuthors(
  rootDir: string,
  filePath: string,
): Promise<{ author: string; lines: number }[]> {
  try {
    const { stdout } = await exec("git", ["blame", "--porcelain", filePath], {
      cwd: rootDir,
      timeout: 5000,
    });

    const counts = new Map<string, number>();
    const lines = stdout.split("\n");

    for (const line of lines) {
      if (line.startsWith("author ")) {
        const author = line.slice(7).trim();
        counts.set(author, (counts.get(author) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([author, lines]) => ({ author, lines }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 3);
  } catch (err) {
    console.error(`[agentnorth] Warning: git blame failed for ${filePath}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getFileLastModified(
  rootDir: string,
  filePath: string,
): Promise<string> {
  try {
    const { stdout } = await exec(
      "git",
      ["log", "-1", "--format=%aI", "--", filePath],
      { cwd: rootDir, timeout: 5000 },
    );

    return stdout.trim();
  } catch (err) {
    console.error(`[agentnorth] Warning: git log -1 failed for ${filePath}:`, err instanceof Error ? err.message : err);
    return "";
  }
}

/**
 * Batch: get last modified dates for multiple files in a single git log call.
 * Returns a Map<filePath, isoDateString>.
 */
export async function getFilesLastModified(
  rootDir: string,
  filePaths: string[],
): Promise<Map<string, string>> {
  if (filePaths.length === 0) return new Map();

  const cacheKey = getCacheKey(rootDir, filePaths);
  const cached = lastModifiedCache.get(cacheKey);
  if (cached) return cached;

  const result = new Map<string, string>();

  try {
    // Use git log with --name-only to get dates and associated files
    // --diff-filter=ACDMRT filters to real changes
    const { stdout } = await exec(
      "git",
      ["log", "--format=%aI", "--name-only", "--", ...filePaths],
      { cwd: rootDir, timeout: 15000, maxBuffer: 10 * 1024 * 1024 },
    );

    const lines = stdout.trim().split("\n");
    let currentDate = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ISO date lines look like 2024-01-15T10:30:00+00:00
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        currentDate = trimmed;
      } else if (currentDate && trimmed) {
        // It's a filename — only store the first (most recent) date per file
        if (!result.has(trimmed)) {
          result.set(trimmed, currentDate);
        }
      }
    }
  } catch (err) {
    console.error("[agentnorth] Warning: batch getFilesLastModified failed:", err instanceof Error ? err.message : err);
  }

  lastModifiedCache.set(cacheKey, result);
  return result;
}

/**
 * Batch: approximate authors for multiple files using git log instead of
 * individual git blame calls. Uses git log --format='%an' --name-only to
 * count commits per author per file as a proxy for line ownership.
 * Returns a Map<filePath, authors[]>.
 */
export async function getFilesAuthors(
  rootDir: string,
  filePaths: string[],
): Promise<Map<string, { author: string; lines: number }[]>> {
  if (filePaths.length === 0) return new Map();

  const cacheKey = getCacheKey(rootDir, filePaths);
  const cached = authorsCache.get(cacheKey);
  if (cached) return cached;

  // Map<filePath, Map<author, commitCount>>
  const fileCounts = new Map<string, Map<string, number>>();

  try {
    const { stdout } = await exec(
      "git",
      ["log", "--format=%an", "--name-only", "--", ...filePaths],
      { cwd: rootDir, timeout: 15000, maxBuffer: 10 * 1024 * 1024 },
    );

    const lines = stdout.trim().split("\n");
    let currentAuthor = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // If this line doesn't look like a file path (no dots/slashes), it's an author name
      // Heuristic: author lines don't contain '/' and don't have file extensions
      // But safer: the format alternates author\n\nfile1\nfile2\n\nauthor...
      // Actually with --format=%an --name-only, output is:
      //   AuthorName
      //   (blank)
      //   file1
      //   file2
      //   (blank)
      //   AuthorName
      //   ...
      // Wait, --name-only adds filenames after each commit's header.
      // Let's re-parse: lines with no path separators and no dots are likely author names.
      if (!trimmed.includes("/") && !trimmed.includes(".")) {
        currentAuthor = trimmed;
      } else if (currentAuthor) {
        if (!fileCounts.has(trimmed)) {
          fileCounts.set(trimmed, new Map());
        }
        const authorMap = fileCounts.get(trimmed)!;
        authorMap.set(currentAuthor, (authorMap.get(currentAuthor) ?? 0) + 1);
      }
    }
  } catch (err) {
    console.error("[agentnorth] Warning: batch getFilesAuthors failed:", err instanceof Error ? err.message : err);
  }

  const result = new Map<string, { author: string; lines: number }[]>();

  for (const [file, authorMap] of fileCounts) {
    const authors = [...authorMap.entries()]
      .map(([author, lines]) => ({ author, lines }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 3);
    result.set(file, authors);
  }

  authorsCache.set(cacheKey, result);
  return result;
}

export async function getFileChangeFrequency(
  rootDir: string,
  paths: string[],
): Promise<Record<string, number>> {
  try {
    const { stdout } = await exec(
      "git",
      [
        "log",
        "--name-only",
        "--format=",
        "--since=3 months ago",
        "--",
        ...paths,
      ],
      { cwd: rootDir, timeout: 5000 },
    );

    const counts: Record<string, number> = {};

    for (const line of stdout.split("\n")) {
      const file = line.trim();
      if (file) {
        counts[file] = (counts[file] ?? 0) + 1;
      }
    }

    return counts;
  } catch (err) {
    console.error(`[agentnorth] Warning: git log --name-only failed for paths [${paths.join(", ")}]:`, err instanceof Error ? err.message : err);
    return {};
  }
}

export async function getContributors(
  rootDir: string,
  paths: string[],
): Promise<{ name: string; commits: number; last_active: string }[]> {
  try {
    const { stdout } = await exec(
      "git",
      ["shortlog", "-sne", "--since=6 months ago", "--", ...paths],
      { cwd: rootDir, timeout: 5000 },
    );

    const entries: { name: string; commits: number }[] = [];

    for (const line of stdout.split("\n")) {
      const match = line.trim().match(/^(\d+)\t(.+?)\s+<.+>$/);
      if (match) {
        entries.push({
          name: match[2].trim(),
          commits: Number.parseInt(match[1], 10),
        });
      }
    }

    const results: { name: string; commits: number; last_active: string }[] =
      [];

    for (const entry of entries.slice(0, 10)) {
      let last_active = "";
      try {
        const { stdout: dateOut } = await exec(
          "git",
          [
            "log",
            "-1",
            "--format=%aI",
            `--author=${entry.name}`,
            "--",
            ...paths,
          ],
          { cwd: rootDir, timeout: 5000 },
        );
        last_active = dateOut.trim();
      } catch (err) {
        console.error(`[agentnorth] Warning: git log --author failed for ${entry.name}:`, err instanceof Error ? err.message : err);
      }

      results.push({ name: entry.name, commits: entry.commits, last_active });
    }

    return results.sort((a, b) => b.commits - a.commits);
  } catch (err) {
    console.error(`[agentnorth] Warning: git shortlog failed for paths [${paths.join(", ")}]:`, err instanceof Error ? err.message : err);
    return [];
  }
}
