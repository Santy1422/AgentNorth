# 04 — Fase 3: SaaS (Solo si hay senal)

**Prerequisito:** >=5 equipos usando Fase 1+2, >=50 GitHub stars
**Objetivo:** Producto hosted con multi-repo, auth, billing

---

## IMPORTANTE

No entrar a Fase 3 sin validación. Este documento existe para planificar, no para ejecutar todavía.

---

## Componentes nuevos

### Multi-repo / Multi-tenant
- Un equipo puede conectar N repos
- Bundles y decisiones compartidas cross-repo
- Context queries que cruzan repos ("cómo se conecta el frontend con el billing API?")

### Dashboard hosted
- Next.js + Hono API
- Postgres (Supabase) para metadata, decisiones, métricas
- Real-time: ver qué está haciendo el agente ahora
- Búsqueda semántica con embeddings + pgvector

### Auth y billing
- GitHub OAuth / Supabase Auth
- Tiers:
  - Free: 1 repo, 5 módulos, docs públicas
  - Team ($X/seat/mes): repos ilimitados, dashboard, decisiones, métricas
  - Enterprise: self-hosted, SSO, audit log

### Skill marketplace interno
- Skills compartidos a nivel equipo (patterns, conventions, workflows)
- Compatible con Anthropic Skills standard
- Marketplace público (como npm pero para skills de agente)

---

## Preguntas a responder antes de entrar

1. Cuál es el pricing correcto? Per-seat vs per-repo vs per-token-saved
2. Self-hosted desde día 1 para enterprise?
3. Cofounder GTM — quién vende esto?
4. Defensibilidad si Anthropic/Sourcegraph shippean equivalente
5. Runway personal de Santi para dedicar 6+ meses

---

## Señales que justifican entrar a Fase 3

- [ ] 50+ GitHub stars orgánicas
- [ ] 5+ equipos usando Fase 1+2 activamente
- [ ] Al menos 2 equipos pidiendo features de Fase 3
- [ ] Benchmark publicado genera conversación en la comunidad
- [ ] Alguien ofrece pagar antes de que exista billing
