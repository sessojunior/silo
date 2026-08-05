# Contrato reparado de IA

Data: 2026-07-22

Este documento congela o comportamento reparado do assistente que a migração Python/FastAPI deve preservar. Ele substitui os defeitos legados de cache cross-user, SSE sem terminal canônico e exposição de raciocínio privado como baseline aceitável.

## Superfícies públicas

- `GET /api/ai-assistant/status` continua expondo `provider: "ollama"` e `mode: "ollama" | "fallback"`. LangGraph é orquestração interna e não vira provedor público obrigatório.
- `POST /api/ai-assistant/messages` e o terminal `result` de `POST /api/ai-assistant/messages/stream` continuam retornando `AiAssistantMessageResponseDto`.
- Campos públicos obrigatórios de LangGraph não existem neste contrato. Versão de grafo, trajetória, node path, tool calls, checkpoint e run id ficam em telemetria/metadados internos sanitizados quando forem introduzidos.
- O schema TypeScript ainda mantém `thinking` opcional por compatibilidade temporária de rollback. Saídas reparadas não devem preencher esse campo.

## SSE reparado

Ordem canônica de eventos de domínio:

```text
connected
scope?
thinking*
result | error
```

Regras vinculantes:

- a rota HTTP é a única responsável por emitir `connected`;
- o service `sendAssistantMessageStream()` não emite `connected`;
- heartbeats são comentários SSE `: heartbeat` e não contam como eventos de domínio;
- há exatamente um terminal por stream: `result` ou `error`;
- o terminal é o último evento de domínio;
- cache hit termina em `result`, nunca em `data`/`complete`;
- `data`/`complete` só é aceito pelo frontend como fallback de rollback contra Node antigo.

## Cache semântico

- Lookup de cache exige `userId`.
- A query deve juntar `ai_assistant_message` com `ai_assistant_thread` e filtrar `thread.user_id`.
- Metadados cacheados antigos que contenham `thinking` devem ser sanitizados antes de persistir nova mensagem ou devolver payload.
- Cache hit público usa `generation.provider: "cache"` e `generation.model: "semantic-cache"`. Isso não altera o status público do runtime, que continua `provider: "ollama"`.

## Persistência canônica

- A fonte canônica de conversa permanece em `ai_assistant_thread` e `ai_assistant_message`.
- Para cada mensagem aceita do usuário há uma única mensagem persistida do assistente.
- O terminal `result` só é emitido depois da persistência canônica da resposta.
- Escrita posterior de embedding é efeito de cache, fire-and-forget, e não cria uma segunda persistência canônica.
- Checkpoints persistentes do LangGraph não fazem parte do cutover; não deve haver segunda fonte de verdade.

## Raciocínio e progresso

- O prompt de refinamento não pede cadeia de pensamento.
- O modelo deve devolver apenas `answer` e `contextSummary`.
- Eventos públicos `thinking` significam somente progresso operacional sanitizado, com frases constantes do servidor.
- Raciocínio privado não pode aparecer em SSE, resposta JSON, metadados da mensagem, histórico, golden ou log.

## Débito observado que não vira contrato

O Node atual ainda executa dois refinamentos no caminho SSE live: um não-streaming durante a coleta e outro streaming antes do terminal. Isso está caracterizado para risco/custo, mas não é contrato a preservar. A porta Python deve seguir os limites das fases posteriores e não tratar dupla geração como requisito.
