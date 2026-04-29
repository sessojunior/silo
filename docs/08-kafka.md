# Integração Kafka REST Proxy - SILO

Este documento descreve como rodar e operar a integração Kafka do SILO. O acesso ao Kafka é feito somente por **Kafka REST Proxy**. Não há acesso direto por broker ou `kafkajs` na aplicação.

Enquanto o REST Proxy real não estiver disponível, as telas administrativas usam dados simulados gerados a partir dos snapshots fake existentes, mas passando pelo mesmo contrato e mapper usados para os dados reais.

---

## Onde Kafka é usado

- `/admin/monitoring`: cards de produtos e turnos usam dados derivados dos pipelines Kafka REST/simulados.
- `/admin/products/:slug/data-flow`: Gantt de fluxo de dados por produto, data e turno.
- `apps/worker/src/index.ts`: worker REST Proxy-only para consumir tópicos e persistir efeitos no banco.

O acesso das telas passa por `apps/web/src/lib/dataflow/kafka-data-flow-source.ts`. O worker usa `apps/worker/src/kafka-rest.ts` para consumir, commitar offsets e publicar em DLQ via REST Proxy.

---

## Princípios operacionais

- Kafka é acessado apenas via REST Proxy.
- Cada consumidor persiste dados no banco e garante não redundância usando a tabela `kafka_processed_messages` com `UNIQUE(topic, message_id)`.
- Offsets são commitados somente após a transação que persiste/processa a mensagem ser concluída.
- Mensagens inválidas, sem identificador ou que falham após retries são enviadas para DLQ.
- Recomenda-se executar um processo ou contêiner por tópico, usando `KAFKA_TOPIC`, para isolar checkpoints e retries.

---

## Variáveis de ambiente

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

Descrição:

- `KAFKA_REST_PROXY_URL`: URL base do REST Proxy, por exemplo `http://rest-proxy:8082`.
- `KAFKA_REST_PROXY_AUTH`: valor opcional do header `Authorization`, como `Bearer <token>` ou `Basic <base64>`.
- `KAFKA_REST_PROXY_USE_MOCK_DATA`: quando não for exatamente `false`, as telas usam dados simulados.
- `KAFKA_DATAFLOW_TOPIC_PREFIX`: prefixo dos tópicos por produto. Com o padrão, o produto `bam` usa `silo.dataflow.bam`.
- `KAFKA_GROUP_ID`: grupo base dos consumidores REST.
- `KAFKA_TOPIC`: tópico único para rodar um consumidor por tópico.
- `KAFKA_TOPICS`: lista CSV para o mesmo worker assinar mais de um tópico, quando necessário.
- `KAFKA_DLQ_PREFIX`: prefixo do tópico de DLQ.
- `KAFKA_PROCESS_RETRY_COUNT`: número de tentativas antes de publicar na DLQ.
- `KAFKA_RETRY_BACKOFF_MS`: backoff base entre retries.

---

## Rodar o consumer

Pré-requisitos:

```bash
npm install
npm run db:migrate
```

Exemplo em PowerShell (via Turborepo):

```powershell
$env:KAFKA_REST_PROXY_URL = "http://rest-proxy:8082"
$env:KAFKA_TOPIC = "model.products"
$env:KAFKA_GROUP_ID = "silo-consumer-group"
$env:KAFKA_DLQ_PREFIX = "dlq."
npm run dev -w worker
```

Em produção (container):

```bash
npm run start -w worker
```

O worker também aceita o tópico como primeiro argumento CLI quando `KAFKA_TOPIC` não estiver definido.

```bash
npm run dev -w worker -- model.products
```

---

## Docker: um contêiner por tópico

Veja `docker-compose.kafka.yml` para um exemplo completo.

```yaml
services:
  kafka-consumer-bam:
    build: .
    command: ["npm", "run", "kafka:consumer"]
    environment:
      KAFKA_REST_PROXY_URL: ${KAFKA_REST_PROXY_URL}
      KAFKA_REST_PROXY_AUTH: ${KAFKA_REST_PROXY_AUTH:-}
      KAFKA_TOPIC: silo.dataflow.bam
      KAFKA_GROUP_ID: ${KAFKA_GROUP_ID:-silo-consumer-group}
      KAFKA_DLQ_PREFIX: ${KAFKA_DLQ_PREFIX:-dlq.}
      DATABASE_URL: ${DATABASE_URL}
```

---

## Contrato do fluxo de dados

O valor da mensagem de data-flow deve seguir o contrato abaixo. Os detalhes completos ficam em [09-dataflow.md](09-dataflow.md).

```json
{
  "schemaVersion": 1,
  "source": {
    "type": "ecflow",
    "transport": "kafka",
    "topic": "silo.dataflow.bam",
    "messageId": "bam-2026-03-06-18-20260413T180500-0300",
    "generatedAt": "2026-04-13T18:05:00-03:00"
  },
  "product": { "slug": "bam", "name": "BAM" },
  "run": {
    "date": "2026-03-06",
    "turn": "18",
    "cycleAt": "2026-03-06T18:00:00-03:00",
    "status": "completed"
  },
  "defaults": {
    "timezone": "America/Sao_Paulo",
    "latenessToleranceMinutes": 5,
    "referenceDurationMinutes": 15
  },
  "groups": []
}
```

Regras essenciais:

- `dependencies` deve conter IDs estáveis de tasks.
- `referenceDurationMinutes` deve existir por task; o valor em `defaults` é apenas fallback.
- `plannedStartAt` e `plannedEndAt` são usados pela UI para posicionar tarefas pendentes e atrasadas.
- `startedAt` e `finishedAt` representam o tempo real e podem ser nulos.
- Estados são convertidos para `ProductStatus`.

Mapeamento principal de estados:

| Kafka/ecFlow | UI |
| --- | --- |
| `queued` | `pending` |
| `complete` | `completed` |
| `active` | `in_progress` |
| `failed` | `with_problems` |
| `aborted` | `with_problems` |

---

## Identificador de mensagem

O worker aceita os seguintes campos como identificador para deduplicação:

- `message_id`
- `messageId`
- `id`
- `source.messageId`

Para mensagens de data-flow, prefira `source.messageId`, pois ele faz parte do contrato Kafka/ecFlow.

---

## Garantia de não redundância

O processamento usa a tabela `kafka_processed_messages`:

- `topic`
- `message_id`
- `handler`
- `processed_at`

A constraint única `(topic, message_id)` impede processar a mesma mensagem duas vezes. Quando uma duplicata é detectada, o worker ignora a mensagem e commita o offset seguinte.

---

## DLQ

Mensagens são enviadas para `${KAFKA_DLQ_PREFIX}${topic}` quando:

- o JSON é inválido;
- nenhum identificador de mensagem é encontrado;
- o handler falha após `KAFKA_PROCESS_RETRY_COUNT` tentativas.

O envio para DLQ também usa o Kafka REST Proxy.

---

## Produzir mensagem via REST Proxy

Exemplo genérico:

```bash
curl -X POST \
  -H "Content-Type: application/vnd.kafka.json.v2+json" \
  --data '{"records":[{"value":{"message_id":"test-1","productId":123,"data":{"x":1}}}]}' \
  http://rest-proxy:8082/topics/model.products
```

Exemplo de data-flow:

```bash
curl -X POST \
  -H "Content-Type: application/vnd.kafka.json.v2+json" \
  --data '{"records":[{"value":{"schemaVersion":1,"source":{"type":"ecflow","transport":"kafka","topic":"silo.dataflow.bam","messageId":"bam-2026-03-06-18-demo","generatedAt":"2026-04-13T18:05:00-03:00"},"product":{"slug":"bam","name":"BAM"},"run":{"date":"2026-03-06","turn":"18","cycleAt":"2026-03-06T18:00:00-03:00","status":"completed"},"defaults":{"timezone":"America/Sao_Paulo","latenessToleranceMinutes":5,"referenceDurationMinutes":15},"groups":[]}}]}' \
  http://rest-proxy:8082/topics/silo.dataflow.bam
```

---

## Ler DLQ via REST Proxy

```bash
curl -X POST \
  -H "Content-Type: application/vnd.kafka.v2+json" \
  --data '{"name":"dlq-reader","format":"json","auto.offset.reset":"earliest"}' \
  http://rest-proxy:8082/consumers/my-dlq-group

curl -X POST \
  -H "Content-Type: application/vnd.kafka.v2+json" \
  --data '{"topics":["dlq.model.products"]}' \
  http://rest-proxy:8082/consumers/my-dlq-group/instances/dlq-reader/subscription

curl \
  -H "Accept: application/vnd.kafka.json.v2+json" \
  http://rest-proxy:8082/consumers/my-dlq-group/instances/dlq-reader/records

curl -X DELETE http://rest-proxy:8082/consumers/my-dlq-group/instances/dlq-reader
```

---

## Smoke tests

### Mapper simulado usado pela UI

```powershell
npx tsx -e "void (async () => { const mod = await import('./src/lib/dataflow/kafkaDataFlowSource.ts'); const fn = mod.default.getProductDataFlowPipelinesFromKafkaRest; const pipelines = await fn({ slug: 'bam', date: '2026-03-06', turn: '18' }); const first = pipelines[0]; console.log(JSON.stringify({ count: pipelines.length, model: first?.model, date: first?.date, turn: first?.turn, status: first?.status, groups: first?.groups.length, firstTask: first?.groups[0]?.tasks[0] }, null, 2)); })();"
```

Resultado esperado resumido:

```json
{
  "count": 1,
  "model": "bam",
  "date": "2026-03-06",
  "turn": "18",
  "status": "completed",
  "groups": 4
}
```

### Deduplicação do worker

1. Execute `npm run db:migrate`.
2. Inicie o consumer apontando para o REST Proxy.
3. Produza a mesma mensagem duas vezes com o mesmo `message_id`.
4. Confira que existe apenas uma entrada no banco:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM kafka_processed_messages WHERE topic='model.products' AND message_id='test-1';"
```

O resultado deve ser `1`.

---

## Notas operacionais

- O REST Proxy precisa suportar endpoints JSON v2 compatíveis com Confluent REST Proxy.
- Garanta que os tópicos DLQ existam ou que o cluster permita criação automática.
- Para alto throughput, aumente o número de partições do tópico e avalie paralelismo por produto/tópico.
- Não reintroduza acesso direto por broker no código da aplicação.


