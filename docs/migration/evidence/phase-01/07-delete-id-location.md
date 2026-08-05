# Evidência Fase 1.7 — localização real de identificadores em DELETE

Data operacional: `2026-07-21`  
Etapa do plano: `1.7`  
Escopo: capturar DELETE com identificador em query, body ou path exatamente como o frontend usa, sem uniformizar.

## Resultado

A etapa `1.7` foi concluída.

Foram adicionados 6 goldens específicos para lacunas/conflitos que não estavam suficientemente congelados pela etapa `1.6`.

## Comandos executados

```powershell
node --check tests\contracts\legacy\runner.mjs
node --check tests\contracts\legacy\generate-delete-id-location-cases.mjs
node tests\contracts\legacy\generate-delete-id-location-cases.mjs
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.7-delete-id-location.json --label=07-delete-id-location
```

Todos retornaram exit code `0`.

## Casos adicionados

| Caso | Operação | Formato do identificador | Status |
|---|---|---|---:|
| `help_images.frontend_body_filename` | `delete.api_help_images` | body `{filename}` como frontend envia | `400` |
| `help_images.api_query_filename_success` | `delete.api_help_images` | query `?filename=` como Node exige | `200` |
| `incidents_images.frontend_body_filename` | `delete.api_incidents_images` | body `{filename}` como frontend envia | `400` |
| `incidents_images.api_query_filename_success` | `delete.api_incidents_images` | query `?filename=` como Node exige | `200` |
| `products_manual_images.frontend_body_filename_success` | `delete.api_products_manual_images` | body `{filename}` como frontend envia | `200` |
| `projects_images.frontend_body_filename_no_node_route` | `delete.api_projects_images_frontend_observed` | body `{filename}` como frontend configura | `404` |

Resumo: `3` respostas `200`, `2` respostas `400`, `1` resposta `404`.

## Inventário de formatos DELETE observados no frontend

| Formato | Exemplos |
|---|---|
| Query `?id=` | users, groups, incidents, monitoring radars/radar-groups, products, projects, product problem categories |
| Query composta | groups/users usa `?userId=&groupId=`; project activities usa `?activityId=` |
| Body `{id}` | contacts, product problems, product solutions, product dependencies, product problem images, product solution images, project tasks |
| Body `{filename}` | help images, incident images, product manual images, project images configurado pelo frontend |
| Path param | chat messages, AI assistant threads/messages, upload serve |

Os formatos já cobertos por goldens da etapa `1.6` não foram duplicados na `1.7`.

## Drifts/conflitos congelados

1. `DELETE /api/help/images`
   - Frontend `MarkdownEditor` envia body `{filename}`.
   - Node lê apenas `req.query.filename`.
   - Resultado do uso frontend: `400`, `Nome de arquivo inválido`.
   - Resultado do contrato efetivo Node com query: `200`.

2. `DELETE /api/incidents/images`
   - Frontend `MarkdownEditor` envia body `{filename}`.
   - Node lê apenas `req.query.filename`.
   - Resultado do uso frontend: `400`, `Nome de arquivo inválido`.
   - Resultado do contrato efetivo Node com query: `200`.

3. `DELETE /api/projects/images`
   - Frontend configura `deleteEndpoint: "/api/admin/projects/images"`.
   - API Node não possui rota correspondente.
   - Resultado capturado: `404` HTML com `Cannot DELETE /api/projects/images`.
   - A matriz recebeu placeholder explícito `delete.api_projects_images_frontend_observed`.

4. `DELETE /api/users/profile-image`
   - Frontend `photo-upload-local.tsx` chama a rota sem identificador.
   - API Node não possui handler DELETE nessa rota.
   - Não foi incluído no lote 1.7 porque não contém identificador em query/body/path; deve seguir para a caracterização aprofundada de upload/perfil (`1.14`) ou decisão explícita posterior.

## Arquivos

- `tests/contracts/legacy/generate-delete-id-location-cases.mjs`
- `tests/contracts/legacy/cases.phase-1.7-delete-id-location.json`
- `tests/fixtures/legacy-golden/phase1_7.delete_id_location.*.json`
- `docs/migration/evidence/phase-01/07-delete-id-location/`
- `docs/migration/contract-matrix.yaml`

## Decisão

Marcar somente a etapa `1.7` como concluída.

Próxima etapa determinística: iniciar `1.8`.
