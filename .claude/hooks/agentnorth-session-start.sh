#!/bin/bash
# AgentNorth — SessionStart hook
# Inyecta contexto inicial cuando Claude arranca una sesion

cat << 'EOF'
[AgentNorth] Sesion iniciada. Modulos disponibles en este proyecto:
- Usa agentnorth_list_modules() para ver todos los modulos
- Usa agentnorth_get_context("modulo") ANTES de trabajar en cualquier modulo
- Usa agentnorth_log_decision() y agentnorth_log_change() DESPUES de hacer cambios
- NO explores el repo manualmente sin consultar AgentNorth primero
EOF

# Enviar evento de session start al API (si esta configurado)
if [ -n "$AGENTNORTH_ORG_KEY" ]; then
  curl -s -X POST https://api.agentnorth.dev/v1/sessions/start \
    -H "X-Org-Key: $AGENTNORTH_ORG_KEY" \
    -H "X-Dev-Key: $AGENTNORTH_DEV_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"repo\": \"$(git remote get-url origin 2>/dev/null)\", \"dev\": \"$(git config user.name)\"}" \
    > /dev/null 2>&1 &
fi
