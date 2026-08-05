# Fase 1.30 — decisão de ausência de logs e controles compensatórios

Data: 2026-07-22  
Fase: `1.30`  
Status: concluído por decisão documentada autorizada pelo usuário

## Decisão

Não existem logs/telemetria reais de staging/produção cobrindo 7 dias para inventariar clientes dos POSTs sync/SSE do assistente por origem/User-Agent sanitizados.

Com autorização explícita do usuário em 2026-07-22, a Fase 1.30 deixa de exigir logs históricos inexistentes e passa a ser satisfeita por controles compensatórios específicos:

1. allowlist versionada dos endpoints sync/SSE do assistente;
2. inventário estático do cliente runtime conhecido no frontend;
3. owner e plano aprovado para `X-Idempotency-Key`;
4. teste executável que falha se surgirem chamadas runtime estáticas ao assistente fora da allowlist;
5. regra de bloqueio se logs futuros mostrarem qualquer consumidor não inventariado antes do cutover.

Esta decisão não prova ausência de cliente externo. Ela registra risco residual aceito e cria uma regra operacional: qualquer cliente real futuro não listado bloqueia a migração até identificação de owner e compatibilidade.

## Artefatos

- Controle compensatório: `docs/migration/ai-assistant-client-compensating-controls.json`
- Assertor: validador histórico do cliente do assistente
- Bloqueio original: `docs/migration/evidence/phase-01/30-ai-assistant-client-inventory-blocked.md`

## Inventário aprovado

### Endpoints em escopo

| Método | Public path | API path | Operation ID |
|---|---|---|---|
| POST | `/api/admin/ai-assistant/messages` | `/api/ai-assistant/messages` | `post.api_ai_assistant_messages` |
| POST | `/api/admin/ai-assistant/messages/stream` | `/api/ai-assistant/messages/stream` | `post.api_ai_assistant_messages_stream` |

### Cliente runtime conhecido

| Cliente | Owner | Path | Header atual | Plano |
|---|---|---|---|---|
| `web-admin-ai-assistant-sse` | `migration-executor` | `/api/admin/ai-assistant/messages/stream` | ausente | Fase 13.20 |

O frontend versionado atual chama o endpoint SSE em `apps/web/src/app/admin/ai-assistant/page.tsx` com:

```text
method: POST
credentials: include
headers: Content-Type: application/json
body: { content, threadId }
```

Ele ainda não envia `X-Idempotency-Key`. Isso permanece como requisito obrigatório da Fase 13.20:

- gerar UUID por envio intencional;
- reutilizar a mesma chave em retry/reconexão da mesma mensagem;
- criar chave nova para envio novo;
- enviar no POST sync/SSE;
- testar Node ignorando o header;
- testar Python exigindo o header somente quando o plano contém PDF.

## Política para cliente desconhecido

Ausência de logs não é prova de ausência.

Se qualquer log/telemetria futura antes do cutover mostrar `POST /api/ai-assistant/messages` ou `POST /api/ai-assistant/messages/stream` vindo de cliente não listado, a migração deve parar até:

1. identificar owner;
2. registrar origem/User-Agent sanitizados;
3. provar compatibilidade com `X-Idempotency-Key`;
4. atualizar controle compensatório, matriz/goldens/testes se aplicável.

## Validação executável

```text
node --check <legacy-assistant-client-assertor>.mjs
OK

node <legacy-assistant-client-assertor>.mjs
[legacy-contract] validated assistant client compensating controls: 1 runtime client, 2 scoped endpoints

git diff --check
OK, com avisos CRLF apenas em arquivos preexistentes de embeddings.
```
