import { loadConfig } from "../../core/config.js";
import { indexModule, indexAll } from "../../core/indexer.js";

export async function indexCommand(opts: { module?: string }) {
  const rootDir = process.cwd();

  try {
    const config = await loadConfig(rootDir);

    if (opts.module) {
      console.error(`[agentnorth] Indexing module: ${opts.module}`);
      const bundle = await indexModule(rootDir, opts.module, config);
      console.error(
        `[agentnorth] Done: ${bundle.files.length} files, ${bundle.decisions.length} decisions`,
      );
    } else {
      console.error(`[agentnorth] Indexing all modules...`);
      const bundles = await indexAll(rootDir, config);
      const totalFiles = bundles.reduce((s, b) => s + b.files.length, 0);
      console.error(
        `[agentnorth] Done: ${bundles.length} modules, ${totalFiles} files indexed`,
      );
    }
  } catch (e: unknown) {
    console.error(`[agentnorth] Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
