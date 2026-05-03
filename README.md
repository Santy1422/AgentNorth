<div align="center">

# AgentNorth

**Shared Context Layer for AI Coding Agents**

Your agents share one source of truth — pre-indexed context, architecture decisions, and live coordination.
Stop wasting tokens. Start shipping faster.

[![npm](https://img.shields.io/npm/v/agentnorth)](https://www.npmjs.com/package/agentnorth)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Dashboard](https://img.shields.io/badge/dashboard-agentnorth.io-black)](https://www.agentnorth.io)

[Get Started](#quick-start) · [Dashboard](https://www.agentnorth.io) · [How It Works](#how-it-works) · [Features](#features)

</div>

---

## The Problem

AI coding agents waste **60K+ tokens per session** rediscovering your codebase. Every time Claude opens a module like `auth`, it reads 30-100 files just to understand the structure. Multiply that by every session, every developer, every repo.

But tokens aren't the only problem — **you lose track of decisions**. One agent decides "JWT bearer over cookies", another session rewrites it to use cookies. Without a shared context layer, architecture decisions get lost between sessions, developers, and agents.

**AgentNorth fixes both: one MCP call replaces hundreds of file reads, and decisions persist across every session.**

```
Before AgentNorth:  Agent reads 47 files  → 62,000 tokens → $0.19/session
After AgentNorth:   Agent calls 1 tool    →  2,100 tokens → $0.006/session
                                              ─────────────────────────────
                                              96.6% reduction in context cost
```

## Quick Start

```bash
npx agentnorth init      # Detect modules, create config
npx agentnorth index     # Scan & analyze your codebase (AST + git metadata)
npx agentnorth setup     # Wire into Claude Code (6 hooks + MCP)
```

Then add your API keys (generated at [agentnorth.io](https://www.agentnorth.io)):

```bash
# .agentnorth/.env
AGENTNORTH_API_URL=https://www.agentnorth.io
AGENTNORTH_ORG_KEY=an_org_...
AGENTNORTH_DEV_KEY=an_dev_...
```

```bash
npx agentnorth sync      # Push to live dashboard
```

That's it. Every Claude Code session is now tracked automatically — tokens, tool calls, files, decisions — all enforced by hooks, not instructions.

## How It Works

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Your Codebase  │     │     AgentNorth        │     │    AI Agent      │
│                  │     │                      │     │                 │
│  src/auth/       │────▶│  AST Parser          │     │  "get_context   │
│  src/billing/    │────▶│  Git Blame + History  │────▶│   ('auth')"     │
│  prisma/schema   │────▶│  Complexity Analysis  │     │                 │
│  .agentnorth/    │────▶│  Decision Registry   │     │  → 2K tokens    │
│    decisions/    │     │                      │     │    not 60K      │
└─────────────────┘     └──────────┬───────────┘     └─────────────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   Live Dashboard      │
                        │   agentnorth.io       │
                        │                      │
                        │  Real-time SSE sync   │
                        │  Health Scorecard     │
                        │  Dependency Graph     │
                        │  Team Coordination    │
                        └──────────────────────┘
```

## Features

### Intelligent Codebase Indexing

The indexer goes beyond simple file listing. It uses **AST parsing** (via ast-grep) and **batch git operations** to extract:

- **Exports & Imports** — full dependency graph with specifiers
- **Cyclomatic Complexity** — per-file complexity scoring
- **Git Blame** — file ownership (who wrote what, how many lines)
- **Change Frequency** — hot files that change often (last 3 months)
- **JSDoc Extraction** — pulls documentation from `/** */` comments
- **Schema Detection** — Prisma, SQL, Mongoose schemas auto-detected
- **Smart Warnings** — large files, high coupling, dead code, missing docs
- **Batch Git Metadata** — 2 git calls per module instead of 2N (one per file)

```json
{
  "module": "auth",
  "files": [
    {
      "path": "src/auth/middleware.ts",
      "exports": ["authMiddleware"],
      "complexity": 8,
      "authors": [{ "author": "Santiago", "lines": 45 }],
      "change_frequency": 3,
      "last_modified": "2026-05-01"
    }
  ],
  "contributors": [{ "name": "Santiago", "commits": 12 }],
  "warnings": ["1 file with >500 LOC", "Auth module missing tests"],
  "decisions": [{ "title": "JWT bearer over cookies", "status": "active" }]
}
```

### MCP Server — 6 Tools for Claude

| Tool | Direction | What it does |
|------|-----------|--------------|
| `agentnorth_list_modules` | read | List all indexed modules |
| `agentnorth_get_context` | read | Full enriched context bundle |
| `agentnorth_get_schema` | read | Database schema + ERD |
| `agentnorth_get_decisions` | read | Architecture decisions for a module |
| `agentnorth_log_decision` | **write** | Record an architecture decision |
| `agentnorth_log_change` | **write** | Record a code change |

Decisions and changes are **not hardcoded** — they're created dynamically by agents and developers during real sessions. They persist as markdown files in `.agentnorth/decisions/` and sync to the dashboard. Next time a different agent (or dev) touches the same module, they see what was decided and why — automatically.

### Live Dashboard — [agentnorth.io](https://www.agentnorth.io)

A full-featured codebase intelligence dashboard inspired by **Backstage**, **Sourcegraph**, and **Linear**:

| Feature | Description |
|---------|-------------|
| **Health Scorecard** | Automated project health score with 6 checks (tests, security, complexity, docs, dead code, modularization) |
| **Interactive Dependency Graph** | Force-directed canvas visualization of module relationships |
| **Architecture Map** | Screen-first drill-down: Pages → Components → Hooks → Libs |
| **Decision Timeline** | Merged chronological view of all decisions + changes |
| **Activity Heatmap** | GitHub-style 12-week contribution grid |
| **Documentation Coverage** | Treemap visualization sized by LOC, colored by doc % |
| **API Catalog** | Auto-detected endpoints with method filtering and caller tracking |
| **Module Detail Pages** | Backstage-inspired entity pages with tabs (Overview, Files, Decisions, Deps) |
| **Onboarding Guide** | Auto-generated guide for new developers joining the project |
| **Change Impact Analysis** | Blast radius visualization per file |
| **Global Search (Cmd+K)** | Search across files, decisions, APIs, dependencies with keyboard nav |
| **Embeddable Badges** | SVG badges for health, coverage, modules — put them in your README |
| **Health Score History** | Track project health over time with daily snapshots |
| **Real-time SSE** | Instant dashboard updates when agents sync — no polling |
| **Bidirectional Sync** | Dashboard → repo and repo → dashboard |
| **Keyboard Shortcuts** | Alt+1-8 for view navigation, Cmd+K for search |
| **Contributors** | Per-module contributor tracking from git history |
| **Smart Warnings** | Auto-generated alerts for complexity, coupling, hot files |
| **Session Tracking** | Full session lifecycle: model, branch, tokens, files touched, decisions made |

### Enforcement via Claude Code Hooks

AgentNorth hooks into Claude Code's lifecycle to enforce context-first behavior and track every action:

```bash
npx agentnorth setup
# Creates:
#   .claude/settings.json  — MCP server + hooks config
#   .claude/hooks/         — SessionStart, PreToolUse, PostToolUse, Stop
#   CLAUDE.md              — Agent instructions
#   .git/hooks/post-commit — Auto index + sync
```

**Five hook integration points:**

| Hook | Trigger | What it does |
|------|---------|--------------|
| **SessionStart** | Claude session begins | Injects instructions, sends session start event with model/branch/repo |
| **PreToolUse (Read\|Grep\|Glob)** | Agent tries to explore files | Warns or blocks if module context not fetched first |
| **PreToolUse (Edit\|Write)** | Agent tries to modify files | Warns or blocks edits to modules without prior context check |
| **PostToolUse (mcp__agentnorth__*)** | Agent uses any AgentNorth MCP tool | Tracks tool usage, tokens saved, modules visited |
| **PostToolUse (Edit\|Write\|Bash)** | Agent modifies files or runs commands | Tracks every file edit and command execution |
| **Stop** | Claude session ends | Sends full session summary: files changed, commits, tokens, decisions |

**Three enforcement levels:**

| Level | Behavior |
|-------|----------|
| `soft` | Warns agents to check context first |
| `strict` | **Blocks** file reads AND edits without prior context check |
| `audit` | Silently tracks all agent behavior for analysis |

### Session Telemetry

Every Claude session is tracked end-to-end:

```
Session Start                    During Session                     Session End
─────────────                    ──────────────                     ───────────
• claude_model                   • events_count                     • files_changed_count
• conversation_id                • modules_visited[]                • commit_shas[]
• branch                         • tools_used[]                     • changes_logged
• repo_url                       • files_touched[]                  • decisions_logged
                                 • tokens_saved_total               • duration_mins
                                 • tokens_input/output              • errors_count
```

### Bidirectional Sync

```
              ┌─────────┐
  CLI ──sync──▶         ├──SSE──▶ Browser (instant)
              │ Server  │
  CLI ◀─pull──┤         ◀──POST── Dashboard (create decisions)
              └─────────┘
```

- **Post-commit hook**: Automatically runs `pull → index → sync` after every commit
- **Watch mode**: `npx agentnorth watch` — live file watching with debounced sync
- **SSE**: Dashboard updates in real-time without polling

### API Security

- **Zod validation** on all POST endpoints (session start/end, events, sync)
- **Rate limiting** — sliding window (30 req/min general, 10 failed auth/min)
- **Input sanitization** — string trimming, array length limits
- **bcrypt key hashing** — API keys are never stored in plain text

## CLI Commands

| Command | Description |
|---------|-------------|
| `agentnorth init` | Initialize project, auto-detect modules |
| `agentnorth index` | Generate enriched context bundles (AST + git) |
| `agentnorth setup` | Generate Claude Code hooks + MCP config |
| `agentnorth serve` | Start MCP server (stdio) |
| `agentnorth sync` | Push modules + decisions to dashboard |
| `agentnorth pull` | Pull decisions created on dashboard to local repo |
| `agentnorth watch` | Watch files and auto-sync on changes |
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
  level: strict          # soft | strict | audit
  track_sessions: true
  require_log_change: true
  require_log_decision: true
```

## Architecture

```
packages/agentnorth/        — npm package
  src/core/                 — Parser, indexer, git, scanner
  src/server/               — MCP server (6 tools)
  src/cli/                  — CLI commands
  test/                     — 194 tests (Vitest)
dashboard/                  — Next.js 15 (agentnorth.io)
  src/app/api/v1/           — Hono.js REST API (Zod + rate limiting)
  src/app/api/stream/       — SSE real-time endpoint
  src/app/api/badge/        — Embeddable SVG badges
  src/components/           — React dashboard components
  src/models/               — MongoDB schemas (8 models)
  test/                     — 63 tests (Vitest)
```

## Tech Stack

- **Runtime**: Node.js >= 22.14.0, TypeScript ESM strict
- **Parsing**: ast-grep (SgNode) for typed AST analysis
- **Dashboard**: Next.js 15, React 19, Hono.js
- **Database**: MongoDB with Mongoose
- **Auth**: NextAuth.js with GitHub OAuth
- **Validation**: Zod schemas on all API inputs
- **Build**: tsup (CLI), pnpm monorepo
- **Lint**: Biome
- **Test**: Vitest (257 tests across both packages)
- **Deploy**: Vercel

## License

Apache-2.0
