import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getChangelogDir } from "./config.js";
import type { LogChangeInput } from "../schemas/decision.js";

export interface ChangelogEntry {
  date: string;
  author: string;
  module: string;
  summary: string;
  files_changed: string[];
  breaking: boolean;
  notes?: string;
}

export async function writeChangelog(
  rootDir: string,
  input: LogChangeInput,
  author: string,
): Promise<ChangelogEntry> {
  const dir = getChangelogDir(rootDir);
  await mkdir(dir, { recursive: true });

  const now = new Date();
  const date = now.toISOString();
  const filename = `${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

  const entry: ChangelogEntry = {
    date,
    author,
    module: input.module,
    summary: input.summary,
    files_changed: input.files_changed,
    breaking: input.breaking ?? false,
    notes: input.notes,
  };

  const content = formatChangelogMarkdown(entry);
  await writeFile(join(dir, filename), content, "utf-8");

  return entry;
}

function formatChangelogMarkdown(e: ChangelogEntry): string {
  let md = `---
date: ${e.date}
author: ${e.author}
module: ${e.module}
breaking: ${e.breaking}
files_changed:
${e.files_changed.map((f) => `  - ${f}`).join("\n")}
---

# ${e.summary}
`;

  if (e.notes) {
    md += `\n## Notas\n${e.notes}\n`;
  }

  return md;
}
