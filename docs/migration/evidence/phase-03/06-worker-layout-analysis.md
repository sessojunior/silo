# Análise de layout do worker — correção pré-Fase 3.6

Data: 2026-07-22

## Pergunta

Verificar por que `apps/worker` está fora de `apps/backend` e se deveria estar dentro do backend Python.

## Achados

`apps/worker` é o worker legado Node/TypeScript:

- pacote npm: `@silo/worker`;
- Dockerfile próprio: `apps/worker/Dockerfile`;
- scripts raiz existentes: `dev:worker`, `build:worker`, `test:worker`, `lint:worker`, `typecheck:worker`;
- serviço atual no `docker-compose.yml`: `worker`, imagem `silo-worker`;
- depende de `@silo/database`, `@silo/engine`, Kafka REST e atualmente ainda recebe variáveis `OLLAMA_*`.

`apps/backend` é o novo projeto Python compartilhado:

- `apps/backend/Dockerfile` já tem targets `api` e `worker`;
- o target `worker` aponta para `python -m silo.worker.main`;
- a estrutura-alvo do plano já prevê `apps/backend/src/silo/worker/`.

## Decisão

`apps/worker` não deve ser movido para dentro de `apps/backend`.

Motivos:

1. `apps/worker` é o legado Node usado como oráculo de contrato e caminho de rollback até o cutover.
2. Movê-lo para `apps/backend` misturaria runtime Node dentro do projeto Python, quebrando a fronteira de imports e o empacotamento Docker/CI criado na Fase 2.
3. O plano exige coexistência controlada: worker Node e worker Python nunca podem consumir simultaneamente o mesmo grupo/tópicos de produção.
4. O destino correto do worker Python é `apps/backend/src/silo/worker/`, compartilhando modelos, config, DB e cliente Kafka Python com a API.
5. A remoção de `apps/worker` Node só ocorre na Fase 17, depois de cutover, soak e rollback window.

## Correção aplicada ao plano de migração

O plano foi atualizado para declarar explicitamente:

- `apps/worker` permanece como worker Node legado fora de `apps/backend` até a Fase 17;
- não mover nem renomear `apps/worker` durante a migração;
- o worker Python deve ser implementado em `apps/backend/src/silo/worker/`;
- o Compose/CI de coexistência deve distinguir serviço legado `worker` de target/imagem Python futura;
- qualquer teste/cutover deve impedir dois workers no mesmo consumer group.

## Resultado

A dúvida foi resolvida como decisão vinculante de layout. A Fase 3.6 pode avançar sem mover `apps/worker`.
