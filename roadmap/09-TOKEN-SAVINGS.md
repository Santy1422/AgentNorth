# 09 — Calculo Exacto de Tokens Ahorrados

## El KPI mas importante de TokenDoc

> "Cuantos tokens (y dolares) te ahorro" es el unico numero que un CFO entiende.

Si TokenDoc no puede demostrar ahorro real y medible, no hay producto.

---

## Precios actuales Claude API (2026)

| Modelo | Input / MTok | Output / MTok | Cache hit / MTok |
|--------|-------------|--------------|-----------------|
| Haiku 4.5 | $1.00 | $5.00 | $0.10 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Opus 4.6 | $5.00 | $25.00 | $0.50 |
| Opus 4.7 | $5.00 | $25.00 | $0.50 |

**Nota:** Opus 4.7 usa un tokenizer nuevo que puede usar hasta 35% mas tokens para el mismo texto.

---

## Como medir tokens ahorrados: el metodo

### Sin TokenDoc (baseline)

Cuando Claude explora un modulo manualmente:

```
Tarea: "Fix bug en auth middleware"

Claude hace:
  1. Glob("src/auth/**")           → lista archivos        ~500 tokens
  2. Read("src/auth/middleware.ts") → lee archivo           ~2,000 tokens
  3. Read("src/auth/jwt.ts")       → lee archivo           ~1,500 tokens
  4. Grep("AuthGuard")             → busca uso             ~800 tokens
  5. Read("src/auth/guards/...")    → lee mas archivos      ~3,000 tokens
  6. Read("prisma/schema.prisma")  → busca el schema       ~4,000 tokens
  7. Grep("session")               → busca dependencias    ~1,200 tokens
  8. Read("src/config/auth.ts")    → config                ~800 tokens
  9. Read("src/types/auth.ts")     → tipos                 ~600 tokens
  10. ... mas exploracion ...                               ~5,000+ tokens

Total input exploracion: ~20,000-60,000 tokens
A $5/MTok (Opus): $0.10 - $0.30 solo en exploracion
```

### Con TokenDoc

```
Tarea: "Fix bug en auth middleware"

Claude hace:
  1. tokendoc_get_context("auth")  → bundle completo       ~5,000 tokens
     Incluye: archivos, exports, schema, dependencias,
     decisiones previas, cambios recientes
  2. Read("src/auth/middleware.ts") → solo el archivo que necesita ~2,000 tokens

Total input: ~7,000 tokens
A $5/MTok (Opus): $0.035
```

### Ahorro estimado por sesion

```
Sin TokenDoc:  ~40,000 tokens input promedio
Con TokenDoc:  ~10,000 tokens input promedio
Ahorro:        ~30,000 tokens = 75%
A Opus pricing: $0.15 ahorrados por sesion
```

---

## Como medir EXACTAMENTE (no estimaciones)

### Mecanismo 1: Contar tokens en el MCP server

El MCP server sabe exactamente cuantos tokens devuelve en cada bundle.

```typescript
// En cada tool handler del MCP server
async function handleGetContext(module: string) {
  const bundle = await loadBundle(module);
  const response = JSON.stringify(bundle);

  // Contar tokens del response (aproximacion: chars / 4)
  const tokensEstimated = Math.ceil(response.length / 4);

  // Enviar metrica al API
  await trackEvent({
    action: "get_context",
    module,
    tokens_served: tokensEstimated,
    // Estimar cuantos tokens habria costado sin bundle
    tokens_saved_estimate: estimateSavings(bundle),
  });

  return response;
}

function estimateSavings(bundle: ContextBundle): number {
  // Sin TokenDoc, Claude leeria cada archivo completo
  const totalFileLoc = bundle.files.reduce((sum, f) => sum + f.loc, 0);
  const tokensWithoutBundle = totalFileLoc * 5; // ~5 tokens por linea de codigo

  // Con TokenDoc, solo sirve el bundle (resumen)
  const bundleTokens = Math.ceil(JSON.stringify(bundle).length / 4);

  return tokensWithoutBundle - bundleTokens;
}
```

### Mecanismo 2: Hook PostToolUse — contar tokens de Read/Grep/Glob

Contar cuantas veces Claude usa Read/Grep/Glob DESPUES de consultar TokenDoc vs sin consultar.

```bash
#!/bin/bash
# .claude/hooks/tokendoc-count-exploration.sh
# PostToolUse hook para Read, Grep, Glob

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

# Contar tokens del tool output (aproximacion)
OUTPUT_SIZE=$(echo "$INPUT" | jq -r '.tool_output // ""' | wc -c)
TOKENS_APPROX=$((OUTPUT_SIZE / 4))

# Log para analisis
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ),$TOOL,$TOKENS_APPROX" \
  >> "/tmp/tokendoc-exploration-$(date +%Y%m%d).csv"

# Enviar al API
curl -s -X POST https://api.tokendoc.dev/v1/events/exploration \
  -H "X-Org-Key: $TOKENDOC_ORG_KEY" \
  -H "X-Dev-Key: $TOKENDOC_DEV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tool\": \"$TOOL\", \"tokens\": $TOKENS_APPROX}" \
  > /dev/null 2>&1 &
```

### Mecanismo 3: Leer los JSONL logs de Claude Code

Claude Code escribe logs en `~/.claude/projects/*/sessions/`. Cada sesion tiene un JSONL con token counts.

**ADVERTENCIA:** Los JSONL logs de Claude Code subcuentan tokens ~100x para input (bug conocido, el campo `input_tokens` suele ser 0 o 1 durante streaming). No confiar en estos para el calculo exacto.

**Alternativa:** Usar `ccusage` (CLI tool) que lee los JSONL y calcula mejor, o parsear los campos `cache_creation_input_tokens` y `cache_read_input_tokens` que si son mas fiables.

### Mecanismo 4: Comparar sesiones con/sin TokenDoc en el API

El API de TokenDoc tiene ambos datos:
- Eventos `get_context` con `tokens_served` (lo que sirvio el bundle)
- Eventos `exploration` con `tokens` (lo que Claude leyo manualmente)

```sql
-- Tokens ahorrados por sesion
SELECT
  s.id,
  s.dev_id,
  s.started_at,
  SUM(e.tokens_saved_estimate) as tokens_saved,
  SUM(e.tokens_served) as tokens_via_tokendoc,
  SUM(ex.tokens) as tokens_exploration
FROM sessions s
JOIN usage_events e ON e.session_id = s.id AND e.action = 'get_context'
LEFT JOIN usage_events ex ON ex.session_id = s.id AND ex.action = 'exploration'
GROUP BY s.id;
```

---

## Lo que muestra el dashboard

### Por sesion

```
+------------------------------------------------------------------+
|  Session: Santi — May 1, 14:30                    Duration: 18m  |
+------------------------------------------------------------------+
|                                                                   |
|  Tokens via TokenDoc:    5,200  (get_context x2)                 |
|  Tokens exploracion:     3,400  (Read x3, Grep x1)              |
|  Total input tokens:     8,600                                   |
|                                                                   |
|  Estimado sin TokenDoc:  42,000 tokens                           |
|  ─────────────────────────────────────────                       |
|  AHORRO:                 33,400 tokens (79%)                     |
|  AHORRO en $:            $0.167 (Opus 4.6)                       |
|                                                                   |
|  Decisions logged: 1    Changes logged: 1                        |
+------------------------------------------------------------------+
```

### Por dev (mensual)

```
+------------------------------------------------------------------+
|  Developer: Santi                              May 2026          |
+------------------------------------------------------------------+
|                                                                   |
|  Sessions: 42        Total tokens via TokenDoc: 218K             |
|  Avg session: 15min  Total exploration tokens:  89K              |
|                      Estimated without TokenDoc: 1.2M            |
|                                                                   |
|  AHORRO MENSUAL:     893K tokens                                 |
|  AHORRO en $:        $4.47 (Opus) / $2.68 (Sonnet)              |
|                                                                   |
|  [Chart: tokens ahorrados por dia]                               |
|  ██████████░ May 1                                                |
|  ████████░░░ May 2                                                |
|  ...                                                              |
+------------------------------------------------------------------+
```

### Por organizacion (mensual)

```
+------------------------------------------------------------------+
|  Organization: DGuard Team                     May 2026          |
+------------------------------------------------------------------+
|                                                                   |
|  Devs active: 4      Sessions: 156                              |
|  Tokens served:       890K                                       |
|  Tokens saved (est):  3.4M                                      |
|                                                                   |
|  AHORRO MENSUAL:      $17.00 (Opus) / $10.20 (Sonnet)           |
|                                                                   |
|  By dev:                                                         |
|  Santi    42 sessions  893K saved   $4.47                        |
|  Juan     38 sessions  812K saved   $4.06                        |
|  Maria    45 sessions  980K saved   $4.90                        |
|  CI Agent 31 sessions  715K saved   $3.58                        |
|                                                                   |
|  [Breakdown por modulo]                                          |
|  auth:    1.1M saved   billing: 890K saved   tenants: 620K      |
+------------------------------------------------------------------+
```

### Proyeccion anual

```
+------------------------------------------------------------------+
|  ROI Projection                                                  |
+------------------------------------------------------------------+
|                                                                   |
|  Current monthly savings:  3.4M tokens / $17.00                  |
|  Projected annual:         40.8M tokens / $204.00                |
|                                                                   |
|  If team grows to 10 devs: ~$510/year saved                     |
|  If team grows to 30 devs: ~$1,530/year saved                   |
|                                                                   |
|  Note: ahorro en tokens de INPUT solamente.                      |
|  No incluye ahorro en OUTPUT (menos exploracion = menos output)  |
|  No incluye ahorro en TIEMPO (sesiones mas cortas)               |
+------------------------------------------------------------------+
```

---

## Modelo de datos para token tracking

```typescript
// usage_events (extendido)
id
org_id
dev_id
session_id
project_id
action          // "get_context" | "log_decision" | "exploration" | etc
module
tokens_served         // tokens que devolvio el MCP
tokens_saved_estimate // tokens estimados que se habrian usado sin TokenDoc
cost_saved_estimate   // $ calculado con pricing del modelo
model               // "opus-4.6" | "sonnet-4.6" — para calcular $ correctamente
timestamp

// savings_daily (agregado, materializado)
org_id
date
tokens_served_total
tokens_saved_total
cost_saved_total
sessions_count
top_module
```

---

## Formula de calculo

```
tokens_saved = tokens_sin_tokendoc - tokens_con_tokendoc

tokens_sin_tokendoc = SUM(archivos_del_modulo.lineas * 5)
  // 5 tokens por linea es la aproximacion standard
  // Porque Claude leeria cada archivo completo + grep results

tokens_con_tokendoc = tokens_del_bundle + tokens_exploracion_adicional
  // Bundle: ~5K tokens promedio
  // Exploracion adicional: los Read/Grep que Claude hizo DESPUES del bundle

cost_saved = tokens_saved * precio_por_token[modelo]
```

### Precision del calculo

| Componente | Precision | Notas |
|-----------|-----------|-------|
| tokens_del_bundle | Exacta | Lo medimos nosotros (chars/4 o tokenizer real) |
| tokens_exploracion | Alta | Hook PostToolUse mide output de Read/Grep |
| tokens_sin_tokendoc | Estimada (~80% precision) | Basada en LOC del modulo * 5. Validar con benchmark |
| modelo usado | Media | El dev puede configurar cual usa, o detectar de JSONL |

### Para precision maxima: usar tokenizer real

```typescript
import { countTokens } from "@anthropic-ai/tokenizer"; // si existe
// o usar tiktoken con el modelo correcto
// o cl100k_base como fallback

const exactTokens = countTokens(bundleText);
```

---

## Benchmark inicial (Fase 1, obligatorio)

Antes de publicar cualquier numero:

1. Elegir 3 tareas reales de DGuard
2. Ejecutar cada tarea SIN TokenDoc, anotar tokens (de /usage o JSONL)
3. Ejecutar cada tarea CON TokenDoc, anotar tokens
4. Calcular ahorro real, no estimado
5. Publicar numeros reales en el README

```
| Tarea                          | Sin TokenDoc | Con TokenDoc | Ahorro |
|--------------------------------|-------------|-------------|--------|
| Fix auth middleware bug        | 42,000      | 8,600       | 79%    |
| Add billing webhook            | 58,000      | 12,000      | 79%    |
| Refactor tenant isolation      | 65,000      | 15,000      | 77%    |
| PROMEDIO                       | 55,000      | 11,867      | 78%    |
```

Estos numeros son los que van al LinkedIn post, al README, y al pitch.

---

## Sources

- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs)
- [ccusage - Claude Code Usage Analysis](https://ccusage.com/guide/)
- [JSONL Logs Undercount Tokens](https://gille.ai/en/blog/claude-code-jsonl-logs-undercount-tokens/)
- [Token Dashboard](https://github.com/nateherkai/token-dashboard)
- [Claude Code Token Optimization Guide](https://buildtolaunch.substack.com/p/claude-code-token-optimization)
