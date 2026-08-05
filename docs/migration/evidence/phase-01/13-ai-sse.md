# Fase 1.13 — contrato SSE byte a byte do assistente IA legado

Data da execução: 2026-07-21  
Banco: `silo_contract_legacy`  
API legada: Node/Express em `127.0.0.1:4000`  
Endpoint: `POST /api/ai-assistant/messages/stream`  
Golden gerado: `tests/fixtures/legacy-golden/phase1_13.ai_assistant_sse.bytes.json`

## Comandos executados

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-ai-assistant.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node --check tests\contracts\legacy\external-stub-server.mjs
node --check tests\contracts\legacy\capture-ai-sse-contract.mjs
node --check tests\contracts\legacy\run-ai-sse-with-node-api.mjs
node tests\contracts\legacy\run-ai-sse-with-node-api.mjs --label=13-ai-sse
```

Resultado final:

```text
[legacy-contract] captured AI SSE byte contract -> tests\fixtures\legacy-golden\phase1_13.ai_assistant_sse.bytes.json
```

Logs da execução:

- `docs/migration/evidence/phase-01/13-ai-sse/api-node.stdout.log`
- `docs/migration/evidence/phase-01/13-ai-sse/api-node.stderr.log`
- `docs/migration/evidence/phase-01/13-ai-sse/capture.stdout.log`
- `docs/migration/evidence/phase-01/13-ai-sse/capture.stderr.log`
- `docs/migration/evidence/phase-01/13-ai-sse/external-stub.stdout.log`
- `docs/migration/evidence/phase-01/13-ai-sse/external-stub.stderr.log`

## Contrato capturado

Formato SSE legado:

- linha de evento: `event: <name>`;
- linha de payload: `data: <json>`;
- comentário heartbeat: `: heartbeat`;
- separador de frame: `\n\n`;
- line ending: `LF`;
- headers SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

Casos congelados no golden:

1. `pre_headers_invalid_body_json_400`: validação falha antes de headers SSE; retorna JSON `400`, sem `text/event-stream`.
2. `success_full_stream_event_order_and_separators`: stream completo com ordem `connected → thinking → scope → thinking → result`, finalizando em EOF e `\n\n`.
3. `client_cancel_after_connected`: cliente cancela após receber `connected`; terminal do capturador é `client-abort` e não há `result`.
4. `heartbeat_comment_during_slow_processing`: processamento atrasado pelo stub; captura comentários `: heartbeat\n\n` antes do `scope` e finaliza com `result`.
5. `post_headers_missing_thread_timeout_after_connected`: thread inexistente depois dos headers; comportamento legado abre SSE `200`, envia `connected` e não encerra resposta até timeout do cliente.

## Controles determinísticos

- O stub externo agora aceita atraso opcional por marcador via `SILO_CONTRACT_STUB_CHAT_DELAY_MS` e `SILO_CONTRACT_STUB_CHAT_DELAY_MARKERS`; por padrão nada muda para outras fases.
- O runner da 1.13 define atraso de `6000ms` e `OLLAMA_TIMEOUT_MS=12000` para permitir heartbeat de `5000ms` sem forçar timeout do Ollama.
- O golden registra `rawUtf8`, `byteLength`, `sha256`, chunks lidos, frames SSE, ordem de eventos, comentários e separadores.

## Observação de risco para a migração

O caso de thread inexistente é um comportamento legado problemático: os headers SSE já foram enviados, `AssistantThreadNotFoundError` é capturado sem `res.end()`, e o cliente só conclui por timeout/cancelamento. A implementação Python/FastAPI deve reproduzir esse contrato enquanto o frontend depender dele, ou alterar frontend e contrato explicitamente em fase posterior.
