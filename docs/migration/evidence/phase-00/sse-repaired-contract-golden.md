# Golden SSE reparado do assistente — Fase 0.15

Data: 2026-07-21

## Responsabilidade dos eventos

- A rota HTTP `/api/ai-assistant/messages/stream` é a única responsável por emitir `connected`.
- O service `sendAssistantMessageStream()` não emite `connected`.
- Heartbeats continuam sendo comentários SSE (`: heartbeat`) e não contam como eventos de domínio.

## Ordem canônica para Node reparado e Python futuro

```text
connected
scope?
thinking*
result | error
```

Regras:

- há exatamente um terminal: `result` ou `error`;
- cache hit termina em `result`, nunca em `data`/`complete`;
- `result` carrega o DTO público completo `AiAssistantMessageResponseDto`, incluindo `threadId`, `thread`, `answer`, `messageContent`, `scope`, `isInScope`, `suggestedQuestions`, `citations`, `contextSummary` e `generation`;
- `connected` duplicado é defeito.

## Compatibilidade temporária de rollback

O frontend aceita temporariamente o formato legado:

```text
data
complete
```

Esse fallback existe apenas para rollback contra Node antigo. Ele sintetiza um DTO mínimo usando a thread ativa do cliente quando o payload legado não inclui `threadId`/`thread`.
