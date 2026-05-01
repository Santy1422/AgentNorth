# 01 — Arquitectura Tecnica (Actualizado con investigacion)

## Diagrama de componentes

```
+-------------------+       +-------------------+       +-------------------+
|   Claude Code /   |       |   MCP Context     |       |   Codebase        |
|   Cualquier       |<----->|   Server          |<----->|   (Git repo)      |
|   Agente IA       | MCP   |   (TokenDoc)      | FS    |                   |
+-------------------+       +-------------------+       +-------------------+
                                    |  ^
                            genera  |  | write-back
                                    v  |
                            +-------------------+
                            |   .tokendoc/      |
                            |   bundles, decisions,|
                            |   changelog       |
                            +-------------------+
                                    |
                                    | lee (GitHub API / webhook)
                                    v
                            +-------------------+
                            |   Dashboard Web   |
                            |   (Next.js + Hono)|
                            +-------------------+
```

---

## Stack confirmado (Fase 1-2) — Post investigacion

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| **Package manager** | pnpm | Aislamiento estricto, eficiencia disco, workspace protocol |
| **MCP Server** | TypeScript + `@modelcontextprotocol/sdk` (v1.29+) | Standard MCP, ESM-only, API `registerTool` |
| **Parser/Indexer** | `@ast-grep/napi` | Usa tree-sitter internamente, API ergonomica, binarios precompilados (sin node-gyp), Rust performance, multi-lenguaje |
| **Build tool** | tsup | esbuild interno, genera ESM, declarations, standard de facto 2026 |
| **Test framework** | Vitest | 5-28x mas rapido que Jest, ESM nativo, config zero |
| **Linter/Formatter** | Biome | 10-25x mas rapido que ESLint, linting + formatting en uno |
| **CLI framework** | Commander.js | El mas popular para CLIs TypeScript |
| **Validacion** | Zod 3 | Requerido por MCP SDK para inputSchema de tools |
| **Bundle storage** | JSON en disco (`.tokendoc/`) | Zero infra, versionable con git |
| **Dashboard** | Next.js + Hono + MongoDB Atlas + NextAuth.js | Web dinamico, no estatico |
| **Diagramas** | Mermaid.js | Text-as-code, renderiza en dashboard |
| **ERD generation** | Mermerd + scripts custom | Genera Mermaid ERD desde DB o modelos |

### Por que ast-grep en vez de tree-sitter puro

| Criterio | tree-sitter | ast-grep (`@ast-grep/napi`) |
|----------|-------------|---------------------------|
| Instalacion | Requiere node-gyp (compilacion C) | Binarios precompilados (Rust) |
| API | Bajo nivel, S-expressions | Patrones como codigo real |
| Buscar imports | Query S-expression compleja | `import $$$IMPORTS from '$SOURCE'` |
| Performance | Muy alta (C) | Muy alta (Rust + tree-sitter interno) |
| Multi-lenguaje | 40+ | 40+ (mismos grammars) |

---

## Stack futuro (Fase 3, solo si hay senal)

| Componente | Tecnologia |
|------------|-----------|
| Multi-repo | GitHub App integration |
| Busqueda semantica | Embeddings + MongoDB Atlas Vector Search |
| Billing | Stripe |
| Skill marketplace | Compatible con Anthropic Skills standard |

---

## Flujo de datos principal

### 1. Indexacion (offline, en push o manual)

```
git repo
  → ast-grep parse (CST por archivo via tree-sitter interno)
  → extraccion de modulos, exports, imports, schemas
  → agrupacion por "modulo" (config + heuristica de carpetas)
  → generacion de bundles JSON en .tokendoc/bundles/
  → generacion de docs Markdown + Mermaid ERDs
```

### 2. Consulta del agente (runtime, via MCP)

```
Agente llama: tokendoc_get_context("login")
  → MCP server lee .tokendoc/bundles/login.json
  → Devuelve: archivos, schema, dependencias, decisiones, cambios recientes
  → ~5K tokens en vez de ~60K de exploracion manual
```

### 3. Write-back del agente (bidireccional)

```
Agente llama: tokendoc_log_decision({ module: "login", decision: "No usar JWT en cookies", reason: "..." })
  → MCP server escribe en .tokendoc/decisions/
  → Proxima sesion del agente (o de otro dev) lo ve automaticamente

Agente llama: tokendoc_log_change({ module: "login", summary: "Refactorizado auth middleware", files: [...] })
  → MCP server escribe en .tokendoc/changelog/
  → Queda registrado para el dashboard y para proximas sesiones
```

---

## Schema del Bundle (draft v0)

```typescript
interface ContextBundle {
  module: string;                    // "login", "billing", "tenants"
  files: FileRef[];                  // paths + resumen de cada archivo
  schema: {
    tables: TableDef[];              // ERD del modulo
    mermaid: string;                 // diagrama renderizable
  };
  dependencies: {
    internal: string[];              // otros modulos que importa
    external: string[];              // paquetes npm/pip
  };
  decisions: Decision[];            // decisiones de arquitectura pinneadas
  recent_changes: RecentChange[];   // ultimos N commits que tocan este modulo
  conventions: string[];            // "usamos camelCase", "tests en __tests__/"
  warnings: string[];               // "no tocar migration 047 sin hablar con Santi"
}

interface FileRef {
  path: string;
  summary: string;                  // 1-2 lineas de que hace
  exports: string[];                // funciones/clases exportadas
  loc: number;                      // lineas de codigo
}

interface Decision {
  id: string;                       // "decision-007"
  date: string;
  author: string;                   // "claude" | "santi" | nombre del dev
  title: string;
  context: string;
  decision: string;
  status: "active" | "superseded" | "deprecated";
}

interface RecentChange {
  commit: string;
  date: string;
  author: string;
  summary: string;
  files_changed: string[];
}
```

---

## MCP Tools expuestos (draft v0)

Best practice MCP: **5-15 tools max por server, prefijo de servicio, outcomes not operations.**

| Tool | Descripcion | Fase |
|------|------------|------|
| `tokendoc_get_context(module)` | Bundle completo del modulo | 1 |
| `tokendoc_list_modules()` | Lista todos los modulos indexados | 1 |
| `tokendoc_get_schema(module)` | Solo el ERD/schema del modulo | 1 |
| `tokendoc_get_decisions(module?)` | Decisiones, opcionalmente filtradas | 1 |
| `tokendoc_log_decision(decision)` | **Write-back:** agente registra decision | 1 |
| `tokendoc_log_change(change)` | **Write-back:** agente registra que hizo | 1 |
| `tokendoc_search_context(query)` | Busqueda en bundles | 2 |
| `tokendoc_get_health()` | Metricas de salud del proyecto | 2 |

**Notas de implementacion MCP:**
- SDK requiere `"type": "module"` en package.json (ESM-only)
- Nunca usar `console.log()` en STDIO transport (stdout reservado para JSON-RPC)
- Usar `console.error()` para debugging
- Validar inputs con Zod (requerido por SDK)
- Paginar respuestas grandes (limit default 20-50, devolver `has_more`)
- Respuestas max ~256-512 KB (no hay limite formal pero consume context window)
- Tools simples deben responder en <200ms

---

## Sistema de API Keys (org + dev)

El MCP server se autentica con 2 API keys. Esto permite trackear uso por organizacion Y por desarrollador individual.

### Arquitectura de keys

```
Organizacion (ej: DGuard team)
  └── org_key: tdoc_org_xxxxxxxxxxxx
      │
      ├── Dev 1 (Santi)
      │   └── dev_key: tdoc_dev_aaaaaaaaaaaa
      │
      ├── Dev 2 (Juan)
      │   └── dev_key: tdoc_dev_bbbbbbbbbbbb
      │
      └── Dev 3 (Claude agent de CI)
          └── dev_key: tdoc_dev_cccccccccccc
```

### Como se configuran en el MCP server

```json
// .claude/settings.json (por repo, commiteado — solo org key)
{
  "mcpServers": {
    "tokendoc": {
      "command": "npx",
      "args": ["tokendoc", "serve"],
      "env": {
        "TOKENDOC_ORG_KEY": "tdoc_org_xxxxxxxxxxxx"
      }
    }
  }
}
```

```json
// ~/.claude/settings.json (personal del dev — dev key)
{
  "mcpServers": {
    "tokendoc": {
      "env": {
        "TOKENDOC_DEV_KEY": "tdoc_dev_aaaaaaaaaaaa"
      }
    }
  }
}
```

**Resultado:** el MCP server envia ambas keys en cada request al API de TokenDoc. El backend sabe QUE organizacion y QUIEN esta usando el agente.

### Que se trackea por key

| Key | Trackea |
|-----|---------|
| **org_key** | Proyecto, modulos indexados, decisiones totales, tokens totales consumidos, billing |
| **dev_key** | Quien hizo que sesion, que decisions logo, que cambios registro, tokens por dev |

### Flujo de tracking

```
1. Dev abre Claude Code en repo con TokenDoc configurado
2. Claude Code inicia MCP server con env vars (org_key + dev_key)
3. Agente llama tokendoc_get_context("auth")
   → MCP server envia request a TokenDoc API con ambas keys
   → API registra: org=dguard, dev=santi, action=get_context, module=auth, tokens=~5K
4. Agente llama tokendoc_log_decision(...)
   → API registra: org=dguard, dev=santi, action=log_decision, module=auth
   → Decision se guarda con author=santi (no "claude", sino el dev que corria la sesion)
5. Dashboard muestra: "Santi (via Claude) logo decision #023 en auth"
```

### Integracion con git

El MCP server puede leer git config para enrichment automatico:
- `git config user.name` → nombre del dev
- `git config user.email` → email para match con org
- `git remote get-url origin` → repo URL para match con proyecto

Esto complementa las API keys: la key identifica, git enriches con contexto.

### Modelo de datos para keys (MongoDB)

```typescript
// Collection: organizations
{ _id, name, org_key_prefix, org_key_hash, plan, created_at }

// Collection: developers
{ _id, org_id, name, email, github_id, dev_key_prefix, dev_key_hash, role, last_active_at }

// Collection: usage_events (TTL index 90 dias)
{ _id, org_id, dev_id, session_id, action, module, tokens_served, tokens_saved_estimate, timestamp }

// Collection: sessions
{ _id, org_id, dev_id, project_id, started_at, ended_at, actions_count, tokens_total }
```

### Seguridad de keys
- Keys se hashean con bcrypt (cost 12) en MongoDB, nunca en plaintext
- Se guarda un `key_prefix` (primeros 12 chars) en plaintext para lookup rapido
- org_key puede estar en el repo (es como un project ID, no un secret critico)
- dev_key es personal, va en el settings global del dev (~/.claude/settings.json)
- Rate limiting por org_key (prevenir abuso) via `hono-rate-limiter`
- Revocacion individual de dev_keys desde el dashboard
- TTL index en usage_events: auto-borrado a 90 dias

---

## Estructura de directorios del proyecto

```
tokendoc/
├── package.json              # "type": "module", bin: tokendoc
├── tsconfig.json             # target: ES2022, module: Node16
├── tsup.config.ts
├── vitest.config.ts
├── biome.json
├── README.md
├── LICENSE
├── bin/
│   └── tokendoc.ts           # #!/usr/bin/env node — CLI entry
├── src/
│   ├── index.ts              # Export publico de la libreria
│   ├── cli/
│   │   ├── index.ts          # Setup Commander.js
│   │   └── commands/         # init.ts, index.ts, docs.ts
│   ├── server/
│   │   └── index.ts          # McpServer + StdioServerTransport
│   ├── tools/                # Un archivo por tool MCP
│   │   ├── get-context.ts
│   │   ├── list-modules.ts
│   │   ├── get-schema.ts
│   │   ├── get-decisions.ts
│   │   ├── log-decision.ts
│   │   └── log-change.ts
│   ├── core/
│   │   ├── parser.ts         # ast-grep parsing
│   │   ├── indexer.ts        # Bundle generation
│   │   ├── git.ts            # Git log integration
│   │   └── types.ts          # Interfaces compartidas
│   ├── generators/
│   │   ├── markdown.ts       # Genera docs .md
│   │   └── mermaid.ts        # Genera ERDs .mmd
│   └── schemas/              # Zod schemas para validacion
│       ├── bundle.ts
│       ├── decision.ts
│       └── config.ts
├── test/
│   ├── tools/
│   ├── core/
│   └── fixtures/             # Repos de prueba
└── dist/                     # Output tsup (gitignored)
```

## Estructura generada en el repo del usuario

```
.tokendoc/
  config.yaml                 # configuracion del proyecto
  bundles/
    login.json
    billing.json
    tenants.json
  decisions/
    decision-001.md           # escritas por humanos O agentes (bidireccional)
    decision-002.md
  changelog/
    2026-05-01.md             # escritas por agentes via log_change
  docs/                       # generados, servidos por Docusaurus
    ARCHITECTURE.md
    modules/
      login.md
      billing.md
    erds/
      login.mmd
      billing.mmd
```
