import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, getDecisionsDir } from "../../core/config.js";
import { loadDecisions } from "../../core/decisions.js";

export async function pullCommand(): Promise<void> {
  const rootDir = process.cwd();

  const orgKey = process.env["AGENTNORTH_ORG_KEY"];
  const devKey = process.env["AGENTNORTH_DEV_KEY"];
  const apiUrl = process.env["AGENTNORTH_API_URL"] || "https://agentnorth.io";

  if (!orgKey || !devKey) {
    console.error("[agentnorth] Error: AGENTNORTH_ORG_KEY and AGENTNORTH_DEV_KEY must be set.");
    process.exit(1);
  }

  const config = await loadConfig(rootDir);

  // Read last pull timestamp
  const pullStateFile = join(rootDir, ".agentnorth", ".last-pull");
  let since: string | undefined;
  try {
    since = (await readFile(pullStateFile, "utf-8")).trim();
  } catch {
    // First pull — get everything
  }

  const url = new URL(`${apiUrl}/api/v1/pull`);
  url.searchParams.set("project", config.project.name);
  if (since) url.searchParams.set("since", since);

  console.error(`[agentnorth] Pulling from ${apiUrl}${since ? ` (since ${since})` : " (full pull)"}...`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "X-Org-Key": orgKey,
        "X-Dev-Key": devKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[agentnorth] Pull failed (${response.status}): ${text}`);
      process.exit(1);
    }

    const result = await response.json() as {
      ok: boolean;
      decisions: {
        module: string;
        title: string;
        context: string;
        decision: string;
        author: string;
        status: string;
        date: string;
        source: string;
      }[];
      changes: {
        module: string;
        summary: string;
        files_changed: string[];
        breaking: boolean;
        notes: string;
        author: string;
        date: string;
        source: string;
      }[];
    };

    // Merge decisions: write new ones from dashboard that don't exist locally
    const localDecisions = await loadDecisions(rootDir);
    const localTitles = new Set(localDecisions.map((d) => d.title));
    const decisionsDir = getDecisionsDir(rootDir);
    await mkdir(decisionsDir, { recursive: true });

    let newDecisions = 0;
    let existingFiles: string[];
    try {
      existingFiles = await readdir(decisionsDir);
    } catch {
      existingFiles = [];
    }

    const existingIds = existingFiles
      .filter((f) => f.startsWith("decision-"))
      .map((f) => {
        const match = f.match(/decision-(\d+)/);
        return match ? parseInt(match[1]!, 10) : 0;
      });

    let nextId = (existingIds.length > 0 ? Math.max(...existingIds) : 0) + 1;

    for (const d of result.decisions) {
      // Skip decisions that already exist locally
      if (localTitles.has(d.title)) continue;

      // Only pull decisions created from dashboard (source: "dashboard")
      // or pull all if this is the first pull
      if (since && d.source !== "dashboard") continue;

      const id = `decision-${String(nextId).padStart(3, "0")}`;
      const date = d.date ? new Date(d.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      const content = `---
id: ${id}
date: ${date}
author: ${d.author || "dashboard"}
module: ${d.module || ""}
status: ${d.status || "active"}
source: dashboard
---

# ${d.title}

## Contexto
${d.context || ""}

## Decision
${d.decision || ""}
`;

      await writeFile(join(decisionsDir, `${id}.md`), content, "utf-8");
      newDecisions++;
      nextId++;
      console.error(`  + ${d.title} (${d.module || "global"})`);
    }

    // Save pull timestamp
    await writeFile(pullStateFile, new Date().toISOString(), "utf-8");

    if (newDecisions === 0) {
      console.error("[agentnorth] Up to date — no new decisions from dashboard.");
    } else {
      console.error(`[agentnorth] Pulled ${newDecisions} new decisions from dashboard.`);
    }
  } catch (e: unknown) {
    console.error(`[agentnorth] Pull error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
