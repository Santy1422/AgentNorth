# AgentNorth

**Shared Context Layer for teams with AI coding agents.**

AgentNorth indexes your codebase into optimized context bundles that AI agents consume via [MCP](https://modelcontextprotocol.io). Instead of agents exploring 60K+ tokens of raw files, they get a structured ~2K-token bundle with everything they need.

## Why AgentNorth?

AI coding agents (Claude, Copilot, Cursor) waste tokens rediscovering your project structure every session. AgentNorth solves this:

- **97% token savings** — 30 files / 1,797 LOC compressed to ~1,800 tokens
- **Bidirectional** — Agents read context AND write back decisions/changes
- **Enforcement** — Claude Code hooks ensure agents use context before exploring
- **Team visibility** — Dashboard shows who did what, when (coming soon)

## Quick Start

```bash
npx agentnorth init      # Detect modules, create config
npx agentnorth index     # Scan files, generate bundles
npx agentnorth setup     # Generate .claude/ hooks for enforcement
npx agentnorth validate  # Check everything is healthy
```

## What agents get

Instead of reading dozens of files, an agent calls `agentnorth_get_context("auth")` and receives:

```json
{
  "module": "auth",
  "files": [
    { "path": "src/auth/middleware.ts", "exports": ["authMiddleware", "requireAuth"], "loc": 25 },
    { "path": "src/auth/session.ts", "exports": ["SessionStore", "sessionStore"], "loc": 18 }
  ],
  "schema": { "tables": [...], "mermaid": "erDiagram..." },
  "dependencies": { "internal": ["core"], "external": ["jsonwebtoken"] },
  "decisions": [{ "id": "D001", "title": "JWT bearer over cookies", "status": "active" }],
  "recent_changes": [{ "summary": "Add refresh token rotation", "date": "2025-04-28" }]
}
```

## MCP Tools

| Tool | Direction | Description |
|------|-----------|-------------|
| `agentnorth_list_modules` | read | List all indexed modules |
| `agentnorth_get_context` | read | Full context bundle for a module |
| `agentnorth_get_schema` | read | Schema/ERD only |
| `agentnorth_get_decisions` | read | Architecture decisions |
| `agentnorth_log_decision` | **write** | Record an architecture decision |
| `agentnorth_log_change` | **write** | Record a code change |

## Project Structure

```
packages/agentnorth/   — MCP Server + CLI (npm package)
dashboard/             — Next.js 15 web dashboard (coming soon)
roadmap/               — Architecture docs and planning
```

## Documentation

- [Package README](./packages/agentnorth/README.md) — Full CLI docs, config reference
- [Architecture](./roadmap/01-ARQUITECTURA.md) — Technical design
- [Enforcement](./roadmap/08-ENFORCEMENT-REALTIME.md) — How hooks work
- [Token Savings](./roadmap/09-TOKEN-SAVINGS.md) — Benchmark methodology

## License

Apache-2.0
