# CLAUDE.md

## AgentNorth — OBLIGATORIO

Este proyecto usa AgentNorth como Shared Context Layer. El MCP server `agentnorth` esta configurado y DEBE usarse.

### Antes de trabajar en cualquier modulo:
1. Llama `agentnorth_list_modules()` para ver los modulos disponibles
2. Llama `agentnorth_get_context("modulo")` para el modulo que vas a tocar
3. Consulta `agentnorth_get_decisions("modulo")` antes de tomar decisiones nuevas

### Despues de hacer cambios significativos:
4. Llama `agentnorth_log_change()` con un resumen de lo que hiciste
5. Si tomaste una decision de arquitectura, llama `agentnorth_log_decision()`

### Reglas:
- NUNCA explores el repo con grep/glob/read sin antes consultar AgentNorth
- El contexto que necesitas ya esta indexado — usalo
- Si un modulo no esta indexado, ejecuta `agentnorth index` primero
- Las decisiones previas tienen precedencia — no las contradigas sin justificacion

## Stack del proyecto
- pnpm (monorepo)
- TypeScript ESM strict
- Node >= 22.14.0
- Biome (lint + format)
- Vitest (testing)
- tsup (bundling)

## Estructura
```
packages/agentnorth/   — npm package (MCP Server + CLI)
dashboard/             — Next.js 15 dashboard (agentnorth.io)
```
