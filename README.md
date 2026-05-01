<div align="center">

# AgentNorth

**Shared Context Layer for AI coding agents**

Your agents share one source of truth — pre-indexed context, architecture decisions, and live coordination.

[![npm](https://img.shields.io/npm/v/agentnorth)](https://www.npmjs.com/package/agentnorth)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Dashboard](https://img.shields.io/badge/dashboard-agentnorth.io-black)](https://agentnorth.io)

</div>

---

## The problem

AI coding agents waste tokens rediscovering your project every session. For a module like `auth`, Claude reads 30-100 files (60K+ tokens) just to understand the structure. Multiply that by every session, every dev, every repo.

AgentNorth fixes this: **one MCP call replaces hundreds of file reads**.

## Quick start

```bash
npx agentnorth init      # Detect modules, create config
npx agentnorth index     # Scan files, generate context bundles
npx agentnorth setup     # Generate Claude Code hooks + CLAUDE.md
npx agentnorth sync      # Push to dashboard (optional)
```

That's it. Your agents now use AgentNorth automatically via Claude Code hooks.

## How it works

```
Your Codebase              AgentNorth                   AI Agent
─────────────             ──────────                   ─────────
src/auth/        ──scan──▶ .agentnorth/bundles/
src/billing/     ──scan──▶   auth.json                 agentnorth_get_context("auth")
prisma/schema    ──scan──▶   billing.json               → 2K tokens (not 60K)

                            MCP Server ◀──────────────▶ Claude Code
                            6 tools (read + write-back)
```

Instead of reading dozens of files, the agent calls `agentnorth_get_context("auth")` and gets:

```json
{
  "module": "auth",
  "files": [
    { "path": "src/auth/middleware.ts", "exports": ["authMiddleware"], "loc": 25 },
    { "path": "src/auth/session.ts", "exports": ["SessionStore"], "loc": 18 }
  ],
  "schema": { "tables": ["users", "sessions"], "mermaid": "erDiagram..." },
  "dependencies": { "internal": ["core"], "external": ["jsonwebtoken"] },
  "decisions": [{ "title": "JWT bearer over cookies", "status": "active" }],
  "recent_changes": [{ "summary": "Add refresh token rotation", "date": "2025-04-28" }]
}
```

## MCP Tools

| Tool | Direction | What it does |
|------|-----------|--------------|
| `agentnorth_list_modules` | read | List all indexed modules |
| `agentnorth_get_context` | read | Full context bundle for a module |
| `agentnorth_get_schema` | read | Schema / ERD only |
| `agentnorth_get_decisions` | read | Architecture decisions |
| `agentnorth_log_decision` | **write** | Record an architecture decision |
| `agentnorth_log_change` | **write** | Record a code change |

Decisions and changes persist across sessions. Next time a different agent (or dev) touches the same module, they see what was decided and why.

## Dashboard

[agentnorth.io](https://agentnorth.io) gives your team real-time visibility:

- **Live feed** — every agent session, decision, and change across all repos
- **Multi-project** — switch between repos like Slack workspaces
- **Team** — invite devs with a link, everyone shares the same context layer
- **Token savings** — track how much context reuse saves in API costs

Sign in with GitHub. Connect your CLI with API keys. Everything syncs automatically.

## Enforcement

AgentNorth uses Claude Code hooks to ensure agents always check context before exploring:

```bash
npx agentnorth setup
# Creates:
#   .claude/settings.json  — MCP server config
#   .claude/hooks/         — SessionStart, PreToolUse, PostToolUse, Stop
#   CLAUDE.md              — Agent instructions
```

Three enforcement levels: `soft` (warn), `strict` (block), `audit` (silent tracking).

## CLI Commands

| Command | Description |
|---------|-------------|
| `agentnorth init` | Initialize project, detect modules |
| `agentnorth index` | Generate context bundles |
| `agentnorth setup` | Generate Claude Code hooks |
| `agentnorth serve` | Start MCP server (stdio) |
| `agentnorth sync` | Push modules + decisions to dashboard |
| `agentnorth status` | Show module index status |
| `agentnorth docs` | Generate markdown docs + Mermaid diagrams |
| `agentnorth validate` | Check project health |

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

enforcement:
  level: soft
  track_sessions: true
```

## Project structure

```
packages/agentnorth/   — npm package (MCP server + CLI)
dashboard/             — Next.js web dashboard (agentnorth.io)
```

## Requirements

- Node.js >= 22.14.0
- A git repository

## License

Apache-2.0
