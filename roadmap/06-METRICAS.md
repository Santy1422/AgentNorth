# 06 — Metricas y Criterios Go/No-Go

## KPIs por fase

### Fase 1 — MCP Server

| Metrica | Cómo medir | Target |
|---------|-----------|--------|
| Tokens ahorrados por sesión | Comparar sesión con/sin TokenDoc en misma tarea | >=40% reducción |
| Tiempo de respuesta `get_context` | Logs del MCP server | <500ms |
| Módulos indexados (DGuard) | Contar bundles generados | >=5 módulos |
| Calidad del bundle | Review manual: el bundle contiene info útil? | Subjetivo pero documentado |
| Write-back adoption | El agente usa `log_decision`/`log_change` sin prompt excesivo? | >=1 log por sesión |

### Fase 2 — Docs/Dashboard

| Metrica | Cómo medir | Target |
|---------|-----------|--------|
| GitHub stars | GitHub | >=50 orgánicas |
| Equipos usando | Issues, discussions, forks activos | >=5 |
| Time-to-understand | Dev nuevo lee docs, resuelve tarea — tiempo | <30 min para módulo nuevo |
| Docs freshness | Delta entre último commit y última regeneración | <24h |

### Fase 3 — SaaS (si aplica)

| Metrica | Target |
|---------|--------|
| MRR | >$1K para validar pricing |
| Equipos pagando | >=3 |
| Churn mensual | <10% |
| NPS | >40 |

---

## Benchmark protocol (Fase 1)

### Setup
1. Elegir 3 tareas reales de DGuard de complejidad media
2. Cada tarea se ejecuta 2 veces: con y sin TokenDoc
3. Medir: tokens consumidos, archivos leídos, tiempo total, calidad del resultado

### Tareas candidatas para benchmark

| Tarea | Modulo | Complejidad |
|-------|--------|-------------|
| Agregar campo a modelo de tenant | tenants | Media |
| Fix bug en middleware de auth | auth | Media |
| Agregar webhook handler para billing | billing | Media-Alta |

### Qué medir exactamente

```
Sin TokenDoc:
  - Tokens de input (archivos leídos por Claude)
  - Tokens de output
  - Número de tool calls (grep, read, glob)
  - Tiempo de sesión
  - Resultado correcto? (sí/no)

Con TokenDoc:
  - Tokens de input (bundle + archivos adicionales)
  - Tokens de output
  - Número de tool calls
  - Tiempo de sesión
  - Resultado correcto? (sí/no)
  - Decisiones/cambios loggeados por el agente
```

---

## Criterios Go/No-Go

### Fase 1 completada → Go a Fase 2?

| Criterio | Requerido |
|----------|----------|
| MCP server funciona estable | Si |
| Benchmark muestra >=30% ahorro tokens | Si |
| Write-back funciona (bidireccional confirmado) | Si |
| Santi lo usa en su workflow real | Si |
| Toma más de 1 semana extra de lo planeado | Warning |

### Fase 2 completada → Go a Fase 3?

| Criterio | Requerido |
|----------|----------|
| >=50 GitHub stars | Si |
| >=5 equipos activos | Si |
| Alguien pregunta "puedo pagar por esto?" | Fuerte señal |
| Sourcegraph/Anthropic shippean equivalente | No-go, pivotar |
| Santi no tiene bandwidth | No-go, pausar |

---

## Timeline de validacion

```
Semana 1-2:  Construir Fase 1
Semana 3:    Benchmark en DGuard, publicar números
Semana 4:    Publicar repo + post LinkedIn
Semana 5-6:  Construir Fase 2 si Fase 1 valida
Semana 7-8:  Medir tracción, evaluar Fase 3
```

Si en semana 8 no hay señal → archivar limpio y seguir.
