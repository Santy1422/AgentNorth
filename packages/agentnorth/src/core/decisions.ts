import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getDecisionsDir } from "./config.js";
import type { Decision } from "./types.js";
import type { LogDecisionInput } from "../schemas/decision.js";

export async function loadDecisions(
  rootDir: string,
  module?: string,
): Promise<Decision[]> {
  const dir = getDecisionsDir(rootDir);
  let files: string[];

  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const decisions: Decision[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const content = await readFile(join(dir, file), "utf-8");
      const decision = parseDecisionFile(content, file);
      if (decision && (!module || decision.module === module)) {
        decisions.push(decision);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return decisions.sort((a, b) => b.date.localeCompare(a.date));
}

export async function writeDecision(
  rootDir: string,
  input: LogDecisionInput,
  author: string,
): Promise<Decision> {
  const dir = getDecisionsDir(rootDir);
  await mkdir(dir, { recursive: true });

  // Determine next ID
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    files = [];
  }

  const existingIds = files
    .filter((f) => f.startsWith("decision-"))
    .map((f) => {
      const match = f.match(/decision-(\d+)/);
      return match ? parseInt(match[1]!, 10) : 0;
    });

  const nextId = (existingIds.length > 0 ? Math.max(...existingIds) : 0) + 1;
  const id = `decision-${String(nextId).padStart(3, "0")}`;
  const date = new Date().toISOString().split("T")[0]!;

  const decision: Decision = {
    id,
    date,
    author,
    module: input.module,
    title: input.title,
    context: input.context,
    decision: input.decision,
    status: "active",
  };

  const content = formatDecisionMarkdown(decision);
  await writeFile(join(dir, `${id}.md`), content, "utf-8");

  return decision;
}

function formatDecisionMarkdown(d: Decision): string {
  return `---
id: ${d.id}
date: ${d.date}
author: ${d.author}
module: ${d.module}
status: ${d.status}
---

# ${d.title}

## Contexto
${d.context}

## Decision
${d.decision}
`;
}

function parseDecisionFile(content: string, filename: string): Decision | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const fm = frontmatterMatch[1]!;
  const get = (key: string) => {
    const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match?.[1]?.trim() ?? "";
  };

  const id = get("id") || filename.replace(".md", "");
  const date = get("date");
  const author = get("author");
  const module = get("module");
  const status = get("status") as Decision["status"] || "active";

  // Extract title from first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] ?? id;

  // Extract context and decision sections
  const contextMatch = content.match(/## Contexto\n([\s\S]*?)(?=\n## |$)/);
  const decisionMatch = content.match(/## Decision\n([\s\S]*?)(?=\n## |$)/);

  return {
    id,
    date,
    author,
    module,
    title,
    context: contextMatch?.[1]?.trim() ?? "",
    decision: decisionMatch?.[1]?.trim() ?? "",
    status,
  };
}
