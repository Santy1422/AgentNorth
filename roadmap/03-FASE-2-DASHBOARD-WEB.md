# 03 — Fase 2: Dashboard Web Dinamico

**Prerequisito:** Fase 1 validada (MCP server funcional, benchmark positivo, repo publico con traccion)
**Objetivo:** Interfaz web donde el equipo VE lo que TokenDoc sabe del proyecto en tiempo real

---

## Por que web dinamico y no estatico

- Un site estatico es solo documentacion muerta con otro formato
- El valor real es ver el proyecto VIVO: que hizo el agente hoy, que decisiones se tomaron, que modulos estan calientes
- Un dashboard dinamico puede recibir datos del MCP server en tiempo real
- Es lo que diferencia TokenDoc de DeepWiki (snapshots estaticos)

---

## Stack

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Frontend | Next.js (App Router) | React, SSR, desplegable en Vercel en minutos |
| API | Hono (route handlers en Next.js o standalone) | Ligero, tipado, rapido |
| DB | MongoDB Atlas | Free tier 512MB, schema flexible perfecto para bundles/events |
| ODM | Mongoose | Schema validation, populate, hooks, maduro para MongoDB |
| Dependency graph | React Flow | Nodos custom, click → navegar, drag & zoom, minimap. Nativo React |
| ERDs | Mermaid.js (client-side, `'use client'`) | Generados desde schema, text-based |
| Charts | Recharts o Tremor | Metricas de tokens, actividad de agentes |
| Hosting | Vercel | Deploy desde GitHub, preview per-PR |
| Auth | NextAuth.js (GitHub OAuth) | El usuario ya tiene GitHub, zero friction |

---

## Paginas del dashboard

### 1. Overview (`/`)

```
+------------------------------------------------------------------+
|  TokenDoc — DGuard                              [Settings] [Sync] |
+------------------------------------------------------------------+
|                                                                   |
|  Modules: 12    Decisions: 23    Agent sessions (7d): 18          |
|  Health: 78/100  Tokens saved (est): ~340K                        |
|                                                                   |
|  [Dependency Map]                    [Recent Activity]            |
|  auth ──> tenants                    May 1 14:30 — Claude         |
|  billing ──> tenants                   refactored auth middleware |
|  notifications ──> auth              May 1 11:00 — Claude         |
|  billing ──> payments                  added billing webhook      |
|                                      Apr 30 16:45 — Santi         |
|                                        decision: separate billing |
|                                        DB per tenant              |
+------------------------------------------------------------------+
```

**Datos:** modulos indexados, decisiones activas, actividad reciente, grafo de dependencias (Mermaid interactivo)

### 2. Modulo detail (`/modules/[name]`)

```
+------------------------------------------------------------------+
|  Module: auth                                    [Re-index] [Edit]|
+------------------------------------------------------------------+
|                                                                   |
|  Files: 8    LOC: 1,240    Exports: 23    Last change: 2h ago     |
|                                                                   |
|  [Schema / ERD]              [Files]                              |
|  ┌─────────┐                 src/auth/middleware.ts (180 loc)      |
|  │  users  │──┐              src/auth/jwt.ts (95 loc)             |
|  └─────────┘  │              src/auth/guards/role.guard.ts        |
|  ┌─────────┐  │              src/auth/strategies/local.ts         |
|  │ sessions│──┘              ...                                  |
|  └─────────┘                                                      |
|                                                                   |
|  [Decisions]                 [Dependencies]                       |
|  #007 JWT bearer > cookies   Internal: tenants, users             |
|  #003 Argon2 for hashing     External: @nestjs/passport, jsonweb  |
|                                                                   |
|  [Agent Activity]                                                 |
|  May 1 — Claude refactored middleware (breaking)                  |
|  Apr 28 — Claude added refresh token flow                         |
+------------------------------------------------------------------+
```

### 3. Decisions (`/decisions`)

Timeline de todas las decisiones, filtrable por modulo, autor (humano/agente), estado.

```
+------------------------------------------------------------------+
|  Decisions                    [Filter: all] [Status: active]      |
+------------------------------------------------------------------+
|  #023  May 1   auth     claude   JWT bearer over cookies   active |
|  #022  Apr 30  billing  santi    Separate billing DB       active |
|  #021  Apr 28  auth     claude   Refresh token rotation    active |
|  #020  Apr 25  tenants  santi    Tenant isolation at DB    active |
|  #019  Apr 20  billing  claude   Stripe webhooks idempo... active |
|  ...                                                              |
+------------------------------------------------------------------+
```

### 4. Agent Timeline (`/activity`)

Que hicieron los agentes, cuando, en que modulos. Vista tipo feed.

```
+------------------------------------------------------------------+
|  Agent Activity                          [Filter: 7d] [All agents]|
+------------------------------------------------------------------+
|  May 1 14:30  Claude  auth                                        |
|    Refactored auth middleware for JWT bearer                      |
|    Files: middleware.ts, jwt.ts  |  Breaking: yes                 |
|    Decision logged: #023                                          |
|                                                                   |
|  May 1 11:00  Claude  billing                                     |
|    Added Stripe webhook handler for invoice.paid                  |
|    Files: stripe-webhook.ts, billing.service.ts                   |
|                                                                   |
|  Apr 30 16:45  Manual  billing                                    |
|    Decision: Separate billing DB per tenant                       |
+------------------------------------------------------------------+
```

### 5. Health (`/health`)

Metricas del proyecto: cobertura de docs, modulos sin decisiones, tokens estimados ahorrados.

```
+------------------------------------------------------------------+
|  Project Health                                      Score: 78/100|
+------------------------------------------------------------------+
|                                                                   |
|  [Token Savings]           [Documentation Coverage]               |
|  ████████████░░ 340K       ████████░░░░ 67% modules documented    |
|  estimated saved           3 modules without decisions            |
|                                                                   |
|  [Freshness]               [Warnings]                             |
|  Bundles: 2h ago           auth: breaking change pending review   |
|  Last agent: 3h ago        payments: no tests detected            |
|  Last decision: 1d ago     notifications: 0 exports documented    |
|                                                                   |
|  [Module Health]                                                  |
|  auth       ████████░░ 80   billing   ███████░░░ 70               |
|  tenants    █████████░ 90   payments  ████░░░░░░ 40               |
+------------------------------------------------------------------+
```

---

## Arquitectura: MCP server → API → Dashboard

```
Dev con Claude Code
  │
  │  MCP (STDIO)
  ▼
TokenDoc MCP Server (local)
  │  env: TOKENDOC_ORG_KEY + TOKENDOC_DEV_KEY
  │
  │  HTTPS (cada tool call)
  ▼
TokenDoc API (Hono, hosted)
  │  Autentica org_key + dev_key
  │  Registra uso, decisions, changes
  │  Escribe en Postgres
  │
  ▼
Dashboard (Next.js)
  │  Lee de API
  │  Realtime via MongoDB Change Streams + SSE
  │  Muestra: quien hizo que, cuando, en que modulo
  ▼
Team lead / Dev → ve todo en el browser
```

### Flujo concreto

1. Dev configura `TOKENDOC_ORG_KEY` en el repo + `TOKENDOC_DEV_KEY` en su config personal
2. Claude Code inicia MCP server con ambas keys
3. Cada llamada MCP (get_context, log_decision, etc.) el server:
   - Resuelve localmente desde `.tokendoc/` (rapido, <200ms)
   - Envia evento al API de TokenDoc (async, no bloquea)
4. El API registra en Postgres: quien, que, cuando, modulo, tokens estimados
5. El dashboard muestra la actividad en tiempo real

### Por que no solo leer de GitHub

- Leer `.tokendoc/` via GitHub API es lento y limitado (rate limits)
- No captura sesiones en tiempo real (solo despues del commit)
- No trackea POR DESARROLLADOR (git solo tiene el commit author)
- Con API keys el tracking es instantaneo, antes del commit

---

## Tareas Fase 2

### Sprint 1: Scaffold + Auth + API Keys

| # | Tarea | Prioridad |
|---|-------|-----------|
| 3.1 | Setup Next.js App Router + Tailwind + Vercel deploy | Alta |
| 3.2 | GitHub OAuth con NextAuth.js | Alta |
| 3.3 | Crear org: nombre → genera org_key (tdoc_org_xxx) | Alta |
| 3.4 | Invitar devs: email → genera dev_key (tdoc_dev_xxx) | Alta |
| 3.5 | API (Hono): endpoint para recibir eventos del MCP server (autenticado con org+dev key) | Alta |
| 3.6 | Conectar repo: input de GitHub URL → sync inicial de .tokendoc/ | Alta |
| 3.7 | Pagina Overview: modulos, stats, dependency map (Mermaid) | Alta |
| 3.6 | Parsear decisions/*.md (frontmatter) → lista | Media |
| 3.7 | Parsear changelog/*.md → timeline | Media |

### Sprint 2: Detalle + Activity

| # | Tarea | Prioridad |
|---|-------|-----------|
| 3.8 | Pagina Module detail: files, schema, ERD, decisions, activity | Alta |
| 3.9 | Pagina Decisions: timeline filtrable | Media |
| 3.10 | Pagina Agent Activity: feed cronologico | Media |
| 3.11 | Mermaid ERD interactivo por modulo | Media |
| 3.12 | Dependency graph interactivo (click modulo → navigate) | Media |

### Sprint 3: Health + Polish

| # | Tarea | Prioridad |
|---|-------|-----------|
| 3.13 | Pagina Health: score, coverage, freshness, warnings | Media |
| 3.14 | Charts de token savings estimados (Recharts) | Media |
| 3.15 | Auto-refresh: detectar push al repo → re-parsear | Media |
| 3.16 | Dark mode | Baja |
| 3.17 | Responsive / mobile-friendly | Baja |

---

## Modelo de datos (MongoDB Atlas / Mongoose)

```typescript
// --- Collection: organizations ---
{
  _id: ObjectId,
  name: string,
  org_key_prefix: string,        // "tdoc_org_xxxx" (primeros 12 chars, plaintext para lookup)
  org_key_hash: string,          // bcrypt hash de la key completa
  plan: "free" | "team" | "enterprise",
  created_at: Date
}

// --- Collection: developers ---
{
  _id: ObjectId,
  org_id: ObjectId,              // ref → organizations
  name: string,
  email: string,
  github_id: string,             // de OAuth
  dev_key_prefix: string,        // "tdoc_dev_xxxx"
  dev_key_hash: string,          // bcrypt hash
  role: "admin" | "member",
  created_at: Date,
  last_active_at: Date
}

// --- Collection: projects ---
{
  _id: ObjectId,
  org_id: ObjectId,
  name: string,
  github_url: string,
  modules: [{                    // embebido — cambia poco, se lee junto
    name: string,
    description: string,
    paths: string[],
    files_count: number,
    loc: number,
    exports_count: number,
    dependencies: {
      internal: string[],        // nombres de otros modules
      external: string[]         // paquetes npm
    },
    schema: {
      tables: object[],
      mermaid_erd: string
    },
    last_indexed_at: Date
  }],
  last_synced_at: Date
}

// --- Collection: decisions ---
{
  _id: ObjectId,
  org_id: ObjectId,
  project_id: ObjectId,
  module: string,
  title: string,
  context: string,
  decision: string,
  author_dev_id: ObjectId,
  author_name: string,           // denormalizado para queries rapidas
  status: "active" | "superseded" | "deprecated",
  created_at: Date
}

// --- Collection: agent_changes ---
{
  _id: ObjectId,
  org_id: ObjectId,
  project_id: ObjectId,
  module: string,
  summary: string,
  files_changed: string[],
  breaking: boolean,
  notes: string,
  author_dev_id: ObjectId,
  author_name: string,
  created_at: Date
}

// --- Collection: usage_events ---
// (alta escritura, se puede TTL index para auto-borrar despues de 90 dias)
{
  _id: ObjectId,
  org_id: ObjectId,
  dev_id: ObjectId,
  project_id: ObjectId,
  session_id: string,
  action: string,                // "get_context" | "log_decision" | "exploration" | etc
  module: string,
  tokens_served: number,
  tokens_saved_estimate: number,
  timestamp: Date                // TTL index: expireAfterSeconds: 7776000 (90 dias)
}

// --- Collection: sessions ---
{
  _id: ObjectId,
  org_id: ObjectId,
  dev_id: ObjectId,
  project_id: ObjectId,
  started_at: Date,
  ended_at: Date,
  actions_count: number,
  tokens_total: number,
  tokens_saved_total: number
}
```

### Indices clave

```javascript
// Lookup rapido de API keys
db.organizations.createIndex({ org_key_prefix: 1 })
db.developers.createIndex({ dev_key_prefix: 1 })

// Queries por org + proyecto
db.decisions.createIndex({ org_id: 1, project_id: 1, created_at: -1 })
db.agent_changes.createIndex({ org_id: 1, project_id: 1, created_at: -1 })

// Usage events — alta escritura, TTL auto-cleanup
db.usage_events.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 })
db.usage_events.createIndex({ org_id: 1, dev_id: 1, timestamp: -1 })

// Sessions
db.sessions.createIndex({ org_id: 1, started_at: -1 })
```

### Por que MongoDB para TokenDoc

1. **Schema flexible** — bundles y modules tienen estructura variable segun el proyecto
2. **Embedded documents** — modules dentro de projects, sin JOINs
3. **Alta escritura** — usage_events recibe muchos inserts (cada tool call)
4. **TTL indexes** — auto-borrar eventos viejos sin cron jobs
5. **Change Streams** — realtime nativo para el dashboard sin infra extra
6. **Atlas free tier** — 512MB, no se pausa, suficiente para MVP

### Pagina de API Keys en dashboard

```
+------------------------------------------------------------------+
|  Settings > API Keys                                              |
+------------------------------------------------------------------+
|                                                                   |
|  Organization Key                                                |
|  tdoc_org_xxxx...xxxx          [Copy] [Regenerate]               |
|  Usar en: .claude/settings.json del repo (TOKENDOC_ORG_KEY)     |
|                                                                   |
|  Developer Keys                                                  |
|  Santi    tdoc_dev_aaaa...  admin   Active 2h ago   [Revoke]    |
|  Juan     tdoc_dev_bbbb...  member  Active 1d ago   [Revoke]    |
|  CI Agent tdoc_dev_cccc...  member  Active 5m ago   [Revoke]    |
|                                                                   |
|  [+ Invite developer]                                            |
|                                                                   |
|  Usage this month                                                |
|  Total events: 1,240    Tokens saved (est): ~890K                |
|  By dev: Santi 620 | Juan 380 | CI 240                          |
+------------------------------------------------------------------+
```

---

## Criterio de exito Fase 2

- [ ] Dashboard desplegado en Vercel, accesible con GitHub login
- [ ] DGuard conectado: overview muestra modulos, decisions, activity reales
- [ ] Dependency map y ERDs renderizan correctamente con Mermaid
- [ ] Un dev nuevo entiende la arquitectura de DGuard en <15 min usando el dashboard
- [ ] Refresh automatico cuando hay push al repo
