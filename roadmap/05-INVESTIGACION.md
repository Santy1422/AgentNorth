# 05 — Investigacion y Analisis Competitivo (Actualizado mayo 2026)

## Competencia directa — Estado real verificado

### Sourcegraph Cody
- **Estado:** EN CONTRACCION. Free y Pro discontinuados (julio 2025). Solo Enterprise sobrevive a $59/user/mes.
- **Implicacion:** Dejo un vacio enorme en el segmento individual y equipos pequenos. Miles de devs perdieron su herramienta de contexto.
- **Oportunidad para TokenDoc:** Captar ese segmento con solucion gratuita/barata, local-first y open source.

### Augment Code
- **Estado:** Activo, modelo de creditos desde oct 2025.
- **Pricing:** Indie $20/mes (40K creditos), Standard $60/dev/mes, Max $200/dev/mes, Enterprise $60-240K/ano.
- **Fortaleza:** Context Engine propietario, procesa +400K archivos.
- **Debilidad:** Modelo de creditos opaco y caro. Un task complejo ~4,300 creditos. No bidireccional.
- **Diferenciador nuestro:** Funciona con CUALQUIER LLM/agente, no solo con Augment. Open source. Bidireccional.

### Greptile
- **Estado:** Activo, enfocado en code review automatizado.
- **Pricing:** API $0.15/query, Code Review $30/seat/mes (50 reviews).
- **Fortaleza:** Whole-repo understanding via codebase graph, self-hosted disponible.
- **Debilidad:** Solo GitHub/GitLab (no Bitbucket). Enfocado en review, no en dar contexto a agentes.
- **Diferenciador nuestro:** Orientado a documentacion + contexto para agentes, no solo review.

### Continue.dev + Hub
- **Estado:** Activo y creciendo. Hub tipo "Docker Hub para AI coding".
- **Features:** Sistema de "Blocks" componibles (models, rules, context, prompts, MCP servers).
- **Oportunidad:** TokenDoc podria publicarse como Block/MCP server en Continue Hub para ganar distribucion.

### DeepWiki (Cognition AI / Devin)
- **Estado:** Activo, +50K repos publicos indexados. Version open source disponible.
- **Features:** Docs interactivos generados por AI, diagramas de estructura, asistente integrado.
- **COMPETIDOR MAS DIRECTO** pero con gaps claros:
  - Solo repos PUBLICOS de GitHub
  - Docs generados por AI (no curados)
  - Snapshot, no live
  - No bidireccional (no write-back)
  - No optimizado para tokens
- **Diferenciador nuestro:** Repos privados/locales, docs curados + optimizados para tokens, bidireccional, MCP-native.

---

## Nuevos competidores detectados (no estaban en radar)

| Player | Que hace | Relevancia |
|--------|----------|-----------|
| **RooCode** | Agente para cambios multi-archivo en codebases grandes | Competidor indirecto, mas lento y caro pero preciso |
| **Packmind** | Context engineering a escala organizacional | Enterprise, industrializa contexto para equipos |
| **Tessl / Ruler** | Context engineering enterprise | Emergentes, poca info publica |
| **AGENTS.md** | Standard abierto (Linux Foundation) para interaccion agente-codebase | Adoptado por todos los agentes principales. Complementario a TokenDoc |
| **Windsurf (ex-Codeium)** | IDE propio con contexto de codebase | Competidor IDE-based |

### AGENTS.md — importante
Standard abierto respaldado por Linux Foundation (early 2026). Define como los agentes deben interactuar con un codebase. Adoptado por decenas de miles de repos. **TokenDoc es complementario:** AGENTS.md define interaccion, TokenDoc documenta arquitectura. Considerar compatibilidad.

---

## MCP Servers de codebase que YA existen

| Proyecto | Enfoque | Tech | Stars |
|----------|---------|------|-------|
| **zilliztech/claude-context** | Semantic code search con vector DB | TS + Milvus/Zilliz | - |
| **johnhuang316/code-index-mcp** | Index + search + analyze con tree-sitter | TS, 10 lenguajes | - |
| **trondhindenes/code-index-mcp** | Fast local search con Zoekt (trigram) | TS + Zoekt | - |
| **DeusData/codebase-memory-mcp** | Knowledge graph persistente, sub-ms queries | Rust, 66 lenguajes | Claims 99% menos tokens |
| **CodeGraphContext** | Grafo de codigo en graph DB | - | - |

### Diferenciacion de TokenDoc vs estos MCP servers

Estos servers dan **busqueda semantica on-demand** (query → resultado). TokenDoc da algo distinto:

1. **Contexto arquitectural curado** — no solo "encuentra la funcion X", sino "entiende el modulo login: sus archivos, schema, dependencias, decisiones, historial"
2. **Bidireccional** — el agente ESCRIBE decisiones y cambios, no solo lee
3. **Documentacion generada** — dashboard visual para humanos, no solo API para agentes
4. **Optimizado para tokens** — bundles pre-computados, no queries en runtime
5. **Team-facing** — visibilidad para el team lead, no solo para el dev individual

**Posicionamiento:** TokenDoc es complementario a estos indexers. Ellos resuelven "encuentra codigo", TokenDoc resuelve "entiende el proyecto".

---

## Como reducen tokens con Claude Code hoy (2026)

| Estrategia | Reduccion | Descripcion |
|-----------|----------|-------------|
| CLAUDE.md minimalista | ~40-50% | <200 lineas, mover detalles a Skills |
| Skills on-demand | Variable | Instrucciones que se cargan solo al invocar |
| .claudeignore | ~30-40% | Excluir node_modules, builds, irrelevantes |
| context-mode (MCP) | Hasta 98% | Offload outputs a SQLite, pasar solo resumenes |
| Token Savior | Significativa | Symbol-level lookups via tree-sitter |
| Reducir Extended Thinking | ~40-65% | Bajar MAX_THINKING_TOKENS |
| Verbosidad reducida | ~65-87% | Respuestas cortas, sin filler |
| Tree-sitter knowledge graphs | Hasta 49x | Para monorepos, solo simbolos relevantes |

**Repos notables:**
- `drona23/claude-token-efficient` — CLAUDE.md minimalista plug-and-play
- `nadimtuhin/claude-token-optimizer` — 83-87% reduccion tipica

**Insight:** La comunidad esta resolviendo esto con hacks (CLAUDE.md, .claudeignore, configs). Nadie ofrece una solucion estructurada que combine contexto curado + documentacion + write-back. Ese es el espacio de TokenDoc.

---

## Tecnologias evaluadas — decisiones tomadas

| Decision | Elegido | Descartado | Razon |
|----------|---------|-----------|-------|
| Parser | **ast-grep** (`@ast-grep/napi`) | tree-sitter puro, babel, ts-morph | Ergonomia + performance + sin node-gyp |
| Docs framework | **Docusaurus** | MkDocs Material | MkDocs en mantenimiento desde nov 2025 |
| Package manager | **pnpm** | npm, yarn, bun | Aislamiento estricto, workspace protocol |
| Build tool | **tsup** | tsc, esbuild directo, rollup | Standard de facto, genera ESM + CJS |
| Test framework | **Vitest** | Jest | 5-28x mas rapido, ESM nativo |
| Linter | **Biome** | ESLint + Prettier | 10-25x mas rapido, todo en uno |
| Estructura | **Single package** | Monorepo | Un solo npm package (CLI + server + core) |
| ERD generation | **Mermerd + scripts** | Manual | Auto-genera desde DB o modelos |
| Licencia | **Pendiente** | - | MIT vs Apache 2.0 vs AGPL |

---

## Gaps reales que TokenDoc cubre (validados)

1. **Documentacion curada vs generada por AI** — DeepWiki/indexers generan contexto bruto. TokenDoc ofrece contexto humano-en-el-loop que reduce alucinaciones.

2. **Repos privados/locales** — DeepWiki solo repos publicos. MCP indexers son locales pero sin docs. TokenDoc = local-first + docs.

3. **Optimizacion explicita de tokens/costo** — Nadie se posiciona como "documentacion disenada para minimizar tokens". Los hacks son configs de CLAUDE.md, no documentacion del codebase.

4. **Agnostico de LLM/agente** — Los bundles son JSON/Markdown. Funcionan con Claude Code, Cursor, Copilot, Continue, cualquier agente.

5. **Bidireccional** — NINGUN competidor ofrece write-back del agente. Es el diferenciador mas claro.

6. **Post-Sourcegraph void** — Cody Free/Pro murio. Segmento individual y equipos pequenos sin solucion.

7. **Complementario a AGENTS.md** — AGENTS.md define interaccion, TokenDoc documenta arquitectura. Son capas distintas.

---

## Preguntas de investigacion respondidas

| Pregunta | Respuesta |
|----------|----------|
| Alguien ya hizo un MCP de contexto? | Si, 5+ proyectos. Pero ninguno bidireccional ni con docs generados |
| tree-sitter performance en 500+ archivos? | Segundos. Linux kernel (75K archivos) en ~3 min |
| MCP limite de respuesta? | No hay limite formal. Practico: 256-512 KB max |
| MkDocs sigue siendo buena opcion? | NO. Modo mantenimiento. Usar Docusaurus |
| Hay mercado post-Sourcegraph? | SI. Cody Free/Pro discontinuado, vacio real |

## Preguntas aun abiertas

1. **Pricing futuro** — Per-seat vs per-repo vs freemium con hosted SaaS?
2. **AGENTS.md compatibilidad** — TokenDoc deberia generar/consumir AGENTS.md?
3. **Continue Hub distribucion** — Publicar TokenDoc como Block en Continue Hub?
4. **Wedge de entrada** — "Ahorra tokens" (CFO) vs "entiende tu codebase" (team lead)?
5. **Licencia** — MIT (maxima adopcion) vs AGPL (proteccion comercial)?
