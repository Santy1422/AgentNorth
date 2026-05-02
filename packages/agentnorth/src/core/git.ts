import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RecentChange } from "./types.js";

const exec = promisify(execFile);

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
  } catch {
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
  } catch {
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
  } catch {
    return "";
  }
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
  } catch {
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
      } catch {
        /* ignore */
      }

      results.push({ name: entry.name, commits: entry.commits, last_active });
    }

    return results.sort((a, b) => b.commits - a.commits);
  } catch {
    return [];
  }
}
