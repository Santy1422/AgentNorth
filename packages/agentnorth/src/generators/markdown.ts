import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ContextBundle } from "../core/types.js";

export async function generateModuleDocs(
  rootDir: string,
  bundles: ContextBundle[],
): Promise<void> {
  const docsDir = join(rootDir, ".agentnorth", "docs", "modules");
  await mkdir(docsDir, { recursive: true });

  for (const bundle of bundles) {
    const content = renderModuleDoc(bundle);
    const filePath = join(docsDir, `${bundle.module}.md`);
    await writeFile(filePath, content, "utf-8");
  }
}

function renderModuleDoc(bundle: ContextBundle): string {
  const lines: string[] = [];

  lines.push(`# ${bundle.module}`);
  lines.push("");

  if (bundle.conventions.length > 0) {
    lines.push(`> ${bundle.conventions[0]}`);
    lines.push("");
  }

  // Stats
  const totalLoc = bundle.files.reduce((s, f) => s + f.loc, 0);
  lines.push(`| Stat | Value |`);
  lines.push(`|------|-------|`);
  lines.push(`| Files | ${bundle.files.length} |`);
  lines.push(`| Lines of code | ${totalLoc.toLocaleString()} |`);
  lines.push(`| Decisions | ${bundle.decisions.length} |`);
  lines.push(`| Recent changes | ${bundle.recent_changes.length} |`);
  lines.push("");

  // Dependencies
  if (bundle.dependencies.internal.length > 0 || bundle.dependencies.external.length > 0) {
    lines.push("## Dependencies");
    lines.push("");
    if (bundle.dependencies.internal.length > 0) {
      lines.push("**Internal modules:**");
      for (const dep of bundle.dependencies.internal) {
        lines.push(`- \`${dep}\``);
      }
      lines.push("");
    }
    if (bundle.dependencies.external.length > 0) {
      lines.push("**External packages:**");
      for (const dep of bundle.dependencies.external) {
        lines.push(`- \`${dep}\``);
      }
      lines.push("");
    }
  }

  // Files
  lines.push("## Files");
  lines.push("");
  lines.push("| File | Exports | LOC |");
  lines.push("|------|---------|-----|");
  for (const file of bundle.files) {
    const exports = file.exports.slice(0, 4).join(", ") || "—";
    lines.push(`| \`${file.path}\` | ${exports} | ${file.loc} |`);
  }
  lines.push("");

  // Decisions
  if (bundle.decisions.length > 0) {
    lines.push("## Decisions");
    lines.push("");
    for (const d of bundle.decisions) {
      lines.push(`### ${d.id}: ${d.title}`);
      lines.push("");
      lines.push(`- **Date:** ${d.date}`);
      lines.push(`- **Author:** ${d.author}`);
      lines.push(`- **Status:** ${d.status}`);
      lines.push("");
      if (d.context) lines.push(`**Context:** ${d.context}`);
      if (d.decision) lines.push(`**Decision:** ${d.decision}`);
      lines.push("");
    }
  }

  // Recent changes
  if (bundle.recent_changes.length > 0) {
    lines.push("## Recent Changes");
    lines.push("");
    for (const c of bundle.recent_changes.slice(0, 5)) {
      lines.push(`- **${c.summary}** (${c.author}, ${c.date.split("T")[0]})`);
      if (c.files_changed.length > 0) {
        lines.push(`  - Files: ${c.files_changed.slice(0, 3).join(", ")}`);
      }
    }
    lines.push("");
  }

  // Warnings
  if (bundle.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of bundle.warnings) {
      lines.push(`> ⚠️ ${w}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
