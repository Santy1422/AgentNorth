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
npx agentnorth index     # Scan & analyze your codebase
npx agentnorth setup     # Wire into Claude Code (hooks + MCP)
npx agentnorth sync      # Push to live dashboard
```

That's it. Your agents now use AgentNorth automatically via Claude Code hooks.

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

The indexer goes beyond simple file listing. It uses **AST parsing** (via ast-grep) to extract:

- **Exports & Imports** — full dependency graph with specifiers
- **Cyclomatic Complexity** — per-file complexity scoring
- **Git Blame** — file ownership (who wrote what, how many lines)
- **Change Frequency** — hot files that change often (last 3 months)
- **JSDoc Extraction** — pulls documentation from `/** */` comments
- **Schema Detection** — Prisma, SQL, Mongoose schemas auto-detected
- **Smart Warnings** — large files, high coupling, dead code, missing docs

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

### Enforcement via Claude Code Hooks

AgentNorth hooks into Claude Code to ensure agents always check context before exploring:

```bash
npx agentnorth setup
# Creates:
#   .claude/settings.json  — MCP server config
#   .claude/hooks/         — SessionStart, PreToolUse, PostToolUse, Stop
#   CLAUDE.md              — Agent instructions
```

Three enforcement levels:

| Level | Behavior |
|-------|----------|
| `soft` | Warns agents to check context first |
| `strict` | Blocks file reads without prior context check |
| `audit` | Silently tracks agent behavior for analysis |

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
  level: soft
  track_sessions: true
```

## Architecture

```
packages/agentnorth/        — npm package
  src/core/                 — Parser, indexer, git, scanner
  src/server/               — MCP server (6 tools)
  src/cli/                  — CLI commands
dashboard/                  — Next.js 15 (agentnorth.io)
  src/app/api/v1/           — Hono.js REST API
  src/app/api/stream/       — SSE real-time endpoint
  src/app/api/badge/        — Embeddable SVG badges
  src/components/           — React dashboard components
  src/models/               — MongoDB schemas
```

## Tech Stack

- **Runtime**: Node.js >= 22.14.0, TypeScript ESM strict
- **Parsing**: ast-grep (SgNode) for typed AST analysis
- **Dashboard**: Next.js 15, React 19, Hono.js
- **Database**: MongoDB with Mongoose
- **Auth**: NextAuth.js with GitHub OAuth
- **Build**: tsup (CLI), pnpm monorepo
- **Lint**: Biome
- **Test**: Vitest
- **Deploy**: Vercel

## License

Apache-2.0
