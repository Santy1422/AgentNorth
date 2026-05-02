---
id: decision-002
date: 2026-05-01
author: claude
module: dashboard-api
status: active
source: dashboard
---

# Lazy dynamic imports for all mongoose models

## Contexto
Static imports of mongoose models cause bundling issues in Next.js API routes

## Decision
Always use await import(@/models) inside route handlers
