# Static Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar os diagnósticos estáticos restantes sem alterar o comportamento funcional da aplicação.

**Architecture:** Corrigir primeiro os avisos mecânicos do frontend e do Ruff, mantendo as APIs e os fluxos existentes. Em seguida, reduzir os diagnósticos do mypy por módulo, com anotações e conversões explícitas de resultados SQLAlchemy; qualquer exceção de tipagem de biblioteca será isolada e justificada, nunca silenciada globalmente.

**Tech Stack:** TypeScript, ESLint, Python 3.13, Ruff, mypy, SQLAlchemy, React.

## Etapas

- [x] Corrigir os 20 avisos do ESLint e validar `npm run lint:web`.
- [x] Corrigir os 13 erros do Ruff e validar `ruff check .`.
- [x] Corrigir os diagnósticos mypy por módulo, começando por `pdf_artifacts.py`, `report_portal.py`, `project_portal.py`, `product_portal.py`, routers e módulos de IA.
- [x] Rodar testes backend/frontend, typecheck, lint, Ruff e mypy completos.
- [x] Registrar limitações remanescentes somente se forem provenientes de dependências externas e não do código do projeto.
