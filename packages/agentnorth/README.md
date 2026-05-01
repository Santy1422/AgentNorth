# agentnorth

Shared Context Layer for teams with AI coding agents.

AgentNorth indexes your codebase into optimized context bundles that AI agents consume via MCP (Model Context Protocol). Instead of agents exploring 60K+ tokens of raw files, they get a structured 2K-token bundle with everything they need.

## Install

```bash
npm install -g agentnorth
# or
npx agentnorth
```

## Quick Start

```bash
# 1. Initialize — detects modules, creates .agentnorth/config.yaml
agentnorth init

# 2. Index — scans files, parses AST, generates bundles
agentnorth index

# 3. Setup — generates .claude/ hooks for enforcement
agentnorth setup

# 4. Serve — starts MCP server for Claude Code
agentnorth serve
```

## How It Works

```
Your Codebase                AgentNorth                  AI Agent
─────────────               ──────────                  ─────────
src/auth/          ──scan──> .agentnorth/bundles/auth.json
src/billing/       ──scan──> .agentnorth/bundles/billing.json
prisma/schema.prisma ──extract──> (included in bundles)

                             MCP Server <─────────────> Claude Code
                             6 tools:
                             - agentnorth_list_modules
                             - agentnorth_get_context     (read)
                             - agentnorth_get_schema      (read)
                             - agentnorth_get_decisions   (read)
                             - agentnorth_log_decision    (write-back)
                             - agentnorth_log_change      (write-back)
```

## Features

- **AST-powered indexing** — Uses ast-grep to extract imports, exports, functions, classes
- **Schema extraction** — Prisma, Drizzle, TypeORM schemas auto-detected
- **Bidirectional** — Agents read context AND write back decisions/changes
- **Enforcement hooks** — Claude Code hooks ensure agents use AgentNorth before exploring
- **97% token savings** — 30 files / 1,797 LOC compressed to ~1,800 tokens
- **Mermaid diagrams** — Auto-generated dependency graphs and ERDs
- **Configurable enforcement** — soft (warn), strict (block), or audit (silent)

## CLI Commands

| Command | Description |
|---------|-------------|
| `agentnorth init` | Initialize project, detect modules, create config |
| `agentnorth index` | Scan and generate context bundles |
| `agentnorth index --module auth` | Re-index a specific module |
| `agentnorth serve` | Start MCP server (stdio transport) |
| `agentnorth setup` | Generate .claude/ hooks + CLAUDE.md |
| `agentnorth status` | Show modules and their index status |
| `agentnorth docs` | Generate markdown docs + Mermaid diagrams |
| `agentnorth validate` | Check project health: config, bundles, enforcement |

## Configuration

`.agentnorth/config.yaml`:

```yaml
version: 1
project:
  name: my-app
  framework: next.js

modules:
  auth:
    paths: ["src/auth/"]
    description: "Authentication & JWT"
    schema_source: "prisma/schema.prisma"
    depends_on: ["core"]
  billing:
    paths: ["src/billing/"]
    description: "Stripe integration"

ignore:
  - "node_modules/"
  - "dist/"
  - "*.test.ts"

enforcement:
  level: soft          # soft | strict | audit
  track_sessions: true
  require_log_change: true
  require_log_decision: false
```

## MCP Tools

### Read tools (agent consumes context)

- **`agentnorth_list_modules`** — List all indexed modules
- **`agentnorth_get_context(module)`** — Full bundle: files, schema, decisions, recent changes
- **`agentnorth_get_schema(module)`** — Just the schema/ERD
- **`agentnorth_get_decisions(module?)`** — Architecture decisions

### Write tools (agent produces context)

- **`agentnorth_log_decision(module, title, context, decision)`** — Record an architecture decision
- **`agentnorth_log_change(module, summary, files_changed, breaking?)`** — Record a code change

## Enforcement

AgentNorth uses 3 layers to ensure agents always use context:

1. **CLAUDE.md** — Instructions telling the agent to use AgentNorth
2. **Claude Code Hooks** — Deterministic lifecycle hooks (SessionStart, PreToolUse, PostToolUse, Stop)
3. **MCP instructions** — Server-side instructions injected on connect

Run `agentnorth setup` to generate all enforcement files automatically.

## Requirements

- Node.js >= 22.14.0
- A git repository (for recent changes detection)

## License

Apache-2.0
