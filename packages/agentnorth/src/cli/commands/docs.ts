import { loadConfig, getBundlesDir } from "../../core/config.js";
import { indexAll } from "../../core/indexer.js";
import { generateModuleDocs } from "../../generators/markdown.js";
import { generateArchitectureDoc } from "../../generators/architecture.js";
import { generateDependencyGraph, generateERDs } from "../../generators/mermaid.js";

export async function docsCommand() {
  const rootDir = process.cwd();

  try {
    const config = await loadConfig(rootDir);

    console.error("[agentnorth] Indexing all modules...");
    const bundles = await indexAll(rootDir, config);

    console.error("[agentnorth] Generating module docs...");
    await generateModuleDocs(rootDir, bundles);

    console.error("[agentnorth] Generating ARCHITECTURE.md...");
    await generateArchitectureDoc(rootDir, config, bundles);

    console.error("[agentnorth] Generating dependency graph...");
    await generateDependencyGraph(rootDir, bundles);

    console.error("[agentnorth] Generating ERDs...");
    await generateERDs(rootDir, bundles);

    console.error(
      `[agentnorth] Done. Generated docs for ${bundles.length} modules in .agentnorth/docs/`,
    );
  } catch (e: unknown) {
    console.error(`[agentnorth] Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
