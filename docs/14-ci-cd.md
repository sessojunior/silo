# GitLab CI/CD do Silo

Este documento descreve a estrutura exata do fluxo de CI/CD para o projeto Silo.

O objetivo e simples:

1. Validar o codigo em toda alteracao.
2. Construir e publicar a imagem Docker no GitLab Container Registry.
3. Fazer deploy por SSH em um servidor com Docker Compose.
4. Confirmar a saude da aplicacao depois do deploy.

---

## Estrutura criada

Arquivos que suportam o fluxo:

- [../.gitlab-ci.yml](../.gitlab-ci.yml)
- [../docker-compose.deploy.yml](../docker-compose.deploy.yml)
- [../scripts/gitlab/deploy.sh](../scripts/gitlab/deploy.sh)
- `apps/web/Dockerfile` — imagem da aplicação web (instala a workspace inteira e compila `@silo/web`)
- `apps/worker/Dockerfile` — imagem do consumer Kafka (instala a workspace inteira e compila `@silo/worker`)

O arquivo [../docker-compose.yml](../docker-compose.yml) é o compose de desenvolvimento/local.
O arquivo de deploy usa imagem pré-construída e pressupõe um Postgres externo ou gerenciado.

Ver [12-docker.md](12-docker.md) para detalhes de arquitetura Docker.

---

## Desenho do fluxo

```mermaid
flowchart LR
  A[Push ou Merge Request] --> B[validate]
  B --> C[build:image]
  C -->|branch padrao| D[deploy:staging]
  C -->|tag| E[deploy:production manual]
  D --> F[Healthcheck no servidor]
  E --> F
```

---

## Etapas da pipeline

### `validate`

- Executa `npm ci`
- Executa `npm run lint`
- Executa `npm run typecheck`

Esta etapa roda em merge requests, branches e tags.

### `build:image`

- Usa Kaniko para construir a imagem sem depender de Docker privilegiado no runner.
- Em merge requests, roda em modo `--no-push` apenas para validar o Dockerfile.
- Em branches e tags, publica a imagem com tags:
  - `CI_COMMIT_SHA`
  - `CI_COMMIT_REF_SLUG`
  - `latest` apenas na branch padrao

### `deploy:staging`

- Roda automaticamente na branch padrao.
- Conecta por SSH no servidor de homologacao.
- Faz `docker login` no registry.
- Executa `docker compose pull` e `docker compose up -d`.
- Faz healthcheck dentro do container usando Node e a rota `GET /health`.

### `deploy:production`

- Roda apenas em tags.
- Fica como `manual` para evitar deploy acidental.
- Reaproveita o mesmo script da homologacao, mudando apenas o ambiente e as variaveis scopeadas no GitLab.

---

## Variaveis do GitLab

As variaveis abaixo devem ser cadastradas em **Settings > CI/CD > Variables**.
Use **environment scope** para separar homologacao e producao quando necessario.

### Variaveis de deploy por SSH

- `DEPLOY_SSH_HOST`: host ou IP do servidor
- `DEPLOY_SSH_USER`: usuario SSH com acesso ao Docker
- `DEPLOY_SSH_PORT`: porta SSH, padrao `22`
- `DEPLOY_SSH_PRIVATE_KEY`: chave privada usada pelo runner
- `DEPLOY_PATH`: caminho do checkout do repositorio no servidor, por exemplo `/opt/silo`
- `DEPLOY_BASE_PATH`: base path publica da aplicacao, por exemplo `/silo` ou `/`

### Variaveis do registry

- `REGISTRY_DEPLOY_USER`: usuario de um Deploy Token com acesso ao registry
- `REGISTRY_DEPLOY_PASSWORD`: senha do mesmo Deploy Token

### Variaveis de runtime no servidor

Estas variaveis seguem o contrato ja descrito em [../env.example](../env.example) e sao usadas pelo [../docker-compose.deploy.yml](../docker-compose.deploy.yml):

- `NODE_ENV`
- `DATABASE_URL_DEV`
- `DATABASE_URL_PROD`
- `APP_URL_DEV`
- `APP_URL_PROD`
- `NEXT_PUBLIC_BASE_PATH`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`

### Variaveis opcionais do compose

- `SILO_IMAGE`: a imagem publicada pelo pipeline
- `SILO_CONTAINER_NAME`: nome do container, padrao `silo-app`
- `SILO_PORT`: porta publica, padrao `8084`

---

## Requisitos do servidor

O servidor de deploy precisa de:

1. Docker Engine instalado.
2. Docker Compose v2 instalado como plugin.
3. A rede externa `frontend` criada uma vez:

```bash
docker network create frontend
```

4. Um checkout do repositorio em `DEPLOY_PATH`.
5. Um arquivo `.env` valido nesse mesmo diretorio, com as variaveis de runtime.

O deploy nao usa o service `db` do compose local. Em producao, o banco deve ser externo ou gerenciado.

---

## Como funciona o deploy

O job de deploy usa o arquivo [../scripts/gitlab/deploy.sh](../scripts/gitlab/deploy.sh) para:

1. Criar uma chave SSH temporaria no runner.
2. Conectar no servidor.
3. Fazer login no GitLab Container Registry no servidor.
4. Exportar `SILO_IMAGE` com a tag do commit atual.
5. Subir os containers com `docker compose`.
6. Verificar se a aplicacao respondeu na rota de health.

O healthcheck usa a rota [../apps/web/src/app/health/route.ts](../apps/web/src/app/health/route.ts) dentro do proprio container, o que evita depender de rede externa para validar o deploy.

---

## Por que existe um compose separado

O [../docker-compose.yml](../docker-compose.yml) atual continua bom para desenvolvimento local porque ele:

- Sobe a aplicacao com `build: .`
- Pode subir o Postgres local junto com a stack por padrão
- Mantem volumes locais para uploads e banco

O [../docker-compose.deploy.yml](../docker-compose.deploy.yml) existe para o CD porque ele:

- Usa imagem pronta publicada no registry
- Nao recompila no servidor
- Mantem apenas o container da aplicacao
- Assume banco externo/gerenciado em producao

---

## Fluxo recomendado de uso

### Merge request

- Roda `validate`
- Roda `build:image` em modo de validacao sem push

### main

- Roda `validate`
- Roda `build:image`
- Faz deploy automatico em `staging`

### Tag de release

- Roda `validate`
- Roda `build:image`
- Libera deploy manual em `production`

---

## Comandos uteis

Validar o compose de deploy localmente:

```bash
docker compose -f docker-compose.deploy.yml config
```

Subir manualmente no servidor, depois de definir `SILO_IMAGE`:

```bash
docker compose -f docker-compose.deploy.yml up -d
```

Ver logs:

```bash
docker compose -f docker-compose.deploy.yml logs -f silo
```

---

## Observacoes importantes

- O `entrypoint.sh` continua responsavel por migracao e seed no startup do container.
- O pipeline nao substitui a configuracao de secrets no GitLab ou no servidor; ele apenas automatiza o fluxo.
- Se o projeto mudar de branch principal, ajuste as `rules` em [../.gitlab-ci.yml](../.gitlab-ci.yml).