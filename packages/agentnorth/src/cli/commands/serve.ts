import { startServer } from "../../server/index.js";

export async function serveCommand() {
  const rootDir = process.cwd();
  console.error(`[agentnorth] Starting MCP server for: ${rootDir}`);
  await startServer(rootDir);
}
