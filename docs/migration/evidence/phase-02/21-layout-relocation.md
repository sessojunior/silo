# Fase 2.21 — Relocação canônica de backend e frontend

Data: 2026-07-22

## Objetivo

Aplicar a decisão de layout canônico:

- mover o projeto Python de `backend/` para `apps/backend/`;
- mover o frontend Next.js de `apps/web/` para `apps/frontend/`;
- preferir rename/move de diretórios, sem copiar arquivo por arquivo;
- preservar compatibilidade mantendo o pacote npm do frontend como `@silo/web`.

## Execução

Diretórios movidos:

- `backend` -> `apps/backend`
- `apps/web` -> `apps/frontend`

Arquivos/configurações ajustados:

- `.gitignore`
- `.dockerignore`
- `.gitlab-ci.yml`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `docker-compose.yml`
- `docker-compose.migration.yml`
- `apps/frontend/Dockerfile`
- `apps/frontend/package.json`
- `apps/frontend/scripts/prepare-standalone-assets.mjs`
- testes Python que calculam a raiz do repositório
- contratos legados que leem arquivos do frontend/backend
- allowlists compensatórias versionadas
- documentação ativa e instruções `.github` que apontavam para o caminho físico antigo

Evidências históricas em `docs/migration/evidence/**` não foram reescritas retroativamente quando representam saídas antigas de comandos.

## Decisão sobre ausência de dados/logs reais

O plano foi ajustado para deixar explícito que ausência de dados/logs/telemetria reais de staging/produção não bloqueia fases locais de implementação, modelagem, testes, Docker e CI.

Essa ausência continua bloqueando ações que dependem de estado externo real: backup restaurável, fingerprint/stamp de banco existente, soak representativo, staging/cutover e qualquer operação destrutiva ou irreversível.

## Ocorrências e controles

- `node_modules/@silo/web` ainda apontava para `apps/web` após o move. `npm install --legacy-peer-deps` recriou a junction para `apps/frontend`.
- A `.venv` movida manteve trampolines com paths antigos. `uv sync --locked --all-groups --reinstall` recriou scripts no novo caminho.
- O primeiro `docker compose build web` transferiu contexto de aproximadamente `1.84GB` porque `apps/backend/.venv` entrou no contexto raiz. `.dockerignore` foi atualizado para ignorar `.venv`, caches Python e builds Next. A repetição transferiu aproximadamente `201.11kB`.
- `npm audit` reportou 30 vulnerabilidades durante `npm install`/Docker build. Não foi executado `npm audit fix`, pois isso alteraria dependências fora do escopo desta etapa.

## Validações executadas

Com `C:\Users\sesso\.local\bin` adicionado ao `PATH` da sessão:

- `npm run py:sync`: aprovado
- `npm run py:format:check`: aprovado
- `npm run py:lint`: aprovado
- `npm run py:typecheck`: aprovado
- `npm run py:test`: aprovado, `48 passed, 1 warning`
- `npm run typecheck:web`: aprovado
- `node tests/contracts/legacy/assert-ai-visualization-render-contract.mjs`: aprovado
- Validador histórico do controle compensatório do assistente: aprovado
- Validador histórico do controle compensatório de access log: aprovado
- `node tests/contracts/legacy/assert-ai-eval-cases.mjs`: aprovado
- `npm --workspace @silo/web run test -- assistant-visualization.contract.test.tsx`: aprovado, `8 passed`
- `docker compose -f docker-compose.yml -f docker-compose.migration.yml config --services`: aprovado
- `npm run py:build`: aprovado
- `docker compose build web`: aprovado após atualização do `.dockerignore`

## Observações

- O serviço Compose continua chamado `web` e a imagem continua `silo-web` para preservar compatibilidade operacional.
- O pacote npm continua `@silo/web`; somente o caminho físico mudou para `apps/frontend`.
- As alterações não mexeram nas mudanças preexistentes em `apps/api/src/scripts/backfill-embeddings.ts` e `apps/api/src/services/embedding-write-service.ts`.
