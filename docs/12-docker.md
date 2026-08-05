# Docker e Deploy

Guia da stack local e da stack de deploy do SILO.

---

## Visao geral

A stack atual usa:

1. `web` - Next.js em `apps/frontend`
2. `api` - FastAPI/Python em `apps/backend`
3. `worker` - worker Python em `apps/backend`
4. `migrate` - migration one-shot
5. `ollama-init` - inicializacao one-shot de modelos
6. `db` - PostgreSQL
7. `ollama` - runtime local de IA

`apps/api` e `apps/worker` ficam apenas como legado de migracao e nao sao os containers canonicos da stack final.

## Arquivos de compose

- `docker-compose.yml` - stack local usada no desenvolvimento diario.
- `docker-compose.deploy.yml` - stack de deploy baseada na imagem ja publicada.

---

## Compose local

O arquivo principal e `docker-compose.yml`.

- `api` expoe a porta `4000`
- `worker` usa o mesmo backend Python e nao depende mais de Ollama
- `web` aponta para `API_URL=http://api:4000`
- uploads usam o volume compartilhado `silo-storage-data`
- `ollama-init` roda antes da API; o worker nao espera mais essa inicializacao
- `api`, `worker` e `web` usam `stop_grace_period` e limites basicos de CPU/memoria

---

## Compose de deploy

O arquivo `docker-compose.deploy.yml` usa a imagem ja publicada e executa:

- migrate one-shot
- ollama-init one-shot
- api Python
- worker Python
- web

O deploy nao deve buildar codigo diferente no servidor.

---

## Variaveis relevantes

```bash
NEXT_PUBLIC_BASE_PATH=/silo
API_URL=http://api:4000
NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
DATABASE_URL=postgresql://silo:silo@db:5432/silo
SILO_POSTGRES_IMAGE=pgvector/pgvector:pg17
SILO_OLLAMA_IMAGE=ollama/ollama:0.30.0-rc7
```

---

## Comandos uteis

```bash
docker compose up -d --build && docker compose ps && docker compose logs -f api worker web
docker compose ps
docker compose logs -f
docker compose down
docker compose -f docker-compose.deploy.yml config
```

---

## Observacoes de operacao

- `ollama-init` continua obrigatorio para registrar modelos e digests da IA.
- A API usa healthcheck proprio e o worker nao depende mais do runtime de IA.
- O web continua responsavel pelo proxy same-origin e pelo volume de uploads.
