# 10 — Go-to-Market y Lanzamiento

## Licencia: Apache 2.0

**Decidido.** Apache 2.0 para el core OSS.

- Proteccion de patentes (MIT no tiene)
- Clausula de trademark
- No asusta a enterprises como AGPL
- Si un competidor hostea tu codigo, ya validaste el mercado

---

## Modelo de negocio: Open Core + Hosted SaaS

| Capa | Que incluye | Precio |
|------|------------|--------|
| **OSS Core** | CLI, MCP server local, indexer, write-back, generadores | Gratis, Apache 2.0 |
| **Cloud** | Dashboard web, API hosted, tracking, realtime, storage | Suscripcion mensual |
| **Team/Enterprise** | SSO, audit logs, RBAC, SLAs, soporte, multi-repo, VPC | Contrato anual |

---

## Playbook de lanzamiento

### Pre-lanzamiento (mientras construimos Fase 1)

- [ ] Construir en publico: commits publicos, posts breves en LinkedIn/X
- [ ] Optimizar README: descripcion clara, GIF demo, quickstart <2 min, badges
- [ ] Preparar benchmark real con DGuard (numeros concretos de tokens ahorrados)
- [ ] Escribir 1-2 blog posts tecnicos sobre el problema (SEO)
- [ ] Configurar GitHub Discussions en el repo

### Lanzamiento concentrado (48 horas)

**Dia 1 (Martes-Jueves, 8-10 AM PT):**
1. Show HN en Hacker News (titulo tecnico, especifico, sin superlativos)
2. +30 min: posts en Reddit (r/programming, r/selfhosted, r/opensource, r/ClaudeAI)
3. LinkedIn posts + DMs coordinados
4. Twitter/X con tags a herramientas relevantes

**Dia 2:**
5. Product Hunt launch
6. Publicar en MCP registries (ver abajo)
7. Responder a CADA comentario en HN/Reddit

### Post-lanzamiento (semanas 2-8)

- [ ] Listar en todos los MCP registries
- [ ] Escribir "How we built TokenDoc" para dev.to
- [ ] Publicar en Continue Hub como Block
- [ ] Contribuir en comunidades (70% ayudar, 30% mencionar)
- [ ] Changelog publico semanal
- [ ] Buscar integraciones con otras herramientas

---

## Donde listar el MCP server

| Registry | Servidores | Como publicar |
|----------|-----------|---------------|
| **Official MCP Registry** | Metaregistro oficial | registry.modelcontextprotocol.io |
| **Smithery** | 7,000+ | `smithery mcp publish` |
| **Glama** | 22,500+ | glama.ai/mcp/servers |
| **MCP Market** | 10,000+ | mcpmarket.com |
| **MCP.so** | 20,500+ | Issue en GitHub |
| **Continue Hub** | Variable | Block file YAML |
| **MCP Hunt** | Variable | Directorio trending |

---

## Como conseguir las primeras 100 stars

1. **Red personal primero** — mensajes individuales a contactos dev
2. **README impecable** — con numeros reales de benchmark
3. **Ventana de 48h concentrada** — activar GitHub Trending
4. **Construir karma en Reddit antes** — 1-2 semanas participando
5. **Responder a todo** — en HN, Reddit, Twitter
6. **Caso de uso real** — DGuard como demo con datos concretos

---

## Feature de distribucion: generar AGENTS.md

AGENTS.md es un standard con 60,000+ repos que lo usan. TokenDoc puede generar AGENTS.md automaticamente como parte de `tokendoc init`:

```
tokendoc init
  → Analiza repo
  → Genera .tokendoc/ (bundles, config)
  → TAMBIEN genera AGENTS.md con:
      - Contexto del proyecto
      - Comandos de build/test
      - Convenciones detectadas
      - Arquitectura de modulos
      - Instrucciones para usar TokenDoc MCP
```

**Por que esto es clave para distribucion:**
- Cualquier agente (Claude, Cursor, Copilot, Codex) lee AGENTS.md
- El AGENTS.md generado incluye instrucciones de usar TokenDoc
- Efecto viral: repos que usan TokenDoc automaticamente recomiendan TokenDoc a otros agentes

---

## Timeline de lanzamiento

```
Semana 1-2:  Construir Fase 1 (MCP server)
Semana 3:    Benchmark en DGuard + README con numeros
Semana 4:    Lanzamiento concentrado 48h
Semana 5-8:  Post-lanzamiento, listar en registries, contenido
Semana 8:    Evaluar: >=50 stars? >=5 equipos? → Fase 2
```

---

## Sources

- [GTM Playbook 2026](https://dev.to/iris1031/go-to-market-strategy-the-complete-2026-playbook-for-startups-210j)
- [33K Stars Case Study](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-11h8)
- [Product Hunt Launch Playbook](https://dev.to/iris1031/product-hunt-launch-playbook-the-definitive-guide-30x-1-winner-48g5)
- [MCP Registries 2026](https://www.truefoundry.com/blog/best-mcp-registries)
- [OSS Licenses Guide](https://dev.to/juanisidoro/open-source-licenses-which-one-should-you-pick-mit-gpl-apache-agpl-and-more-2026-guide-p90)
- [AGENTS.md Official](https://agents.md/)
- [GitHub Blog — How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
