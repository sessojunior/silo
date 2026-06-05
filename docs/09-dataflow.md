# Fluxo de Dados via Kafka REST Proxy

Este guia descreve o fluxo de dados exibido em `/admin/products/:slug/data-flow`. A fonte oficial do módulo é o **Kafka REST Proxy**. Enquanto o REST Proxy real não estiver disponível, a aplicação usa os snapshots fake existentes e retorna o mesmo contrato normalizado que a UI consome.

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
3. Se `KAFKA_REST_PROXY_USE_MOCK_DATA` for diferente de `false`, ou se `KAFKA_REST_PROXY_URL` não estiver definido, o sistema usa os snapshots fake existentes e devolve o mesmo modelo normalizado da UI.
4. Se `KAFKA_REST_PROXY_USE_MOCK_DATA=false` e `KAFKA_REST_PROXY_URL` estiver definido, o sistema cria um consumidor temporário via REST Proxy, lê o tópico `${KAFKA_DATAFLOW_TOPIC_PREFIX}${slug}` e parseia a árvore ecFlow/suite bruta.
5. O parser normaliza o payload bruto para o formato usado pelo Gantt.

Arquivos principais:

- `apps/api/src/routes/products-extended.ts`
- `apps/api/src/dataflow/kafka-data-flow-source.ts`
- `apps/web/src/lib/dataflow/kafka-data-flow-source.ts`
- `apps/web/src/app/admin/products/[slug]/data-flow/page.tsx`
- `apps/web/src/components/admin/nav/product-tabs.tsx`

---

## Endpoint atual

### Listar pipelines ou buscar por data/turno

```http
GET /api/admin/products/{slug}/data-flow
GET /api/admin/products/{slug}/data-flow?date=2026-03-06&turn=18
```

Permissão necessária: `products:view`.

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

O contrato bruto aceito pelo parser é a árvore ecFlow/suite do anexo [kafka-consumer-api-example.json](../kafka-consumer-api-example.json). O root da suite e os nós de família de primeiro nível carregam `date` e `turn` explicitamente.

```json
{
  "kind": "suite",
  "name": "SMNA_PRE_OPER",
  "date": "2026-05-13",
  "turn": "PRE_OPER",
  "node_state": "queued",
  "default_state": "queued",
  "attributes": [],
  "dependencies": [],
  "triggerExpression": null,
  "groups": [
    {
      "id": "SMNA_00_2026-05-13",
      "kind": "family",
      "name": "00",
      "date": "2026-05-13",
      "turn": "00",
      "status": "complete",
      "tasks": [],
      "groups": []
    }
  ]
}
```

Regras obrigatórias:

- `date` e `turn` devem existir no root da suite e nos nós de família de primeiro nível.
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
- devolve o mesmo modelo normalizado da UI;
- não depende do REST Proxy.

Para testar leitura real pelo REST Proxy:

```bash
KAFKA_REST_PROXY_URL=http://rest-proxy:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=false
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
```

---

## Smoke test local

Este comando valida o parser do payload bruto do anexo e a conversão para pipelines normalizados:

```powershell
npm run dataflow:ecflow:smoke
```

Resultado esperado resumido:

```json
{
  "count": 4,
  "pipelines": [
    { "model": "smna", "date": "2026-05-13", "turn": "18", "status": "pending", "groups": 1 },
    { "model": "smna", "date": "2026-05-13", "turn": "12", "status": "completed", "groups": 1 },
    { "model": "smna", "date": "2026-05-13", "turn": "06", "status": "completed", "groups": 1 },
    { "model": "smna", "date": "2026-05-13", "turn": "00", "status": "completed", "groups": 2 }
  ]
}
```
