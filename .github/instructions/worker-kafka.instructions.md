---
description: "Use when creating or modifying Kafka consumer handlers, topic dispatch, DLQ flows, database deduplication, or worker boot logic in apps/worker."
applyTo: "apps/worker/**/*.ts"
---

# Worker Kafka — apps/worker

Referências:
- [docs/02-architecture.md](../../docs/02-architecture.md)
- [docs/08-kafka.md](../../docs/08-kafka.md)
- [docs/09-dataflow.md](../../docs/09-dataflow.md)

## Estrutura

- `src/index.ts` faz o bootstrap do consumer e da conexão com o REST Proxy.
- `src/handlers/*.ts` deve conter handlers puros por tópico.
- `getHandlerForTopic` é o ponto de despacho por tópico; mantenha a tabela explícita.

## Fluxo de processamento

- Normalize o record antes de processar.
- Faça parse do JSON com `try/catch`.
- Extraia `message_id` ou `source.messageId`.
- Se a mensagem estiver inválida, envie para a DLQ e avance o offset.
- Depois do processamento bem-sucedido, comite o próximo offset.

## Idempotência e banco

- Use `@silo/database` e transações para garantir deduplicação.
- Registre mensagens processadas antes de executar o handler, para tratar `23505` como sucesso idempotente.
- Não mova essa regra para a rota ou para o handler do tópico.

## Kafka REST Proxy

- Prefira os helpers de `@silo/engine/kafka/rest-client`.
- Mantenha `topic`, `groupId` e `dlqPrefix` vindos do config.
- Qualquer retry ou backoff deve ficar centralizado no fluxo do worker.

## Config e logs

- Centralize o acesso a ambiente e config; não espalhe leituras de `process.env`.
- Use logs com contexto de tópico e razão do erro, mantendo o prefixo `[KAFKA-REST]`.
- Não esconda falhas silenciosamente; se um envio para DLQ falhar, logue e preserve o erro de contexto.

## Regra prática

- Handler de worker bom é pequeno, determinístico e idempotente.