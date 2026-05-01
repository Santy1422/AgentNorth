import { program } from "commander";
import { initCommand } from "../cli/commands/init.js";
import { indexCommand } from "../cli/commands/index.js";
import { serveCommand } from "../cli/commands/serve.js";
import { statusCommand } from "../cli/commands/status.js";
import { docsCommand } from "../cli/commands/docs.js";
import { setupCommand } from "../cli/commands/setup.js";
import { validateCommand } from "../cli/commands/validate.js";
import { syncCommand } from "../cli/commands/sync.js";
import { pullCommand } from "../cli/commands/pull.js";
import { watchCommand } from "../cli/commands/watch.js";

program
  .name("agentnorth")
  .description("Shared Context Layer for teams with AI coding agents")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize AgentNorth in the current repository")
  .option("--interactive", "Step-by-step mode")
  .action(initCommand);

program
  .command("index")
  .description("Re-scan the repository and regenerate all bundles")
  .option("--module <name>", "Index only a specific module")
  .action(indexCommand);

program
  .command("serve")
  .description("Start the MCP server for Claude Code")
  .action(serveCommand);

program
  .command("status")
  .description("Show indexed modules and their status")
  .action(statusCommand);

program
  .command("docs")
  .description("Generate markdown docs + Mermaid diagrams from bundles")
  .action(docsCommand);

program
  .command("setup")
  .description("Generate .claude/ hooks and CLAUDE.md for enforcement")
  .action(setupCommand);

program
  .command("validate")
  .description("Check project health: config, bundles, enforcement")
  .action(validateCommand);

program
  .command("sync")
  .description("Push local bundles and decisions to the AgentNorth dashboard")
  .action(syncCommand);

program
  .command("pull")
  .description("Pull decisions and changes from the dashboard to local files")
  .action(pullCommand);

program
  .command("watch")
  .description("Watch for file changes and auto-sync to dashboard in real-time")
  .action(watchCommand);

program.parse();
