# Fase 1.20 — corpus de avaliação IA

Data: `2026-07-21`.

## Resultado

Corpus criado:

- `backend/tests/fixtures/ai/eval-cases.jsonl`

Scripts versionados:

- `tests/contracts/legacy/generate-ai-eval-cases.mjs`
- `tests/contracts/legacy/assert-ai-eval-cases.mjs`

## Validação executada

```powershell
node --check tests\contracts\legacy\generate-ai-eval-cases.mjs
node --check tests\contracts\legacy\assert-ai-eval-cases.mjs
node tests\contracts\legacy\generate-ai-eval-cases.mjs
node tests\contracts\legacy\assert-ai-eval-cases.mjs
git diff --check
```

Resultado do validador:

```text
phase1_20 ai eval corpus OK
cases=210
followup_elliptic=20
model_run_status_semantics=20
out_of_scope=10
pdf_availability=10
pdf_executive=10
pdf_problems=10
pdf_projects=10
prompt_injection_question=10
prompt_injection_retrieved_doc=10
scope_general=10
scope_generate_pdf=10
scope_models=10
scope_pending=10
scope_problems=10
scope_projects=10
scope_reports=10
scope_solutions=10
source_semantics_problematic_vs_registered=10
visualization=10
```

## Garantias verificadas pelo script

- 210 linhas JSONL válidas.
- IDs únicos.
- Cada caso tem exatamente uma `primaryCategory`; `secondaryCategory` é proibido.
- Contagem exata das categorias exigidas pela etapa 1.20.
- Campos obrigatórios presentes: scope, plano esperado, tools obrigatórias/permitidas/proibidas, sourceKind, fontes, números verificáveis, dataset esperado, artefato esperado e permissão de PDF.
- Casos sem PDF listam `generate_report_pdf` em `forbiddenTools`.
- Casos com PDF declaram `generate_report_pdf` e `expectedArtifact.kind="pdf"`.
- `expectedDataset.sourceKind` igual a `sourceKind`.

