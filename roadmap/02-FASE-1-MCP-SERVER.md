# 02 — Fase 1: MCP Server Local (Dogfood DGuard)

**Objetivo:** MCP server funcional que ahorra tokens reales en DGuard

---

## Escenarios de uso: repo nuevo vs existente vs con docs

TokenDoc tiene que funcionar en 3 escenarios distintos. El flujo de `tokendoc init` se adapta a cada uno.

### Escenario A: Repo nuevo (sin docs, sin estructura clara)

```
$ tokendoc init

Detectado: repo sin .tokendoc/, sin docs existentes
→ Escanea estructura de carpetas
→ Sugiere modulos basado en heuristica (carpetas top-level en src/)
→ Genera config inicial: .tokendoc/config.yaml
→ Genera bundles vacios listos para poblar
→ Crea decisions/ y changelog/ vacios
→ Output: "Repo inicializado. Ejecuta `tokendoc index` para generar bundles."
```

**Que genera:**
```
.tokendoc/
  config.yaml              ← modulos detectados, el usuario edita/confirma
  bundles/                 ← vacios hasta primer `tokendoc index`
  decisions/               ← vacio, listo para write-back
  changelog/               ← vacio, listo para write-back
  conventions.yaml         ← template con campos vacios para que el usuario llene
```

### Escenario B: Repo existente sin docs (el caso mas comun)

```
$ tokendoc init

Detectado: repo con codigo, sin .tokendoc/
→ Escanea con ast-grep: archivos, modulos, imports, exports
→ Detecta frameworks (Next.js, Express, NestJS, Django, etc.)
→ Sugiere agrupacion de modulos
→ El usuario confirma/edita en config.yaml
→ Ejecuta `tokendoc index` automaticamente
→ Output: "Indexados N modulos con M archivos. Bundles generados."
```

**Que genera:**
```
.tokendoc/
  config.yaml              ← modulos detectados + framework detectado
  bundles/
    auth.json              ← bundle completo con archivos, exports, imports
    billing.json
    tenants.json
  decisions/               ← vacio
  changelog/               ← vacio
  conventions.yaml         ← pre-llenado con convenciones detectadas (naming, test patterns)
```

### Escenario C: Repo con documentacion existente (README, docs/, wiki)

```
$ tokendoc init

Detectado: repo con docs existentes (README.md, docs/, .md files)
→ Todo lo de Escenario B
→ ADEMAS: escanea docs existentes
→ Extrae decisiones de arquitectura de docs (heuristico)
→ Extrae convenciones mencionadas en docs
→ Las incorpora al bundle como decisions[] y conventions[]
→ Output: "Indexados N modulos. Importadas K decisiones de docs existentes."
```

**Que genera adicional:**
```
.tokendoc/
  decisions/
    imported-001.md        ← decisiones extraidas de docs existentes
    imported-002.md
  conventions.yaml         ← convenciones extraidas de docs + detectadas del codigo
```

### Regla de oro
**TokenDoc nunca borra ni modifica docs existentes.** Solo genera dentro de `.tokendoc/`. Los docs originales del repo quedan intactos.

---

## Features divididas por componente

### Feature 1: CLI (`src/cli/`)

| Comando | Que hace | Escenario |
|---------|----------|-----------|
| `tokendoc init` | Detecta escenario (A/B/C), genera config, primer index | Setup inicial |
| `tokendoc init --interactive` | Modo paso a paso, pregunta cada modulo | Repos complejos |
| `tokendoc index` | Re-escanea repo, regenera todos los bundles | Despues de cambios |
| `tokendoc index --module auth` | Re-indexa solo un modulo | Rapido, parcial |
| `tokendoc add-decision` | Crea decision manual desde terminal | Humano quiere registrar |
| `tokendoc status` | Muestra modulos indexados, freshness, warnings | Debug/overview |
| `tokendoc serve` | Inicia MCP server para Claude Code | Runtime |

### Feature 2: Parser/Indexer (`src/core/`)

| Subfeature | Que extrae | Como |
|------------|-----------|------|
| File scanner | Lista de archivos por modulo | glob + config.yaml |
| AST parser | imports, exports, funciones, clases, interfaces, tipos | `@ast-grep/napi` |
| Dependency mapper | Que modulo importa que otro modulo | AST imports → match con modulos conocidos |
| Schema extractor | Modelos ORM, tablas, migraciones | Patterns ast-grep para Prisma/TypeORM/Drizzle/Sequelize |
| Git integrator | Ultimos N commits por modulo | `git log --follow -- path/` |
| Convention detector | Naming patterns, test structure, file patterns | Heuristicas sobre el codigo |

### Feature 3: MCP Server (`src/server/` + `src/tools/`)

| Tool | Tipo | Input | Output |
|------|------|-------|--------|
| `tokendoc_list_modules` | Read | ninguno | `{ modules: [{ name, files_count, last_indexed }] }` |
| `tokendoc_get_context` | Read | `{ module: string }` | Bundle completo (archivos, schema, deps, decisions, changes) |
| `tokendoc_get_schema` | Read | `{ module: string }` | Solo schema + ERD mermaid |
| `tokendoc_get_decisions` | Read | `{ module?: string }` | Decisiones filtradas por modulo o todas |
| `tokendoc_log_decision` | **Write** | `{ module, title, context, decision }` | Confirma escritura en .tokendoc/decisions/ |
| `tokendoc_log_change` | **Write** | `{ module, summary, files_changed, breaking?, notes? }` | Confirma escritura en .tokendoc/changelog/ |

### Feature 4: Generators (`src/generators/`)

| Generator | Input | Output |
|-----------|-------|--------|
| Markdown generator | bundles/*.json | docs/modules/*.md (un .md por modulo) |
| Architecture generator | todos los bundles | docs/ARCHITECTURE.md (overview del proyecto) |
| Mermaid ERD generator | schema de cada bundle | docs/erds/*.mmd |
| Mermaid dependency graph | dependencies de cada bundle | docs/DEPENDENCY-MAP.mmd |

---

## Tareas detalladas por semana

### Semana 1: Core (parser + server + write-back)

| # | Tarea | Feature | Prioridad | Deps |
|---|-------|---------|-----------|------|
| 1.1 | Setup repo: pnpm init, tsconfig (ES2022/Node16), tsup, vitest, biome | Infra | Alta | - |
| 1.2 | Definir tipos core: `ContextBundle`, `FileRef`, `Decision`, `RecentChange`, `Config` | Core | Alta | 1.1 |
| 1.3 | Definir Zod schemas para validacion de inputs MCP y config | Core | Alta | 1.2 |
| 1.4 | Implementar config loader: lee `.tokendoc/config.yaml`, valida con Zod | CLI | Alta | 1.3 |
| 1.5 | Implementar file scanner: dado un modulo en config → lista archivos | Core | Alta | 1.4 |
| 1.6 | Implementar AST parser con `@ast-grep/napi`: extraer imports, exports, funciones, clases | Core | Alta | 1.1 |
| 1.7 | Implementar bundle generator: file scanner + AST parser → bundle JSON | Core | Alta | 1.5, 1.6 |
| 1.8 | Scaffold MCP server con `@modelcontextprotocol/sdk` + StdioServerTransport | Server | Alta | 1.1 |
| 1.9 | Implementar tool `tokendoc_list_modules` | Server | Alta | 1.4 |
| 1.10 | Implementar tool `tokendoc_get_context` (lee bundle, paginacion si >256KB) | Server | Alta | 1.7 |
| 1.11 | Implementar tool `tokendoc_log_decision` (write-back) | Server | Alta | 1.8 |
| 1.12 | Implementar tool `tokendoc_log_change` (write-back) | Server | Alta | 1.8 |

### Semana 2: CLI + Generators + Benchmark

| # | Tarea | Feature | Prioridad | Deps |
|---|-------|---------|-----------|------|
| 2.1 | Implementar `tokendoc init` (detecta escenario A/B/C, genera config) | CLI | Alta | 1.4, 1.6 |
| 2.2 | Implementar `tokendoc index` (re-escanea, regenera bundles) | CLI | Alta | 1.7 |
| 2.3 | Implementar `tokendoc serve` (inicia MCP server) | CLI | Alta | 1.8 |
| 2.4 | Implementar schema extractor (Prisma/TypeORM/Drizzle patterns) | Core | Media | 1.6 |
| 2.5 | Implementar tool `tokendoc_get_schema` | Server | Media | 2.4 |
| 2.6 | Implementar tool `tokendoc_get_decisions` | Server | Media | 1.11 |
| 2.7 | Implementar git integrator (ultimos commits por modulo) | Core | Media | 1.5 |
| 2.8 | Markdown generator: docs/modules/*.md desde bundles | Generator | Media | 1.7 |
| 2.9 | Architecture generator: ARCHITECTURE.md overview | Generator | Media | 1.7 |
| 2.10 | Mermaid ERD generator desde schemas | Generator | Media | 2.4 |
| 2.11 | Mermaid dependency graph desde imports | Generator | Media | 1.7 |
| 2.12 | Probar en DGuard: init, index, serve, usar con Claude Code | Test | Alta | Todo |
| 2.13 | Benchmark: 3 tareas con/sin TokenDoc, medir tokens | Test | Alta | 2.12 |
| 2.14 | README.md con instrucciones, demo, numeros reales | Docs | Media | 2.13 |

---

## Estrategia de testing

### Niveles de test

```
Unit tests (vitest)
  └── Cada funcion del core se testea aislada
      ├── parser.test.ts      → AST extraction
      ├── scanner.test.ts     → File discovery
      ├── bundler.test.ts     → Bundle generation
      ├── config.test.ts      → Config loading/validation
      └── git.test.ts         → Git log parsing

Integration tests (vitest)
  └── Componentes conectados
      ├── indexer.test.ts     → scanner + parser + bundler end-to-end
      ├── tools.test.ts       → MCP tools con bundles reales
      └── writeback.test.ts   → log_decision + log_change → filesystem

E2E tests (vitest + fixtures)
  └── Flujo completo
      ├── init.test.ts        → tokendoc init en repo fixture → valida output
      ├── index.test.ts       → tokendoc index en repo fixture → valida bundles
      └── server.test.ts      → MCP server responde tools correctamente
```

### Fixtures de test

Crear repos de prueba minimos en `test/fixtures/`:

```
test/fixtures/
  repo-nuevo/              ← Escenario A: repo vacio con src/
    src/
      auth/
        middleware.ts
        jwt.ts
      billing/
        stripe.ts
        invoices.ts
      index.ts

  repo-existente/          ← Escenario B: repo con codigo real
    src/
      modules/
        users/
          user.model.ts
          user.service.ts
          user.controller.ts
        orders/
          order.model.ts
          order.service.ts
    package.json
    tsconfig.json

  repo-con-docs/           ← Escenario C: repo con docs previos
    src/
      auth/
        ...
    docs/
      architecture.md
      decisions/
        001-use-prisma.md
    README.md
```

### Que testear por feature

| Feature | Tests | Que valida |
|---------|-------|-----------|
| **AST Parser** | Dado un archivo TS → extrae imports correctos, exports correctos, funciones con nombres | Precision del parsing |
| **File Scanner** | Dado config con modulo "auth" apuntando a `src/auth/` → lista archivos .ts/.tsx | Descubrimiento correcto |
| **Bundle Generator** | Dado scanner + parser → genera bundle JSON valido con schema correcto | Estructura del bundle |
| **Config Loader** | Dado YAML valido → carga config. Dado YAML invalido → error claro | Validacion robusta |
| **MCP get_context** | Dado bundle existente → devuelve contenido correcto. Bundle >256KB → pagina | Respuesta correcta |
| **MCP log_decision** | Dado input valido → crea archivo .md en decisions/. Input invalido → error | Write-back funcional |
| **MCP log_change** | Dado input valido → append en changelog/. Valida formato | Write-back funcional |
| **Init (escenario A)** | Repo vacio → genera config con modulos sugeridos | Deteccion heuristica |
| **Init (escenario B)** | Repo con codigo → genera config + bundles | Index automatico |
| **Init (escenario C)** | Repo con docs → importa decisiones existentes | Parsing de docs |
| **Generators** | Bundle → markdown correcto, Mermaid ERD valido | Output generado |

### Reglas de testing

1. **Cada tool MCP tiene al menos 3 tests:** happy path, input invalido, edge case
2. **Los fixtures son repos git reales** (con `git init` en setup) para que git integrator funcione
3. **No mockear filesystem** — usar directorios temporales reales (vitest `beforeEach` + `tmpdir`)
4. **Tests de write-back validan que el archivo escrito es commitable** (formato correcto, path correcto)
5. **Snapshot tests para generators** — el markdown/mermaid generado se compara contra snapshot

---

## Bidireccionalidad — detalle

La bidireccionalidad es core, no un nice-to-have. El agente no solo consume contexto, tambien lo produce.

### Flujo de write-back

```
Sesion de Claude Code en DGuard:
  1. Agente llama tokendoc_get_context("auth") → recibe bundle
  2. Agente trabaja, toma decisiones, modifica codigo
  3. Agente llama tokendoc_log_decision({
       module: "auth",
       title: "Migrar de session cookies a JWT bearer tokens",
       context: "El middleware actual no escala con microservicios",
       decision: "Usar JWT en header Authorization, no en cookies"
     })
  4. Agente llama tokendoc_log_change({
       module: "auth",
       summary: "Refactorizado middleware de auth para JWT bearer",
       files_changed: ["src/auth/middleware.ts", "src/auth/jwt.ts"],
       breaking: true,
       notes: "Los tests de auth necesitan actualizar headers"
     })
  5. Proxima sesion (otro dev o mismo agente) → tokendoc_get_context("auth")
     incluye esta decision y este cambio automaticamente
```

### Que se escribe y donde

| Tipo | Archivo destino | Quien escribe | Formato |
|------|----------------|---------------|---------|
| Decisiones de arquitectura | `.tokendoc/decisions/decision-NNN.md` | Agente via `log_decision` o humano manual | Markdown con frontmatter YAML |
| Registro de cambios | `.tokendoc/changelog/YYYY-MM-DD-HHmm.md` | Agente via `log_change` | Markdown con frontmatter YAML |
| Warnings/notas | `.tokendoc/warnings.yaml` | Humano manual | YAML |
| Convenciones | `.tokendoc/conventions.yaml` | Humano manual, agente las lee | YAML |

### Formato de decision (frontmatter)

```markdown
---
id: decision-007
date: 2026-05-01
author: claude
module: auth
status: active
---

# No usar JWT en cookies

## Contexto
El middleware actual usa cookies para transportar JWT. Esto no escala con microservicios porque cada servicio necesita leer la cookie.

## Decision
Usar JWT en header `Authorization: Bearer <token>`. No en cookies.

## Consecuencias
- Los tests de auth necesitan actualizar headers
- El frontend debe enviar el token en cada request
```

### Formato de changelog entry (frontmatter)

```markdown
---
date: 2026-05-01T14:30:00Z
author: claude
module: auth
breaking: true
files_changed:
  - src/auth/middleware.ts
  - src/auth/jwt.ts
---

# Refactorizado middleware de auth para JWT bearer

Migrado el middleware de autenticacion de cookies a JWT bearer tokens.

## Notas
Los tests de auth necesitan actualizar headers de `Cookie` a `Authorization`.
```

### Regla clave
Todo lo que el agente escribe es **commitable** — vive en el repo, se revisa en PR, es versionable. No hay base de datos externa en Fase 1.

---

## Deteccion de modulos: como funciona

### Fuentes de deteccion (en orden de prioridad)

1. **Config explicita** (config.yaml) — el usuario define modulos manualmente
2. **Carpetas top-level en src/** — heuristica: cada carpeta es un modulo candidato
3. **Framework detection** — patrones conocidos:

| Framework | Patron de modulos |
|-----------|-------------------|
| NestJS | Carpetas con `*.module.ts` |
| Next.js App Router | Carpetas en `app/` |
| Next.js Pages | Archivos en `pages/` |
| Express | Carpetas en `routes/` o `controllers/` |
| Django | Carpetas con `models.py` + `views.py` |
| Laravel | Carpetas en `app/Models/`, `app/Http/Controllers/` |

4. **package.json workspaces** — cada workspace es un modulo

### Config.yaml ejemplo

```yaml
version: 1
project:
  name: dguard
  framework: nestjs  # auto-detectado o manual

modules:
  auth:
    paths:
      - src/auth/
      - src/guards/
    description: "Autenticacion y autorizacion"
    schema_source: prisma  # donde buscar el schema

  tenants:
    paths:
      - src/tenants/
      - src/middleware/tenant-resolver/
    description: "Multi-tenancy isolation"

  billing:
    paths:
      - src/billing/
    description: "Facturacion y pagos con Stripe"
    depends_on:
      - tenants

ignore:
  - node_modules/
  - dist/
  - "*.spec.ts"
  - "*.test.ts"

conventions:
  naming: camelCase
  tests: "*.spec.ts colocated"
  migrations: "prisma/migrations/"
```

---

## Configuracion del MCP server en Claude Code

```json
// .claude/settings.json del repo
{
  "mcpServers": {
    "tokendoc": {
      "command": "npx",
      "args": ["tokendoc", "serve"],
      "env": {}
    }
  }
}
```

---

## Como se envia/expone la documentacion generada

### En Fase 1 (local, sin hosting)

```
tokendoc index        → genera bundles en .tokendoc/bundles/
tokendoc docs         → genera markdown en .tokendoc/docs/
tokendoc serve        → expone bundles via MCP para agentes

Los docs generados son archivos .md que:
  1. Se commitean al repo → legibles en GitHub directamente
  2. Se sirven via MCP tools → el agente los consume
  3. Se pueden abrir localmente → el dev los lee
```

### Que se genera y donde va

```
.tokendoc/docs/
  ARCHITECTURE.md                ← Overview: modulos, dependencias, stack
  DEPENDENCY-MAP.mmd             ← Mermaid: grafo de dependencias entre modulos
  modules/
    auth.md                      ← Detalle: archivos, exports, schema, decisions
    billing.md
    tenants.md
  erds/
    auth.mmd                     ← Mermaid ERD del modulo
    billing.mmd
    tenants.mmd
  decisions/
    INDEX.md                     ← Timeline de todas las decisiones
  changelog/
    INDEX.md                     ← Timeline de cambios de agentes
```

### Flujo completo: repo nuevo → docs listas

```
1. $ cd mi-proyecto
2. $ npx tokendoc init
   → Detecta escenario, genera .tokendoc/config.yaml
   → Sugiere modulos, el usuario confirma

3. $ npx tokendoc index
   → ast-grep parsea todo el codigo
   → Genera bundles JSON por modulo
   → Genera docs markdown + Mermaid ERDs

4. $ npx tokendoc serve
   → Inicia MCP server en STDIO
   → Claude Code puede llamar tokendoc_get_context("auth")

5. El agente trabaja y llama tokendoc_log_decision(...)
   → Se escribe decision en .tokendoc/decisions/

6. $ npx tokendoc index  (o en CI)
   → Regenera bundles incluyendo nuevas decisiones
   → Regenera docs con la decision incluida

7. $ git add .tokendoc/ && git commit
   → Todo queda versionado en el repo
```

---

## Criterio de exito

- [ ] `tokendoc init` funciona en los 3 escenarios (repo nuevo, existente, con docs)
- [ ] `tokendoc index` genera bundles validos en <5s para repo de 200 archivos
- [ ] `tokendoc_get_context("modulo")` devuelve bundle util en <200ms
- [ ] Benchmark muestra >=40% reduccion de tokens en tareas tipicas de DGuard
- [ ] Write-back funciona: decisiones y cambios persisten entre sesiones
- [ ] Docs generados son legibles en GitHub sin setup adicional
- [ ] Probado en DGuard con 3+ modulos reales
- [ ] Tests: >=80% coverage en core, todos los tools MCP testeados
- [ ] Repo publico con README claro + demo con numeros reales
