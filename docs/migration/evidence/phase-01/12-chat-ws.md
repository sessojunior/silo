# Fase 1.12 — contrato WebSocket de chat/realtime legado

Data da execução: 2026-07-21  
Banco: `silo_contract_legacy`  
API legada: Node/Express em `127.0.0.1:4000`  
Golden gerado: `tests/fixtures/legacy-golden/phase1_12.chat_ws.realtime.json`

## Comandos executados

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-chat-realtime.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node --check tests\contracts\legacy\capture-chat-ws-contract.mjs
node --check tests\contracts\legacy\run-chat-ws-with-node-api.mjs
node tests\contracts\legacy\run-chat-ws-with-node-api.mjs --label=12-chat-ws
```

Resultado final:

```text
[legacy-contract] captured chat websocket contract -> tests\fixtures\legacy-golden\phase1_12.chat_ws.realtime.json
```

Logs da execução:

- `docs/migration/evidence/phase-01/12-chat-ws/api-node.stdout.log`
- `docs/migration/evidence/phase-01/12-chat-ws/api-node.stderr.log`
- `docs/migration/evidence/phase-01/12-chat-ws/capture.stdout.log`
- `docs/migration/evidence/phase-01/12-chat-ws/capture.stderr.log`
- `docs/migration/evidence/phase-01/12-chat-ws/external-stub.stdout.log`
- `docs/migration/evidence/phase-01/12-chat-ws/external-stub.stderr.log`

## Escopo capturado

O golden cobre 14 passos determinísticos:

1. handshake sem cookie;
2. handshake com cookie autenticado, mas sem permissão de chat;
3. conexão de observador parcial;
4. conexão da primeira aba admin;
5. conexão da segunda aba admin sem duplicar presença;
6. heartbeat `ping` do servidor e `pong` automático do cliente;
7. evento `chat.message.created`;
8. evento `chat.message.read`;
9. segundo `chat.message.created`;
10. evento `chat.messages.read`;
11. terceiro `chat.message.created`;
12. evento `chat.message.deleted`;
13. fechamento da primeira aba admin sem broadcast offline;
14. fechamento da última aba admin com broadcast offline.

Tipos de evento congelados:

- `chat.connected`
- `chat.message.created`
- `chat.message.read`
- `chat.messages.read`
- `chat.message.deleted`
- `chat.presence.updated`

## Observações de contrato

- O path WebSocket legado é `/api/chat/ws`.
- Handshake sem cookie retorna resposta HTTP `401 Unauthorized` durante upgrade.
- Usuário autenticado sem permissão abre o socket e recebe fechamento `1008` com motivo `Acesso ao chat negado.`.
- A primeira conexão de um usuário dispara presença online; segunda aba do mesmo usuário recebe `chat.connected`, mas não duplica presença.
- O servidor envia `ping` após intervalo de `30000ms`; o cliente `ws` responde `pong` automaticamente e a conexão permanece aberta.
- Fechar uma aba admin enquanto outra aba do mesmo usuário continua aberta não gera offline.
- Fechar a última aba admin gera `chat.presence.updated` com status final invisível/offline para o observador.
- O estado final do banco confirma presença final dos usuários conectados e mensagens não deletadas; timestamps e UUIDs dinâmicos foram normalizados.

## Controle determinístico aplicado

Durante a captura, o Better Auth gera IDs de sessão usando `randomBytes`. O preload determinístico da suíte tem ciclo curto e, após múltiplos logins no mesmo processo, o primeiro e o terceiro `session.id` podem colidir. O harness da 1.12 mantém determinismo e avança 1 byte entre logins de bootstrap para evitar colisão de primary key sem alterar comportamento funcional do WebSocket.

Esse controle fica restrito ao harness `tests/contracts/legacy/capture-chat-ws-contract.mjs`. Ele não altera API, banco produtivo, frontend ou contrato público.
