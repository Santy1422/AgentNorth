# 07 — Stack Validado con Fuentes

Resumen de todas las decisiones tecnicas tomadas despues de la investigacion de mayo 2026.

---

## Decisiones finales

### 1. Parser: ast-grep (`@ast-grep/napi`)

**Descartados:** tree-sitter puro, Babel parser, ts-morph

| Criterio | ast-grep | tree-sitter puro | ts-morph |
|----------|----------|-----------------|----------|
| Instalacion | Binarios precompilados | Requiere node-gyp (C) | JS puro pero pesado |
| API | Patrones como codigo | S-expressions complejas | OOP, alto nivel |
| Performance | Rust + tree-sitter | C nativo | Lenta (carga type checker) |
| Multi-lenguaje | 40+ | 40+ | Solo TS/JS |
| Para 500+ archivos | Segundos | Segundos | Problematica (memoria) |

**Fuentes:**
- https://ast-grep.github.io/guide/introduction.html
- https://ast-grep.github.io/guide/api-usage/js-api.html
- https://www.npmjs.com/package/@ast-grep/napi

---

### 2. Docs framework: Docusaurus

**Descartado:** MkDocs Material (modo mantenimiento desde nov 2025)

- MkDocs Material: solo bugfixes hasta nov 2026, ecosistema fragmentado, Insiders eliminado mayo 2026
- Docusaurus: activo, Meta-backed, releases semanales, roadmap v4.0, 64k stars
- Alineado con nuestro stack (JS/TS vs Python)

**Fuentes:**
- https://github.com/squidfunk/mkdocs-material/issues/8523
- https://docusaurus.io/docs
- https://docsio.co/blog/docusaurus-vs-mkdocs

---

### 3. Package manager: pnpm

**Razon:** Aislamiento estricto de dependencias, eficiencia en disco, protocol `workspace:*` si escalamos a monorepo.

---

### 4. Build tool: tsup

**Razon:** esbuild interno, genera ESM + CJS + .d.ts, standard de facto para CLIs/librerias TS en 2026.

**Fuentes:**
- https://www.pkgpulse.com/blog/tsup-vs-rollup-vs-esbuild-2026

---

### 5. Test framework: Vitest

**Razon:** 5-28x mas rapido que Jest, ESM nativo, config zero, API compatible con Jest.

**Fuentes:**
- https://tech-insider.org/vitest-vs-jest-2026/

---

### 6. Linter/Formatter: Biome

**Razon:** 10-25x mas rapido que ESLint, combina linting + formatting, 423+ reglas, type-aware.

**Fuentes:**
- https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026

---

### 7. MCP Server: @modelcontextprotocol/sdk v1.29+

**Notas criticas de implementacion:**
- `"type": "module"` obligatorio en package.json (ESM-only)
- tsconfig: `"module": "Node16"`, `"moduleResolution": "Node16"`
- NUNCA `console.log()` en STDIO transport (rompe JSON-RPC)
- API actual: `server.registerTool()` con Zod schemas
- Respuestas max ~256-512 KB practico
- Tools simples <200ms
- Prefijo `tokendoc_` en nombres de tools (MCP best practice)
- Max 5-15 tools por server

**Fuentes:**
- https://modelcontextprotocol.io/docs/develop/build-server
- https://github.com/modelcontextprotocol/typescript-sdk
- https://www.philschmid.de/mcp-best-practices
- https://dev.to/jangwook_kim_e31e7291ad98/build-an-mcp-server-with-typescript-2026-tutorial-1ipk

---

### 8. Estructura: Single package

**Razon:** Un solo npm package con CLI + server + core. La separacion se logra con carpetas (`src/cli/`, `src/server/`, `src/core/`). Migrar a monorepo solo si se publican paquetes separados.

---

### 9. ERD generation: Mermerd + scripts custom

**Mermerd:** Genera Mermaid ERD desde DB directamente (Go CLI).
**Scripts custom:** Para generar desde modelos ORM/migraciones.

**Fuentes:**
- https://github.com/KarnerTh/mermerd
- https://mermaid.js.org/syntax/entityRelationshipDiagram.html

---

### 10. Distribucion: 7+ MCP registries + Continue Hub + AGENTS.md

- Publicar en: Official MCP Registry, Smithery, Glama, MCP Market, MCP.so, Continue Hub
- Generar AGENTS.md automaticamente como feature de distribucion viral

**Fuentes:**
- https://registry.modelcontextprotocol.io/
- https://smithery.ai/
- https://agents.md/

---

### 11. Visualizacion interactiva: React Flow (no solo Mermaid)

**Para dependency graphs interactivos:** React Flow (nodos custom, click → navegar, drag & zoom, minimap)
**Para ERDs estaticos:** Mermaid.js (mas rapido de implementar, text-based, generable desde schema)

Mermaid tiene limitaciones en React: requiere `'use client'`, `securityLevel: 'loose'` para clicks, callbacks deben ser globales. React Flow es nativo React, sin estos problemas.

**Fuentes:**
- https://reactflow.dev/
- https://www.npmjs.com/package/mermaid-graph

---

### 12. Dashboard API: Hono (dentro de Next.js)

Integrar via `app/api/[[...route]]/route.ts`. Middleware built-in:
- `hono/bearer-auth` para validar API keys
- `@hono/zod-validator` para validacion de inputs
- `hono-rate-limiter` para rate limiting por org_key
- RPC client para type-safety end-to-end con el frontend

**Fuentes:**
- https://hono.dev/docs/getting-started/nextjs
- https://vercel.com/templates/hono/hono-nextjs

---

### 13. MongoDB Atlas + NextAuth.js + Mongoose

- **DB:** MongoDB Atlas (free tier 512MB, no se pausa, schema flexible)
- **Auth:** NextAuth.js con GitHub OAuth provider
- **ODM:** Mongoose (schema validation, populate, hooks, TypeScript support)
- **API keys propias:** Prefijo plaintext (`tdoc_org_xxx`) + hash bcrypt (cost 12). Lookup por prefijo, verify con bcrypt.compare()
- **Realtime:** MongoDB Change Streams + Server-Sent Events (SSE) al dashboard
- **TTL indexes:** usage_events se auto-borran a 90 dias sin cron
- **Vector Search:** Atlas Vector Search para busqueda semantica futura (Fase 3)

**Por que MongoDB sobre Postgres:**
- Schema flexible: bundles y modules tienen estructura variable por proyecto
- Embedded documents: modules dentro de projects, sin JOINs
- Alta escritura: usage_events recibe muchos inserts
- TTL indexes nativos para auto-limpieza
- Change Streams nativos para realtime
- Atlas free tier no se pausa (Supabase si)

**Fuentes:**
- https://www.mongodb.com/docs/atlas/
- https://next-auth.js.org/
- https://mongoosejs.com/

---

### 14. Licencia: Apache 2.0

**Decidido.** Proteccion de patentes, trademark, no asusta enterprises. Si alguien hostea tu codigo, ya validaste el mercado.

**Fuentes:**
- https://choosealicense.com/licenses/apache-2.0/

---

### 15. npm publishing: OIDC Trusted Publishing

Classic Tokens eliminados dic 2025. Nuevo flujo:
1. Configurar Trusted Publishing en npmjs.com para el repo
2. GitHub Action con `permissions: { id-token: write }`
3. `npm publish --provenance --access public`
4. Provenance automatico con Sigstore, sin tokens

**Fuentes:**
- https://docs.npmjs.com/trusted-publishers/
- https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/

---

## tsconfig.json recomendado

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## package.json clave

```jsonc
{
  "name": "tokendoc",
  "version": "0.1.0",
  "type": "module",
  "description": "Shared Context Layer for teams with AI coding agents",
  "license": "Apache-2.0",
  "bin": {
    "tokendoc": "./dist/bin/tokendoc.js"
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/santiagogarcia/tokendoc"
  },
  "engines": {
    "node": ">=22.14.0"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "lint": "biome check .",
    "prepublishOnly": "npm run build"
  }
}
```

## tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/bin/tokendoc.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
```

## npm publish — OIDC Trusted Publishing (sin tokens)

npm elimino Classic Tokens en dic 2025. Ahora se usa OIDC:

```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write    # CRITICO para OIDC
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --provenance --access public
```

Provenance se genera automaticamente con Sigstore. No se necesita NODE_AUTH_TOKEN.

---

## MCP servers existentes como referencia

| Proyecto | Para estudiar |
|----------|--------------|
| zilliztech/claude-context | Semantic search pattern |
| johnhuang316/code-index-mcp | Tree-sitter indexing approach |
| DeusData/codebase-memory-mcp | Knowledge graph, claims 99% menos tokens |
| code-index-mcp (trondhindenes) | Zoekt trigram search |
