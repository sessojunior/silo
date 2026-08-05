---
description: "Use when creating or modifying Kafka consumer handlers, topic dispatch, DLQ flows, database deduplication, or worker boot logic in the Python backend."
applyTo: "apps/backend/src/silo/worker/**/*.py"
---

# Worker Kafka - apps/backend

Referências:
- [docs/02-architecture.md](../../docs/02-architecture.md)
- [docs/08-kafka.md](../../docs/08-kafka.md)
- [docs/09-dataflow.md](../../docs/09-dataflow.md)

## Estrutura

- `main.py` faz o bootstrap do worker Python.
- `consumer.py` e `processor.py` concentram a leitura, retry e commit.
- `handlers/*.py` deve conter handlers puros por tópico.
- `topic_handlers.py` é o ponto de despacho; mantenha a tabela explícita.

## Fluxo de processamento

- Normalize o record antes de processar.
- Faça parse do JSON com tratamento explícito de erro.
- Extraia `message_id` ou `source.messageId`.
- Se a mensagem estiver inválida, envie para a DLQ e avance o offset somente após confirmação.
- Depois do processamento bem-sucedido, confirme o próximo offset.

## Idempotência e banco

- Use sessões e transações assíncronas para garantir deduplicação.
- Registre a mensagem processada antes de executar o handler.
- Não mova essa regra para o handler do tópico.

## Kafka REST Proxy

- Use os adaptadores do backend Python para REST Proxy.
- Mantenha `topic`, `group_id` e `dlq_prefix` vindos do settings.
- Qualquer retry ou backoff deve ficar centralizado no fluxo do worker.

## Config e logs

- Centralize acesso a ambiente e config; não espalhe leituras de `os.environ`.
- Use logs com contexto de tópico e razão do erro.
- Não esconda falhas silenciosamente; se o envio para DLQ falhar, preserve o erro de contexto.

## Regra prática

- Handler de worker bom é pequeno, determinístico e idempotente.
