# Integracao Kafka REST Proxy - SILO

Este documento descreve como o SILO consome e publica dados via Kafka REST Proxy.

---

## Onde Kafka e usado

- Tela de monitoring e data-flow.
- Worker Python novo em `apps/backend/src/silo/worker/`.
- Worker Node legado em `apps/worker/` apenas como oraculo de migracao.

---

## Principios operacionais

- Kafka e acessado apenas via REST Proxy.
- Cada consumer precisa garantir idempotencia com chave propria e deduplicacao no banco.
- Offsets so podem ser commitados apos o processamento ou DLQ serem confirmados.
- Mensagens invalidas, sem id ou que falham apos retry devem ir para DLQ.
- Enquanto os modelos nao tiverem a propria URL de origem, o fluxo de data-flow usa o feed compartilhado do SMNA em `https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json`. O fallback agora e embutido no codigo e nao depende de JSON local na raiz.

---

## Variaveis de ambiente

```bash
KAFKA_REST_PROXY_URL=http://localhost:8082
KAFKA_REST_PROXY_AUTH=
KAFKA_REST_PROXY_USE_MOCK_DATA=true
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
KAFKA_GROUP_ID=silo-consumer-group
KAFKA_TOPIC=
KAFKA_TOPICS=
KAFKA_DLQ_PREFIX=dlq.
KAFKA_PROCESS_RETRY_COUNT=3
KAFKA_RETRY_BACKOFF_MS=1000
```

---

## Worker Python

O worker canônico fica em `apps/backend/src/silo/worker/` e deve seguir estes pontos:

- bootstrap simples em `main.py`;
- leitura do topic e despacho em `topic_handlers.py`;
- retry e backoff centralizados;
- logs sanitizados;
- encerramento gracioso com confirmacao de consumer removido.

---

## Legado Node

O worker Node em `apps/worker/` continua disponivel apenas para:

- goldens;
- rollback;
- comparacao A/B enquanto o cutover nao for final.

O worker legado nao inicializa mais Ollama nem consome variaveis de IA. A
dependencia de Ollama ficou restrita a API e job de infraestrutura.
O feed de data-flow associado aos modelos continua temporariamente
centralizado no SMNA; no futuro, cada modelo deve apontar para sua propria URL.
