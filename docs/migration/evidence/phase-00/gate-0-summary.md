# Gate 0 — resultado

Data: 2026-07-21

Status: aprovado.

## Comandos completos reexecutados após os reparos 0.15–0.20

- `npm ci --legacy-peer-deps` — aprovado; evidência `20-gate-npm-ci-legacy-peer-deps.txt`.
- `npm run typecheck:web` — aprovado; evidência `21-gate-typecheck-web.txt`.
- `npm run typecheck:api` — aprovado; evidência `22-gate-typecheck-api.txt`.
- `npm run typecheck:worker` — aprovado; evidência `23-gate-typecheck-worker.txt`.
- `npm run lint:web` — aprovado com warnings; evidência `24-gate-lint-web.txt`.
- `npm run lint:api` — aprovado com warnings; evidência `25-gate-lint-api.txt`.
- `npm run lint:worker` — aprovado com warnings; evidência `26-gate-lint-worker.txt`.
- `npm run test:web` — aprovado, 21 arquivos e 45 testes; evidência `27-gate-test-web.txt`.
- `npm run test:api` — aprovado, 8 arquivos e 48 testes; evidência `28-gate-test-api.txt`.
- `npm run test:worker` — aprovado, 4 arquivos e 18 testes; evidência `29-gate-test-worker.txt`.
- `npm run build:web` — aprovado; evidência `30-gate-build-web.txt`.
- `npm run build:api` — aprovado; evidência `31-gate-build-api.txt`.
- `npm run build:worker` — aprovado; evidência `32-gate-build-worker.txt`.

## Critérios do Gate 0

- API acima do mínimo: 48/48 testes.
- Web acima do mínimo: 45/45 testes.
- Worker com suíte criada: 18/18 testes.
- Shutdown e DLQ cobertos por testes do worker.
- Cache cross-user corrigido e testado.
- SSE reparado: service não emite `connected`; cache/live terminam em `result`; frontend aceita `data`/`complete` legado.
- Reasoning privado removido dos novos payloads SSE/JSON e de novos `metadata.thinking`.
- Falha de PDF não emite `visualization.image.src=""`.
- Mermaid usa `securityLevel:"strict"`, DOM criado com `textContent`/`replaceChildren` e bloqueia payloads perigosos.
- Validação de mídia bloqueia `//host`, schemes externos, MIME genérico, SVG ativo e PDF fora de reports.
- Mudanças locais preexistentes de embeddings preservadas; evidência `34-gate-embedding-diff-preserved.txt`.

## Limites

- A Fase 1 não foi iniciada.
- Os warnings de lint existentes não bloquearam o gate porque os comandos retornaram código 0.
