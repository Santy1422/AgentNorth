---
id: decision-001
date: 2026-05-01
author: claude
module: core
status: active
source: dashboard
---

# Use ast-grep SgNode for typed AST parsing

## Contexto
Avoid any types in parser module

## Decision
Import SgNode from @ast-grep/napi for all AST root parameters
