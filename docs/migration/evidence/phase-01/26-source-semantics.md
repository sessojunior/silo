# Fase 1.26 — Semântica de fontes de problema

Data: 2026-07-22

## Artefatos criados

- Documento: `docs/migration/ai/source-semantics.md`
- Assertor: `tests/contracts/legacy/assert-source-semantics.mjs`

## Contrato congelado

- `problematic_run` vem de `product_activity`.
- `registered_problem` vem de `product_problem`.
- Não existe FK entre as duas fontes no schema atual.
- Não há deduplicação cruzada por produto, categoria, data, texto, similaridade ou solução.
- Categoria `no_incidents` é excluída de contagens de incidente/problema real.
- Respostas combinadas devem expor duas contagens/datasets, nunca um `totalProblems` misto.
- Tools devem emitir `sourceKind` e referenciar a matriz da Fase 1.25.

## Validação executada

```text
node --check tests/contracts/legacy/assert-source-semantics.mjs
OK

node tests/contracts/legacy/assert-source-semantics.mjs
phase1_26 source semantics OK
```
