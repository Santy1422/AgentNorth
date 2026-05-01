# TokenDoc — Roadmap General

**Nombre de trabajo:** TokenDoc (ex TeamContext)
**Objetivo:** Shared Context Layer para equipos con agentes de IA
**Camino elegido:** A (herramienta interna, dogfood con DGuard, open source)
**Ultima actualizacion:** Mayo 2026 — post investigacion de mercado y tecnologia

---

## Estructura del Roadmap

| Archivo | Contenido |
|---------|-----------|
| [01-ARQUITECTURA.md](./01-ARQUITECTURA.md) | Stack validado, componentes, flujo de datos, schemas |
| [02-FASE-1-MCP-SERVER.md](./02-FASE-1-MCP-SERVER.md) | MVP: MCP server local + indexer + write-back |
| [03-FASE-2-DASHBOARD-WEB.md](./03-FASE-2-DASHBOARD-WEB.md) | Dashboard web dinamico (Next.js) |
| [04-FASE-3-SAAS.md](./04-FASE-3-SAAS.md) | Multi-repo, auth, billing, marketplace |
| [05-INVESTIGACION.md](./05-INVESTIGACION.md) | Competencia verificada, MCP ecosystem, gaps reales |
| [06-METRICAS.md](./06-METRICAS.md) | KPIs, benchmarks, criterios go/no-go |
| [07-STACK-VALIDADO.md](./07-STACK-VALIDADO.md) | Resumen de decisiones tecnicas con fuentes |
| [08-ENFORCEMENT-REALTIME.md](./08-ENFORCEMENT-REALTIME.md) | Hooks + CLAUDE.md + MCP instructions para forzar uso |
| [09-TOKEN-SAVINGS.md](./09-TOKEN-SAVINGS.md) | Calculo exacto de tokens ahorrados por sesion |
| [10-GTM-LANZAMIENTO.md](./10-GTM-LANZAMIENTO.md) | Licencia, monetizacion, playbook de lanzamiento, registries |

---

## Hallazgos clave de la investigacion

1. **Sourcegraph Cody Free/Pro discontinuado** (julio 2025) — vacio real en segmento individual/equipos pequenos
2. **5+ MCP servers de codebase ya existen** — pero ninguno bidireccional ni con docs generados
3. **ast-grep > tree-sitter puro** — misma performance, API mucho mas ergonomica, sin node-gyp
4. **DeepWiki es el competidor mas directo** — pero solo repos publicos, no bidireccional, no optimizado para tokens
5. **AGENTS.md** (Linux Foundation) — standard creciente, TokenDoc es complementario
6. **La comunidad reduce tokens con hacks** (CLAUDE.md, .claudeignore) — no hay solucion estructurada

---

## Stack confirmado

```
Fase 1: pnpm + TypeScript (ESM) + tsup + vitest + biome
        MCP SDK v1.29+ | ast-grep/napi | Zod 3 | Commander.js
        Licencia: Apache 2.0 | npm: OIDC Trusted Publishing

Fase 2: Next.js App Router + Hono API (catch-all route) + MongoDB Atlas
        React Flow (dependency graphs) + Mermaid (ERDs) + Mongoose
        NextAuth.js (GitHub OAuth) | Vercel hosting
        API keys: org + dev (prefix + bcrypt)
```

---

## Progreso

| Entregable | Estado | Notas |
|------------|--------|-------|
| Roadmap completo (10 archivos) | DONE | Arquitectura, fases, investigacion, metricas, GTM |
| Dashboard frontend prototype | DONE | `dashboard/` — Next.js 15, 5 vistas, dark theme, mock data |
| Fase 1: MCP Server core | DONE | `packages/tokendoc/` — full CLI (init/index/serve/status/docs), 6 MCP tools, AST parser, schema extractor (Prisma/Drizzle/TypeORM), generators (markdown/architecture/mermaid), 14 tests, dogfooded on self |

---

## Timeline de alto nivel

```
Semana 1-2  ──  Fase 1: MCP Server local (dogfood DGuard)
Semana 3+   ──  Evaluar senal → Fase 2: Dashboard web dinamico
```

---

## Criterio de exit por fase

- **Fase 1 → Fase 2:** MCP server funcional, benchmark >=30% ahorro tokens en DGuard, write-back funcional, repo publico, >=50 stars o 5 equipos
- **Fase 2 → Fase 3:** Dashboard funcionando, usuarios activos pidiendo multi-repo/billing
- **Fase 3:** Solo si hay senal clara de producto. No saltar sin validacion.

---

## Principios de diseno

1. **Dogfood first** — Si no resuelve el dolor de DGuard, no sirve
2. **MCP-native** — No reinventar protocolos, usar el standard
3. **Bidireccional** — El agente lee contexto Y deja huella (core, no nice-to-have)
4. **Team-facing** — Visibilidad para humanos via dashboard web, no solo CLI
5. **Agnostico de LLM** — Bundles JSON/Markdown funcionan con cualquier agente
6. **Open source core** — El moat es ecosistema y velocidad, no lock-in
7. **Complementario** — No competir con indexers existentes, resolver "entiende el proyecto" no "encuentra codigo"

---

## Posicionamiento validado

> **TokenDoc no es otro code indexer.** Los MCP indexers existentes resuelven "encuentra la funcion X". TokenDoc resuelve "entiende el modulo login: sus archivos, schema, dependencias, decisiones tomadas, y que hizo el agente ayer". Y lo hace bidireccional: el agente consume Y produce contexto.
