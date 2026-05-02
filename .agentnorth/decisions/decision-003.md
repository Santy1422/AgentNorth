---
id: decision-003
date: 2026-05-01
author: claude
module: dashboard-api
status: active
source: dashboard
---

# Use native MongoDB driver for API auth in serverless

## Contexto
Mongoose SubDocument schemas cause scope errors in Vercel serverless cold starts

## Decision
Auth middleware uses MongoClient directly instead of mongoose models
