# Fase 1.14 — contrato de uploads de imagem, WebP e pixels

Data da execução: 2026-07-21  
Banco: `silo_contract_legacy`  
API legada: Node/Express em `127.0.0.1:4000`  
Golden gerado: `tests/fixtures/legacy-golden/phase1_14.upload_images.webp_pixels.json`

## Comandos executados

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node --check tests\contracts\legacy\capture-upload-image-contract.mjs
node --check tests\contracts\legacy\run-upload-images-with-node-api.mjs
node tests\contracts\legacy\run-upload-images-with-node-api.mjs --label=14-upload-images
```

Resultado final:

```text
[legacy-contract] captured upload image contract -> tests\fixtures\legacy-golden\phase1_14.upload_images.webp_pixels.json
```

Logs e arquivos físicos da execução:

- `docs/migration/evidence/phase-01/14-upload-images/api-node.stdout.log`
- `docs/migration/evidence/phase-01/14-upload-images/api-node.stderr.log`
- `docs/migration/evidence/phase-01/14-upload-images/capture.stdout.log`
- `docs/migration/evidence/phase-01/14-upload-images/capture.stderr.log`
- `docs/migration/evidence/phase-01/14-upload-images/external-stub.stdout.log`
- `docs/migration/evidence/phase-01/14-upload-images/external-stub.stderr.log`
- `docs/migration/evidence/phase-01/14-upload-images/uploads/`

## Escopo capturado

O golden cobre 15 casos:

- 8 JPEGs com EXIF orientation `1..8`, enviados para `POST /api/upload/general`;
- 4 formatos de entrada aceitos: `png`, `jpeg`, `webp`, `gif`;
- filename hostil em `POST /api/upload/avatars`, validando sanitização e saída quadrada `200x200`;
- oversize `4MB + 1 byte`, validando erro legado `Arquivo muito grande. Máximo 4MB.`;
- arquivo falso, validando erro legado `Erro ao processar imagem.`;
- `GET /api/upload/serve/:kind/:filename` para cada upload aceito, validando `Content-Type: image/webp`.

## Validações executáveis

Para cada upload aceito, o capturador:

- gera imagem fixture determinística em memória;
- executa upload multipart real;
- baixa o arquivo servido pela API;
- valida que o filename persistido é seguro;
- valida MIME servido `image/webp`;
- valida metadata WebP (`format`, `width`, `height`, `orientation`);
- calcula `sha256` do WebP servido;
- calcula o WebP esperado com a mesma regra da rota legada;
- compara hash exato do WebP servido com o esperado;
- compara pixels essenciais: `top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`.

## Contrato observado

- A rota genérica aceita formatos `jpeg`, `png`, `webp`, `gif` e sempre persiste WebP.
- `general` usa resize `inside`, `maxWidth=1200`, `maxHeight=1200`, `withoutEnlargement=true`, `quality=85`.
- `avatars` usa crop/resize quadrado `200x200`, `quality=85`.
- EXIF orientation `1..4` mantém dimensões `96x64`; `5..8` troca para `64x96` após `sharp().rotate()`.
- O limite de upload da rota genérica é `4MB`.
- Filename hostil `..\..//evil 🛰️; nome final.png` foi sanitizado para basename seguro com sufixo WebP.

## Observação de risco para a migração

O contrato de pixels depende de `sharp/libvips` e qualidade WebP `85`. A implementação Python/FastAPI deve fixar uma biblioteca/processamento equivalente ou aceitar divergência por golden visual/pixel tolerante explicitamente documentado em fase posterior.
