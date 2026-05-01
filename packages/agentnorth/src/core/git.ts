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
