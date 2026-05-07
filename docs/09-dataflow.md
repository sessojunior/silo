# Fluxo de Dados via Kafka REST Proxy

Este guia descreve o fluxo de dados exibido em `/admin/products/:slug/data-flow`. A fonte oficial do módulo é o **Kafka REST Proxy**. Enquanto o REST Proxy real não estiver disponível, a aplicação usa os snapshots fake existentes e os converte para o mesmo contrato Kafka/ecFlow esperado em produção.

---

## Objetivo

O módulo de Fluxo de Dados deve exibir, por produto, data e turno:

- a linha do tempo planejada das tarefas;
- o status real de execução quando disponível;
- dependências entre tarefas por IDs estáveis;
- progresso agregado por pipeline;
- detalhes de atraso, duração de referência e horários planejados/reais.

A UI não consome mais o JSON fake diretamente como fonte principal. Ela chama a API interna do Next.js, que por sua vez lê do Kafka REST Proxy ou do simulador local.

---

## Origem dos dados

Fluxo atual:

1. A tela `/admin/products/:slug/data-flow` chama `GET /api/admin/products/{slug}/data-flow`.
2. A rota chama `getProductDataFlowPipelinesFromKafkaRest`.
3. Se `KAFKA_REST_PROXY_USE_MOCK_DATA` for diferente de `false`, ou se `KAFKA_REST_PROXY_URL` não estiver definido, o sistema usa os snapshots fake existentes.
4. Se `KAFKA_REST_PROXY_USE_MOCK_DATA=false` e `KAFKA_REST_PROXY_URL` estiver definido, o sistema cria um consumidor temporário via REST Proxy e lê o tópico `${KAFKA_DATAFLOW_TOPIC_PREFIX}${slug}`.
5. O payload Kafka/ecFlow é normalizado para o formato usado pelo Gantt.

Arquivos principais:

- `apps/web/src/app/api/admin/products/[slug]/data-flow/route.ts`
- `apps/web/src/lib/dataflow/kafka-data-flow-source.ts`
- `apps/web/src/lib/dataflow/types.ts`
- `apps/web/src/app/admin/products/[slug]/data-flow/page.tsx`
- `apps/web/src/components/admin/nav/product-tabs.tsx`

---

## Endpoint atual

### Listar pipelines ou buscar por data/turno

```http
GET /api/admin/products/{slug}/data-flow
GET /api/admin/products/{slug}/data-flow?date=2026-03-06&turn=18
```

Permissão necessária: `products:list`.

Resposta:

```json
{
  "success": true,
  "data": {
    "pipelines": [
      {
        "model": "bam",
        "date": "2026-03-06",
        "turn": "18",
        "status": "completed",
        "groups": []
      }
    ]
  }
}
```

Uso pela interface:

- sem `date`/`turn`: o seletor da aba monta as opções disponíveis;
- com `date`/`turn`: a tela carrega o snapshot específico;
- ordenação: data mais recente primeiro e turno maior primeiro.

---

## Contrato Kafka/ecFlow

O valor da mensagem no tópico de data-flow deve seguir este formato base:

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
  "product": {
    "slug": "bam",
    "name": "BAM"
  },
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
  "groups": [
    {
      "id": "ingestion",
      "kind": "family",
      "name": "Ingestao de dados",
      "status": "complete",
      "tasks": [
        {
          "id": "download_gfs_025",
          "kind": "task",
          "name": "Download GFS 0.25",
          "state": "complete",
          "dependencies": [],
          "plannedStartAt": "2026-03-06T18:08:00Z",
          "plannedEndAt": "2026-03-06T18:47:00Z",
          "startedAt": "2026-03-06T18:08:00Z",
          "finishedAt": "2026-03-06T18:47:00Z",
          "referenceDurationMinutes": 39,
          "delayMinutes": 0,
          "isDelayed": false,
          "progress": 100
        }
      ]
    }
  ],
  "raw": {
    "suiteId": "BAM_PRE_OPER"
  }
}
```

---

## Regras obrigatórias

- `source.messageId` deve ser estável e único para deduplicação operacional.
- `product.slug` deve corresponder ao `{slug}` da URL e ao sufixo do tópico.
- `run.date` deve usar `YYYY-MM-DD`.
- `run.turn` deve ser string, como `"0"`, `"6"`, `"12"` ou `"18"`.
- `groups[].tasks[].id` deve ser estável ao longo das execuções.
- `dependencies` deve conter IDs estáveis de tasks, nunca nomes soltos.
- `referenceDurationMinutes` deve existir por task; o valor em `defaults` é apenas fallback.
- `plannedStartAt` e `plannedEndAt` devem existir por task sempre que possível.
- `startedAt` e `finishedAt` representam o tempo real e podem ser `null` para tarefas pendentes.

O Gantt usa `plannedStartAt` e `plannedEndAt` como `start` e `end`. Isso permite posicionar tarefas pendentes e detectar atraso antes de existir um horário real de término.

---

## Mapeamento de status

Estados Kafka/ecFlow são convertidos para os status aceitos pela UI em `productStatus.ts`.

| Estado recebido | Status na UI |
| --- | --- |
| `queued`, `queue`, `pending`, `submitted` | `pending` |
| `complete`, `completed` | `completed` |
| `active`, `running`, `in_progress` | `in_progress` |
| `failed`, `aborted`, `error`, `with_problems` | `with_problems` |
| `run_again` | `run_again` |
| `not_run` | `not_run` |
| `under_support` | `under_support` |
| `suspended` | `suspended` |

Quando `run.status` não vem preenchido, o status agregado do pipeline é derivado das tasks.

---

## Contrato usado pela UI

Depois da normalização, a UI recebe pipelines neste formato:

```json
{
  "model": "bam",
  "date": "2026-03-06",
  "turn": "18",
  "status": "completed",
  "groups": [
    {
      "id": "ingestion",
      "name": "Ingestao de dados",
      "tasks": [
        {
          "id": "download_gfs_025",
          "name": "Download GFS 0.25",
          "start": "2026-03-06T18:08:00Z",
          "end": "2026-03-06T18:47:00Z",
          "progress": 100,
          "dependencies": [],
          "status": "completed",
          "type": "task",
          "plannedStartAt": "2026-03-06T18:08:00Z",
          "plannedEndAt": "2026-03-06T18:47:00Z",
          "startedAt": "2026-03-06T18:08:00Z",
          "finishedAt": "2026-03-06T18:47:00Z",
          "referenceDurationMinutes": 39,
          "delayMinutes": 0,
          "isDelayed": false
        }
      ]
    }
  ]
}
```

---

## Modo simulado

O modo simulado existe para manter as telas funcionando antes da disponibilidade do REST Proxy real.

Configuração padrão:

```bash
KAFKA_REST_PROXY_USE_MOCK_DATA=true
```

Com esse valor, o sistema:

- usa `apps/web/src/app/admin/products/[slug]/data-flow/pipeline-data.json` como base;
- adapta snapshots existentes para o `slug` solicitado quando não houver match exato;
- gera mensagens no formato Kafka/ecFlow;
- passa essas mensagens pelo mesmo mapper usado para dados reais.

Para testar leitura real pelo REST Proxy:

```bash
KAFKA_REST_PROXY_URL=http://rest-proxy:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=false
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
```

---

## Smoke test local

Com o modo mock ativo, este comando valida a conversão para `bam`, data `2026-03-06`, turno `18`:

```powershell
npx tsx -e "void (async () => { const mod = await import('./apps/web/src/lib/dataflow/kafka-data-flow-source.ts'); const fn = mod.default.getProductDataFlowPipelinesFromKafkaRest; const pipelines = await fn({ slug: 'bam', date: '2026-03-06', turn: '18' }); const first = pipelines[0]; console.log(JSON.stringify({ count: pipelines.length, model: first?.model, date: first?.date, turn: first?.turn, status: first?.status, groups: first?.groups.length, firstTask: first?.groups[0]?.tasks[0] }, null, 2)); })();"
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

---

## Referências internas

- [08-kafka.md](08-kafka.md)
- `apps/web/src/app/api/admin/products/[slug]/data-flow/route.ts`
- `apps/web/src/lib/dataflow/kafka-data-flow-source.ts`
- `apps/web/src/lib/dataflow/types.ts`
- `apps/web/src/app/admin/products/[slug]/data-flow/page.tsx`
- `apps/web/src/components/admin/nav/product-tabs.tsx`
- `apps/web/src/app/admin/products/[slug]/data-flow/pipeline-data.json`
