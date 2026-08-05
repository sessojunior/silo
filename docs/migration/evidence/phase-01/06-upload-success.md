# Evidência Fase 1.6 — lote upload-success

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: contrato HTTP/multipart básico de `POST /api/upload/:kind`, `POST /api/users/profile-image` e `GET|DELETE /api/upload/serve/:kind/:filename`.

Esta evidência não substitui a etapa `1.14`, que ainda deve cobrir EXIF/orientações, formatos, oversize, arquivo falso em profundidade, filename hostil, dimensões, MIME e pixels essenciais do WebP.

## Critério de inclusão

Incluídos casos mínimos seguros:

- `POST /api/upload/:kind`: kind inválido, body não multipart, arquivo falso e PNG 1x1 válido;
- `POST /api/users/profile-image`: sem cookie, sem arquivo, arquivo falso e PNG 1x1 válido;
- `GET /api/upload/serve/:kind/:filename`: sem cookie, arquivo ausente e sucesso com arquivo preparado pelo runner;
- `DELETE /api/upload/serve/:kind/:filename`: sem cookie, sem permissão, arquivo ausente e sucesso com arquivo preparado pelo runner.

O runner foi estendido para:

- montar `multipart/form-data` via `FormData`/`Blob`;
- preparar arquivos de upload por caso via `setupFiles`;
- normalizar `image`, `imageUrl`, `url`, `src` e `filename` de uploads, preservando explicitamente o bug legado `/uploads/avatars/[object Object]`.

## Comandos executados

```powershell
node --check tests\contracts\legacy\runner.mjs
node --check tests\contracts\legacy\generate-upload-success-cases.mjs
node tests\contracts\legacy\generate-upload-success-cases.mjs
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.6-upload-success.json --label=06-upload-success
```

## Saídas relevantes

- Runner validado por `node --check`: exit code `0`.
- Gerador validado por `node --check`: exit code `0`.
- Geração: `15` casos.
- Captura contra API Node: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-upload-success/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.upload.*.json`.

## Resumo dos status capturados

| Grupo | Casos | Status observados |
|---|---:|---|
| `POST /api/upload/:kind` | 4 | `400`, `201` |
| `POST /api/users/profile-image` | 4 | `401`, `400`, `200` |
| `GET /api/upload/serve/:kind/:filename` | 3 | `401`, `404`, `200` |
| `DELETE /api/upload/serve/:kind/:filename` | 4 | `401`, `403`, `404`, `200` |

## Drifts/bugs legados congelados

- `POST /api/users/profile-image` com arquivo falso `text/plain` retorna `200` e persiste `image="/uploads/avatars/[object Object]"`.
- `GET /api/upload/serve/:kind/:filename` exige sessão, mas não exige permissão administrativa.
- `DELETE /api/upload/serve/:kind/:filename` exige sessão e `requireAdmin()`.

## Pendências fora desta evidência

- A etapa `1.14` deve aprofundar segurança e processamento real de uploads.
- A etapa `13.18` deve validar URLs de PDF/Mermaid/imagem no frontend.
