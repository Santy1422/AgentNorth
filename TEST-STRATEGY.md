# AgentNorth — Test Strategy

## Current State

### What EXISTS (packages/agentnorth)
| File | Lines | Covers |
|------|-------|--------|
| `test/core/indexer.test.ts` | 108 | Scanner, parser, indexer, config |
| `test/core/setup.test.ts` | 126 | Hook generation, settings.json, enforcement levels |
| `test/core/generators.test.ts` | 76 | Markdown, Mermaid, architecture docs |
| `test/core/schema.test.ts` | 87 | Schema extraction (Mongoose/Prisma) |
| `test/e2e/full-flow.test.ts` | 192 | init → index → setup end-to-end |
| **Total** | **589** | ~40% of agentnorth core |

### What's MISSING

#### agentnorth package (0% covered)
- MCP server tools (6 tools: list_modules, get_context, get_schema, get_decisions, log_decision, log_change)
- CLI commands: sync, pull, watch, docs, status, validate
- Git integration (blame, log, contributors)
- Decision read/write cycle
- Changelog operations
- Zod schema validation edge cases
- Error handling paths (missing files, bad config, git failures)

#### dashboard (0% — no test infra at all)
- API routes: v1 (sessions, events, sync, pull, decisions), dashboard, stream, keys, badge, join, team
- Auth flow: NextAuth callbacks, key generation, key validation
- Mongoose models: all 9 models
- SSE real-time broadcasting
- React components: 14 components
- i18n provider + translations completeness
- Utility functions (timeAgo, buildFeed, etc.)

---

## Test Plan — 4 Layers

### Layer 1: Unit Tests (pure logic, no I/O)
**Priority: HIGH | Effort: LOW**

| Test | Target | What to verify |
|------|--------|---------------|
| `parser.test.ts` | `core/parser.ts` | Exports/imports extraction, complexity calc, JSDoc, edge cases (empty files, syntax errors) |
| `classifyFile.test.ts` | `core/indexer.ts` | File kind classification (page, component, hook, lib, model, route, test, config) |
| `warnings.test.ts` | `core/indexer.ts` | Warning generation (>500 LOC, high complexity, dead code, hot files) |
| `decisions.test.ts` | `core/decisions.ts` | Parse markdown → Decision, write Decision → markdown, roundtrip |
| `changelog.test.ts` | `core/changelog.ts` | Log entry creation, date formatting |
| `config.test.ts` | `core/config.ts` | Valid config, missing fields, invalid YAML, enforcement levels |
| `zod-schemas.test.ts` | `schemas/*.ts` | Valid/invalid inputs for all Zod schemas |
| `timeAgo.test.ts` | `app/page.tsx` | timeAgo utility (now, minutes, hours, days) |
| `buildFeed.test.ts` | `app/page.tsx` | Feed building, sorting, deduplication, limits |
| `i18n.test.ts` | `i18n/*.ts` | All EN keys exist in ES, no missing translations, variable interpolation |
| `extractApiPath.test.ts` | `ApisView.tsx` | Next.js path → API route conversion |
| `extractMethods.test.ts` | `ApisView.tsx` | HTTP method extraction from exports |

### Layer 2: Integration Tests (I/O with mocks)
**Priority: HIGH | Effort: MEDIUM**

| Test | Target | What to verify |
|------|--------|---------------|
| `mcp-server.test.ts` | `server/index.ts` | All 6 MCP tools return correct data, handle missing modules, validate inputs |
| `git.test.ts` | `core/git.ts` | Git blame, log, contributors (with temp git repo) |
| `sync-command.test.ts` | `cli/commands/sync.ts` | HTTP calls to API, error handling, auth headers |
| `pull-command.test.ts` | `cli/commands/pull.ts` | Fetch + write decisions locally |
| `api-v1.test.ts` | `api/v1/route.ts` | All Hono routes: sessions, events, sync, pull, decisions, delete |
| `api-dashboard.test.ts` | `api/dashboard/route.ts` | Dashboard data aggregation, auth check |
| `api-keys.test.ts` | `api/keys/route.ts` | Key generation, regeneration, prefix extraction |
| `api-badge.test.ts` | `api/badge/route.ts` | SVG generation for health/modules/coverage/deps |
| `auth-keys.test.ts` | `lib/auth-keys.ts` | Key format, hashing, comparison |
| `models.test.ts` | `models/*.ts` | Schema validation, defaults, indexes, required fields |

### Layer 3: E2E Tests (real systems)
**Priority: MEDIUM | Effort: HIGH**

| Test | Target | What to verify |
|------|--------|---------------|
| `full-flow.test.ts` (extend) | CLI | init → index → sync → pull roundtrip with mock API |
| `session-lifecycle.test.ts` | API | start → events → end, token accumulation, stale cleanup |
| `sse-realtime.test.ts` | SSE | Connect, receive events, heartbeat, reconnection |
| `decision-roundtrip.test.ts` | CLI + API | log_decision locally → sync → pull back |

### Layer 4: Component Tests (React)
**Priority: LOW | Effort: MEDIUM**

| Test | Target | What to verify |
|------|--------|---------------|
| `Header.test.tsx` | Header | Nav items render, project switcher, logout, language toggle |
| `MainView.test.tsx` | MainView | Hero stats, session cards, feed rows, health scorecard |
| `GlobalSearch.test.tsx` | GlobalSearch | Search filtering, navigation |

---

## Implementation Order

### Phase 1 — Unit tests for agentnorth (extend existing)
```
packages/agentnorth/test/
  core/
    parser.test.ts          ← NEW: thorough parser tests
    classifyFile.test.ts    ← NEW: file classification
    warnings.test.ts        ← NEW: warning generation
    decisions.test.ts       ← NEW: decision parse/write
    git.test.ts             ← NEW: git integration
  schemas/
    zod-validation.test.ts  ← NEW: all Zod schemas
  server/
    mcp-tools.test.ts       ← NEW: MCP server tools
  cli/
    sync.test.ts            ← NEW: sync command
    pull.test.ts            ← NEW: pull command
```

### Phase 2 — Dashboard test infrastructure + API tests
```
dashboard/
  vitest.config.ts          ← NEW: vitest setup
  test/
    setup.ts                ← NEW: test helpers (mock DB, mock auth)
    api/
      v1.test.ts            ← NEW: all v1 routes
      dashboard.test.ts     ← NEW: dashboard route
      keys.test.ts          ← NEW: key management
      badge.test.ts         ← NEW: badge generation
      stream.test.ts        ← NEW: SSE tests
    models/
      session.test.ts       ← NEW: session model
      all-models.test.ts    ← NEW: all model schemas
    lib/
      auth-keys.test.ts     ← NEW: key generation
    utils/
      feed.test.ts          ← NEW: buildFeed, timeAgo
      i18n.test.ts          ← NEW: translation completeness
```

### Phase 3 — E2E and component tests
```
packages/agentnorth/test/
  e2e/
    session-lifecycle.test.ts  ← NEW
    decision-roundtrip.test.ts ← NEW

dashboard/test/
  components/
    Header.test.tsx         ← NEW
    MainView.test.tsx       ← NEW
```

---

## Technical Setup Needed

### agentnorth (already has vitest)
- No changes needed, just add test files

### dashboard (needs everything)
```bash
cd dashboard
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom mongodb-memory-server
```

**vitest.config.ts**:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

**test/setup.ts** (mock MongoDB):
```ts
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
});

afterAll(async () => {
  await mongo.stop();
});
```

---

## Coverage Targets

| Area | Current | Target |
|------|---------|--------|
| agentnorth core | ~40% | 85%+ |
| agentnorth MCP | 0% | 80%+ |
| agentnorth CLI | 0% | 70%+ |
| dashboard API | 0% | 85%+ |
| dashboard models | 0% | 90%+ |
| dashboard utils | 0% | 95%+ |
| dashboard components | 0% | 50%+ |
| i18n completeness | 0% | 100% |
