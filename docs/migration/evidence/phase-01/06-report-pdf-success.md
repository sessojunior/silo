# Evidência Fase 1.6 — lote report-pdf-success

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: sucesso HTTP das rotas `POST /api/reports/*/pdf`. Esta evidência não substitui a etapa `1.15`, que ainda deve extrair texto, páginas, metadados e PNGs para comparação visual.

## Critério de inclusão

Incluídas as quatro rotas de PDF expostas pelo módulo de reports:

- `POST /api/reports/availability/pdf`;
- `POST /api/reports/problems/pdf`;
- `POST /api/reports/executive/pdf`;
- `POST /api/reports/projects/pdf`.

O body usado segue o componente web `ExportPdfButton`/`ReportViewPage`:

```json
{
  "dateRange": "custom",
  "startDate": "2026-07-01",
  "endDate": "2026-07-21"
}
```

Observação de contrato: as rotas Node atuais leem `body.start`/`body.end` e repassam para `parsePeriod()`, enquanto o frontend envia `dateRange`/`startDate`/`endDate`. Este lote congela o comportamento observável sem corrigir o bug de filtro.

## Seed/reset obrigatório

Antes da captura foi reaplicado:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-report-pdf-success-cases.mjs
node tests\contracts\legacy\generate-report-pdf-success-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-report-pdf-success.json --dry-run
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-report-pdf-success.json --label=06-report-pdf-success
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `4` casos.
- Dry-run: exit code `0`.
- Seed/reset: exit code `0`.
- Captura contra API Node: exit code `0`.
- Todos os casos retornaram `200`.
- Logs salvos em `docs/migration/evidence/phase-01/06-report-pdf-success/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.report_pdf_success.*.json`.

## Resumo dos status capturados

| Operação | Status | Response body |
|---|---:|---|
| `post.api_reports_availability_pdf` | `200` | `{success:true,data:{url,filename}}` |
| `post.api_reports_problems_pdf` | `200` | `{success:true,data:{url,filename}}` |
| `post.api_reports_executive_pdf` | `200` | `{success:true,data:{url,filename}}` |
| `post.api_reports_projects_pdf` | `200` | `{success:true,data:{url,filename}}` |

## Side effects de arquivo observados

Arquivos gerados em `uploads/reports/` durante a captura final:

| Arquivo | Bytes |
|---|---:|
| `availability-2026-07-21-1784646000000.pdf` | 2550 |
| `executive-2026-07-21-1784646000000.pdf` | 2731 |
| `problems-2026-07-21-1784646000000.pdf` | 2534 |
| `projects-2026-07-21-1784646000000.pdf` | 2624 |

Os nomes reais não entram nos goldens como valor fixo de API porque o runner normaliza `url` e `filename`. A comparação material do conteúdo PDF continua bloqueada para `1.15`.

## Pendências da etapa 1.6

- Capturar lotes especializados de e-mail, upload, SSE/assistente, sync externo e embedding/RAG.
- Capturar `generate_pdf` via assistente no lote de assistente, sem confundir com as rotas diretas de reports.
