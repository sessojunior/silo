# Correções completas do assistente de IA

## Objetivo

Eliminar os bugs reproduzíveis e as pendências diretamente relacionadas ao assistente de IA, mantendo compatibilidade entre backend, SSE e frontend e comprovando o fluxo contra o serviço real de inferência.

## Requisitos

- Uma requisição sem `thread_id` deve criar e usar uma conversa válida.
- Uma conversa inexistente deve retornar erro de domínio controlado, sem 500 genérico.
- JSON inválido ou corpo com codificação inválida deve retornar 400.
- O SSE deve emitir deltas incrementais reais quando o runtime suportar streaming e sempre encerrar com um resultado final consistente.
- Timeout e cancelamento devem permanecer ativos durante toda a leitura do SSE.
- O contrato de escopos deve ser idêntico entre backend e frontend, incluindo `products`.
- Eventos SSE recebidos pelo frontend devem ser validados antes de alterar o estado da UI.
- Conteúdo Markdown do assistente deve ser renderizado com segurança.
- Falhas do provedor devem produzir erro observável e não deixar estado ou recursos abertos.
- O comportamento deve ser coberto por testes automatizados e por smoke test real do serviço.

## Fora de escopo

Erros de tipagem ou lint antigos em módulos não relacionados ao assistente de IA não serão reescritos nesta rodada; serão reportados separadamente.
