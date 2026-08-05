# Fase 1.15 — PDFs de relatório legado

## Objetivo

Congelar o comportamento observável da API Node para os quatro PDFs de relatório:

- `POST /api/reports/availability/pdf`
- `POST /api/reports/problems/pdf`
- `POST /api/reports/executive/pdf`
- `POST /api/reports/projects/pdf`

Cada PDF é gerado com fixture fixa, baixado pela rota pública de upload e salvo com:

- bytes reais do PDF;
- texto extraído por página;
- contagem de páginas por PDF object tree e por extração textual;
- metadata do objeto `/Info`;
- PNG por página para comparação visual tolerante.

## Entrada congelada

O lote reaproveita o contrato observado na fase 1.6: o frontend envia:

```json
{
  "dateRange": "custom",
  "startDate": "2026-07-01",
  "endDate": "2026-07-21"
}
```

A API Node atual lê `body.start`/`body.end`, não `startDate`/`endDate`. Portanto este lote congela o comportamento legado observável sem corrigir o filtro nesta fase.

## Estratégia de PNG

O ambiente local não possui `pdftoppm`, `pdfinfo`, Ghostscript ou MuPDF. `sharp` também não abre PDF neste host, e Chromium headless não renderiza o plugin de PDF de forma confiável.

Controle compensatório adotado para esta etapa: usar `pdftotext -layout` do Git for Windows para extrair texto paginado, converter cada página textual para SVG e então para PNG com `sharp`. O PNG é um artefato visual tolerante de layout/texto, não um raster pixel-perfect do PDF.

## Comandos

```powershell
node --check tests\contracts\legacy\capture-report-pdf-contract.mjs
node --check tests\contracts\legacy\run-report-pdfs-with-node-api.mjs
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node tests\contracts\legacy\run-report-pdfs-with-node-api.mjs --label=15-report-pdfs
```

## Artefatos esperados

- Golden: `tests/fixtures/legacy-golden/phase1_15.report_pdfs.visual.json`
- Logs: `docs/migration/evidence/phase-01/15-report-pdfs/*.log`
- PDFs/textos/PNGs: `docs/migration/evidence/phase-01/15-report-pdfs/report-pdf-capture/artifacts/<tipo>/`

## Resultado

Executado e aprovado em ambiente de contrato Node com `SILO_CONTRACT_NOW_ISO=2026-07-21T15:00:00.000Z`.

Resumo validado:

| Tipo | PDF | Páginas | PNGs |
|---|---|---:|---:|
| `availability` | `availability-2026-07-21-1784646000000.pdf` | 1 | 1 |
| `problems` | `problems-2026-07-21-1784646000000.pdf` | 1 | 1 |
| `executive` | `executive-2026-07-21-1784646000000.pdf` | 1 | 1 |
| `projects` | `projects-2026-07-21-1784646000000.pdf` | 1 | 1 |

Validações aplicadas pelo capturador:

- resposta JSON de geração com `success: true`, `url` e `filename`;
- download por `/api/upload/serve/reports/<filename>` com `Content-Type: application/pdf`;
- magic bytes `%PDF-`;
- contagem de páginas consistente entre `/Type /Page`, `/Pages /Count` e `pdftotext`;
- nenhuma página textual vazia;
- metadata `/Info` extraída;
- texto completo salvo em `.layout.txt`;
- PNG de layout textual salvo para cada página e hasheado no golden.

Observação de contrato: o período extraído nos PDFs é `2026-06-21 a 2026-07-21`, porque a rota Node ignora `startDate/endDate` enviados pelo frontend e usa o fallback de 30 dias de `parsePeriod()`. Isso é comportamento legado congelado, não correção.
