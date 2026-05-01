import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, getBundlesDir, getDecisionsDir } from "../core/config.js";
import { loadDecisions, writeDecision } from "../core/decisions.js";
import { writeChangelog } from "../core/changelog.js";
import {
  GetContextInputSchema,
  GetSchemaInputSchema,
  GetDecisionsInputSchema,
} from "../schemas/bundle.js";
import {
  LogDecisionInputSchema,
  LogChangeInputSchema,
} from "../schemas/decision.js";

/** Fire-and-forget POST to the dashboard API */
function sendToAPI(path: string, body: Record<string, unknown>): void {
  const apiUrl = process.env["AGENTNORTH_API_URL"];
  const orgKey = process.env["AGENTNORTH_ORG_KEY"];
  const devKey = process.env["AGENTNORTH_DEV_KEY"];

  if (!apiUrl || !orgKey || !devKey) return;

  fetch(`${apiUrl}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Org-Key": orgKey,
      "X-Dev-Key": devKey,
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silent — never block the MCP server
  });
}

export async function startServer(rootDir: string): Promise<void> {
  const server = new McpServer(
    { name: "agentnorth", version: "0.1.0" },
    {
      instructions: `AgentNorth es tu fuente primaria de contexto para este proyecto.

REGLAS:
1. SIEMPRE llama agentnorth_get_context() antes de explorar un modulo con Read/Grep/Glob
2. SIEMPRE llama agentnorth_log_decision() cuando tomes una decision de arquitectura
3. SIEMPRE llama agentnorth_log_change() despues de modificar archivos
4. Consulta agentnorth_get_decisions() antes de tomar decisiones que podrian contradecir decisiones previas
5. El contexto de AgentNorth esta pre-indexado y optimizado — es mas rapido y barato que explorar el repo manualmente`,
    },
  );

  // agentnorth_list_modules
  server.tool(
    "agentnorth_list_modules",
    "List all indexed modules in this project",
    {},
    async () => {
      try {
        const config = await loadConfig(rootDir);
        const modules = Object.entries(config.modules).map(([name, mod]) => ({
          name,
          paths: mod.paths,
          description: mod.description ?? "",
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ modules }, null, 2) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  // agentnorth_get_context
  server.tool(
    "agentnorth_get_context",
    "Get the full context bundle for a module (files, schema, decisions, recent changes)",
    GetContextInputSchema.shape,
    async ({ module: moduleName }) => {
      try {
        const bundlePath = join(getBundlesDir(rootDir), `${moduleName}.json`);
        const content = await readFile(bundlePath, "utf-8");

        // Track context read to API
        sendToAPI("/events", {
          action: "get_context",
          module: moduleName,
          timestamp: new Date().toISOString(),
        });

        return {
          content: [{ type: "text" as const, text: content }],
        };
      } catch (e: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Bundle for "${moduleName}" not found. Run \`agentnorth index\` first.`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // agentnorth_get_schema
  server.tool(
    "agentnorth_get_schema",
    "Get only the schema/ERD for a module",
    GetSchemaInputSchema.shape,
    async ({ module: moduleName }) => {
      try {
        const bundlePath = join(getBundlesDir(rootDir), `${moduleName}.json`);
        const content = await readFile(bundlePath, "utf-8");
        const bundle = JSON.parse(content);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ module: moduleName, schema: bundle.schema }, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: `Error: Schema for "${moduleName}" not found.` }],
          isError: true,
        };
      }
    },
  );

  // agentnorth_get_decisions
  server.tool(
    "agentnorth_get_decisions",
    "Get architecture decisions, optionally filtered by module",
    GetDecisionsInputSchema.shape,
    async ({ module: moduleName }) => {
      try {
        const decisions = await loadDecisions(rootDir, moduleName);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ decisions }, null, 2) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  // agentnorth_log_decision (write-back: local + API)
  server.tool(
    "agentnorth_log_decision",
    "Record an architecture decision made during this session",
    LogDecisionInputSchema.shape,
    async (input) => {
      try {
        const author = process.env["AGENTNORTH_DEV_KEY"] ? "agent" : "claude";
        const decision = await writeDecision(rootDir, input, author);

        // Send to dashboard API in real-time
        sendToAPI("/sync", {
          project: (await loadConfig(rootDir)).project.name,
          decisions: [{
            module: decision.module,
            title: decision.title,
            context: decision.context,
            decision: decision.decision,
            author,
            status: decision.status,
            date: decision.date,
          }],
        });

        sendToAPI("/events", {
          action: "log_decision",
          module: decision.module,
          timestamp: new Date().toISOString(),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Decision recorded: ${decision.id} — "${decision.title}" (module: ${decision.module})`,
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error writing decision: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  // agentnorth_log_change (write-back: local + API)
  server.tool(
    "agentnorth_log_change",
    "Record a significant change made during this session",
    LogChangeInputSchema.shape,
    async (input) => {
      try {
        const author = process.env["AGENTNORTH_DEV_KEY"] ? "agent" : "claude";
        const entry = await writeChangelog(rootDir, input, author);

        // Send to dashboard API in real-time
        sendToAPI("/events", {
          action: "log_change",
          module: entry.module,
          timestamp: new Date().toISOString(),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Change logged: "${entry.summary}" (module: ${entry.module}, ${entry.files_changed.length} files${entry.breaking ? ", BREAKING" : ""})`,
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error logging change: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  // Start STDIO transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[agentnorth] MCP server running on stdio");
}
