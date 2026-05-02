# CLAUDE.md

## AgentNorth — REQUIRED

This project uses AgentNorth as its Shared Context Layer. The MCP server `agentnorth` is configured and MUST be used.

### Before working on any module:
1. Call `agentnorth_list_modules()` to see available modules
2. Call `agentnorth_get_context("module")` for the module you will work on
3. Check `agentnorth_get_decisions("module")` before making new decisions

### After making significant changes:
4. Call `agentnorth_log_change()` with a summary of what you did
5. If you made an architecture decision, call `agentnorth_log_decision()`
6. **REQUIRED**: After each commit, re-index and sync to the dashboard:
```bash
node packages/agentnorth/dist/bin/agentnorth.js index && \
AGENTNORTH_ORG_KEY=an_org_6tzShx9OUT7OvOGmhfaxoQL9DYLckMLx \
AGENTNORTH_DEV_KEY=an_dev_2Ud0NDGeqpTE-VcQWFk230hAi5Ug5Z5N \
AGENTNORTH_API_URL=https://www.agentnorth.io \
node packages/agentnorth/dist/bin/agentnorth.js sync
```
   This updates the dashboard at www.agentnorth.io with modules, decisions, and changes.
   **NEVER skip this step.** The dashboard must always reflect the current repo state.
   **IMPORTANT**: Always use `node packages/agentnorth/dist/bin/agentnorth.js` instead of `npx agentnorth` to ensure the local build is used.

### Rules:
- NEVER explore the repo with grep/glob/read without checking AgentNorth first
- The context you need is already indexed — use it
- If a module is not indexed, run `node packages/agentnorth/dist/bin/agentnorth.js index` first
- Previous decisions take precedence — do not contradict them without justification

## Project stack
- pnpm (monorepo)
- TypeScript ESM strict
- Node >= 22.14.0
- Biome (lint + format)
- Vitest (testing)
- tsup (bundling)

## Structure
```
packages/agentnorth/   — npm package (MCP Server + CLI)
dashboard/             — Next.js 15 dashboard (agentnorth.io)
```
