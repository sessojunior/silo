# Deploy do Silo com Docker

Guia simples para subir a stack de deploy atual.

---

## Ordem recomendada

1. Garantir que a rede Docker e as credenciais do ambiente estejam prontas.
2. Preencher `.env` a partir de `env.example`.
3. Subir a stack com `npm run docker:up`.
4. Validar `docker compose ps` e os logs da API, do worker e do web.

---

## Stack de deploy

O deploy atual usa:

- `docker-compose.deploy.yml`
- imagem publicada do backend Python
- `ollama-init` one-shot
- `api` e `worker` Python
- `web` Next.js

O servidor de deploy nao deve rebuildar o codigo em runtime.

---

## Variaveis importantes

- `SILO_IMAGE` - imagem publicada da aplicacao Python
- `NEXT_PUBLIC_BASE_PATH` - base path publica
- `DATABASE_URL` - banco de producao ou homologacao
- `API_URL` - origem interna usada pelo web
- `DEPLOY_SSH_*` - credenciais do fluxo GitLab

---

## Verificacoes apos deploy

- `GET /health`
- `GET /health/live`
- healthcheck da API e do worker no Compose de deploy
- stop grace period suficiente para o encerramento gracioso do worker
- login funcional
- uploads funcionando
- WebSocket e SSE saudaveis
- assistente e reports carregando sem erro
