# Fase 1.29 — datasets canônicos dos PDFs

Data: 2026-07-22

## Artefatos criados

- Golden canônico: `tests/fixtures/legacy-golden/phase1_29.report_pdf_canonical_datasets.json`
- Assertor: `tests/contracts/legacy/assert-report-pdf-canonical-datasets.mjs`

## Decisão de escopo

A captura da Fase 1.15 preservou PDF, texto extraído e imagem renderizada para os quatro relatórios, mas não preservou o JSON bruto completo passado ao gerador de PDF. Por isso, a Fase 1.29 registra apenas o dataset visível e verificável a partir dos PDFs/textos já congelados.

Campos não visíveis no PDF não foram fabricados. Se uma fase posterior precisar de dataset bruto completo, ela deve criar fixture próprio ou recapturar o endpoint JSON antes de declarar paridade.

## Período congelado

O body congelado pelo contrato de frontend continha:

```json
{
  "dateRange": "custom",
  "startDate": "2026-07-01",
  "endDate": "2026-07-21"
}
```

As rotas Node de PDF leem `start`/`end`, não `startDate`/`endDate`. Assim, os PDFs capturados usam o fallback legado:

```text
2026-06-21 a 2026-07-21
```

Esse comportamento fica documentado como legado conhecido. A migração Python/FastAPI não deve corrigir isso implicitamente antes de gate posterior.

## Datasets e checksums

Algoritmo: `sha256(stable-json(canonicalDataset))`.

| Relatório | Checksum do dataset | PDF | Texto | PNG página 1 |
|---|---|---|---|---|
| availability | `sha256:ab42b687cd91933f65e1a2a37abc1ccdb0422ecef3aa286a79e33188f7afa7ba` | `02717761f6e7bb5ac57d1f6b9f067f15a0ad193859d2a9ba30a94a7733abddbd` | `6bf6b11ab79acee2658c6bde3d598ec08a9f6e876be64a080a29a48cc4a7a1c1` | `a0da7c734ca607a0d16f46dfc4eaa84e77438b2248578900d73b3ea983bbd5c3` |
| problems | `sha256:030ffda85364be55b2646fd90fed5a4b302a4535698ca217e3e8d663e65a7f25` | `b36b88042c4085b7483e256f29634d490e08a667e08aaee34f3103400f5f38cf` | `92ec2457af35d6ebe2678b0f2c41b2d0266a3919339a2e9cb7329855328ae8f1` | `da12ce1c73e77dccfeef854ffa9531b6cbe585335c7f2dbf7b17b19720eb3b25` |
| executive | `sha256:93dff966570fe770d1ad6cb348c2f97d37ae21139507185d4a9ae15b86142fad` | `5b2d9a3d53db50a6aff8c53d966b62c94b665bc281d0dae5e583995f9ea64c0a` | `a2a23fd9129e7aa390dc227c681ef4b4d60766672f70de86f1dba04a03c92486` | `06177ef9e42e76b5fce5803e3284c3d46057689d085b11beeba4e25411125c38` |
| projects | `sha256:95173f428a942b44dc2a902b66a58b4f24af13eb8921a7d33640673649d59105` | `2298e13c9ce22c15872fc2eadcabdf27796c523b5e9dfb7dd07c8fb75d166549` | `65cd99b6dbb029db3fcfef7f4cd1d47ea71dfff3228965c5fdef241a80c112d2` | `1f9b06b0e51fba8482ca394f7290564dde056007efa6f39eea26302e76adcd10` |

Todos os PDFs têm uma página. Todas as imagens renderizadas têm `1191x1684`.

## Invariante travada

Para cada um dos quatro relatórios, `textProjection`, `chartProjection` e `pdfProjection` compartilham exatamente:

- `period`
- `filters`
- `totals`
- `metricVersion`
- `canonicalDatasetChecksum`

O assertor valida essa igualdade para impedir divergência futura entre resposta textual, gráfico e PDF do agente.

## Validação executada

```text
node --check tests/contracts/legacy/assert-report-pdf-canonical-datasets.mjs
OK

node tests/contracts/legacy/assert-report-pdf-canonical-datasets.mjs
phase1_29 report PDF canonical datasets OK

git diff --check
OK, com avisos CRLF apenas em arquivos preexistentes de embeddings.
```
