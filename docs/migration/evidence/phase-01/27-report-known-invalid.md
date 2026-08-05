# Fase 1.27 — Defeitos conhecidos de relatório

Data: 2026-07-22

## Artefatos criados

- Golden `known-invalid`: `tests/fixtures/legacy-golden/phase1_27.report_known_invalid.json`
- Assertor regressivo: `tests/contracts/legacy/assert-report-known-invalid.mjs`

## Defeitos caracterizados

1. `reports.problems.fixed_resolution_80_percent`
   - `resolvedCount` usa `Math.floor(cnt * 0.8)`.
   - `resolutionRate` usa `cnt > 0 ? 80 : 0`.
   - O golden legado `phase1_6.read.reports.problems.success.json` mostra `problemsCount=1`, `resolvedCount=0` e `resolutionRate=80`.
   - Classificação: `known-invalid`; não preservar como paridade.

2. `reports.problems.top5_without_stable_order`
   - `topProblemsIds` usa `problems.slice(0, 5)` antes de qualquer ordenação estável.
   - Classificação: `known-invalid`; não usar como ranking factual no agente antes da regra da Fase 7.

3. `reports.executive.group_id_echoed_not_applied`
   - A rota aceita `groupId` e passa para `getExecutiveReport`.
   - O service ecoa `filters.groupId`, mas não aplica o filtro nas consultas.
   - Classificação: `known-invalid`; não declarar suporte real a `groupId` no executivo antes da regra da Fase 7.

## Regra para Python

Antes da regra aprovada na Fase 7, a saída Python só pode:

- omitir essas métricas;
- marcá-las como `unsupportedMetrics`;
- ou aplicar a correção apenas quando a Fase 7 definir a regra canônica e os testes correspondentes.

Ela não pode reproduzir a taxa fixa de 80%, ranking instável ou filtro `groupId` apenas ecoado como se fossem contrato.

## Validação executada

```text
node --check tests/contracts/legacy/assert-report-known-invalid.mjs
OK

node tests/contracts/legacy/assert-report-known-invalid.mjs
phase1_27 report known-invalid defects OK
```
