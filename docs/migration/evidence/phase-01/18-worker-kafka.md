# Fase 1.18 — Worker Kafka REST e parsing ecFlow/dataflow

Data fixa: `2026-07-21T15:00:00.000Z`.

## Resultado

- O feed compartilhado do SMNA em `https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json` foi parseado pelo parser legado real `parseEcflowKafkaPipelines`.
- `processRecord` real foi executado contra Postgres fixture e Kafka REST fake.
- Offset commitado é sempre `offset + 1` nos casos capturados.
- Mensagem duplicada não reaplica `modelHandler`, mas no banco real é enviada para DLQ após retries porque o legado não reconhece `DrizzleQueryError.cause.code=23505`.
- JSON inválido e mensagem sem id vão para DLQ e só então commitam offset.
- Tópico desconhecido usa handler no-op, grava deduplicação e commita.

## Artefatos

- Golden: `tests/fixtures/legacy-golden/phase1_18.worker_kafka.dataflow.json`
- Evidência bruta: `docs\migration\evidence\phase-01\18-worker-kafka\worker-kafka.raw.json`
- Captura Kafka REST normalizada: `docs\migration\evidence\phase-01\18-worker-kafka\kafka-rest-capture.normalized.json`
- Teste worker: `docs\migration\evidence\phase-01\18-worker-kafka\npm-run-test-worker.txt`

## Observações vinculantes

- Pipelines do exemplo: 4; ordem: smna|2026-05-15|18, smna|2026-05-15|12, smna|2026-05-15|06, smna|2026-05-15|00.
- Tasks queued com `progress:100` preservam progresso 100 no legado.
- Tasks sem datas próprias usam `Date.now()` congelado pelo contrato como fallback; isso deve ser reproduzido ou corrigido explicitamente em fase própria.
- Testes unitários atuais simulam duplicata com `{code:'23505'}` direto, mas o banco real entrega `DrizzleQueryError` com `cause.code`; a divergência fica congelada como risco do porte.
- Worker atual inicializa Ollama no boot, embora os handlers Kafka capturados não usem IA; o plano já determina remover isso no destino.
