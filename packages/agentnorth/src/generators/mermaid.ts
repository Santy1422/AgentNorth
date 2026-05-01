import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ContextBundle, AgentNorthConfig } from "../core/types.js";

export async function generateDependencyGraph(
  rootDir: string,
  bundles: ContextBundle[],
): Promise<void> {
  const docsDir = join(rootDir, ".agentnorth", "docs");
  await mkdir(docsDir, { recursive: true });

  const mermaid = renderDependencyGraph(bundles);
  await writeFile(join(docsDir, "DEPENDENCY-MAP.mmd"), mermaid, "utf-8");
}

export async function generateERDs(
  rootDir: string,
  bundles: ContextBundle[],
): Promise<void> {
  const erdsDir = join(rootDir, ".agentnorth", "docs", "erds");
  await mkdir(erdsDir, { recursive: true });

  for (const bundle of bundles) {
    if (bundle.schema.tables.length === 0 && !bundle.schema.mermaid) continue;
    const content = bundle.schema.mermaid || renderERD(bundle);
    await writeFile(join(erdsDir, `${bundle.module}.mmd`), content, "utf-8");
  }
}

function renderDependencyGraph(bundles: ContextBundle[]): string {
  const lines: string[] = [];
  lines.push("graph TD");

  // Style definitions
  lines.push("  classDef hasDecisions fill:#c98b5b22,stroke:#c98b5b");
  lines.push("");

  for (const bundle of bundles) {
    const id = sanitize(bundle.module);
    const label = `${bundle.module}\\n${bundle.files.length} files`;
    lines.push(`  ${id}["${label}"]`);

    for (const dep of bundle.dependencies.internal) {
      lines.push(`  ${id} --> ${sanitize(dep)}`);
    }

    if (bundle.decisions.length > 0) {
      lines.push(`  class ${id} hasDecisions`);
    }
  }

  return lines.join("\n");
}

function renderERD(bundle: ContextBundle): string {
  if (bundle.schema.tables.length === 0) return "";

  const lines: string[] = [];
  lines.push("erDiagram");

  for (const table of bundle.schema.tables) {
    lines.push(`  ${sanitize(table.name)} {`);
    for (const col of table.columns) {
      const nullable = col.nullable ? "nullable" : "";
      lines.push(`    ${col.type} ${col.name} ${nullable}`.trimEnd());
    }
    lines.push("  }");
  }

  return lines.join("\n");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}
