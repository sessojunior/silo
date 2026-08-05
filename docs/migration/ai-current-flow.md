# Fluxo atual do assistente de IA Node

Fase: `1.19`
Data de análise: `2026-07-21`
Escopo: fluxo atual de `POST /api/ai-assistant/messages` e `POST /api/ai-assistant/messages/stream` antes da porta Python/FastAPI/LangGraph.

Este documento é um trace de caracterização. Ele descreve o comportamento Node observado e os riscos para migração; não autoriza mudança funcional fora das fases já registradas na documentação de migração.

## Fontes analisadas

Código:

- `apps/api/src/routes/ai-assistant.ts`
- `apps/api/src/services/ai-assistant-thread-service.ts`
- `apps/api/src/services/ai-assistant-service.ts`
- `apps/api/src/services/ai-assistant-llm-service.ts`
- `apps/api/src/services/ai-assistant-scope-embedding.ts`
- `apps/api/src/services/ai-assistant-rag-service.ts`
- `apps/api/src/services/ai-assistant-cache-service.ts`
- `packages/engine/src/contracts/dto/ai-assistant.ts`

Evidências já congeladas:

- `docs/migration/evidence/phase-01/13-ai-sse.md`
- `docs/migration/evidence/phase-01/15-report-pdfs.md`
- `docs/migration/evidence/phase-01/17-ai-rag-cache.md`
- `docs/migration/ai-current-known-defects.md`

## 1. Entrada pública comum

Todas as rotas de `/api/ai-assistant/*` passam por `authMiddleware`.

As rotas abaixo exigem `reports:view`:

- `GET /api/ai-assistant/status`
- `GET /api/ai-assistant/examples`
- `GET|POST /api/ai-assistant/threads`
- `GET|DELETE /api/ai-assistant/threads/:threadId`
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId`
- `POST /api/ai-assistant/messages`
- `POST /api/ai-assistant/messages/stream`

O DTO de entrada dos dois POSTs de mensagem é:

```ts
{
  threadId?: string | null; // uuid se presente
  content: string;          // min 1, max 4000
}
```

Validação inválida retorna JSON `400` com `{ success:false, error:"Mensagem inválida.", field:"content" }`. No SSE, essa validação ocorre antes dos headers de streaming.

## 2. Pipeline comum de mensagem

### 2.1 Caminho sync (`POST /messages`)

Fluxo determinístico:

1. Resolve `requestedThreadId = request.threadId ?? randomUUID()`.
2. Se `threadId` foi enviado, carrega a thread por `thread.id` e `thread.userId`.
3. Se a thread não existir para o usuário, lança `AssistantThreadNotFoundError` e a rota responde `404`.
4. Se a thread é nova ou tem `messageCount <= 4`, tenta cache semântico por usuário com `findCachedAssistantResponse(user.id, request.content)`.
5. Em cache hit:
   - cria ou atualiza a thread;
   - insere uma mensagem `user`;
   - insere uma mensagem `assistant` com `provider="cache"`, `model="semantic-cache"`, `generationStatus="success"`, `latencyMs=0`;
   - retorna resposta sem chamar chat Ollama;
   - remove `thinking` dos metadados cacheados antes de persistir a nova mensagem.
6. Em cache miss:
   - carrega contexto da thread, se existir;
   - mantém no máximo 25 mensagens para o LLM;
   - herda `conversationMemory` do último `metadata.contextSummary` de assistant;
   - herda `lastKnownScope` do último `metadata.scope` de assistant;
   - chama `answerAssistantMessage()`;
   - persiste thread + mensagem user + mensagem assistant em transação;
   - agenda `saveAssistantResponseEmbedding(assistantMessageId, answer)` em fire-and-forget.

### 2.2 Caminho SSE (`POST /messages/stream`)

Fluxo determinístico:

1. A rota valida body antes dos headers.
2. A rota envia headers SSE:
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
   - `X-Accel-Buffering: no`
3. A rota emite `event: connected` com `{status:"processing"}`.
4. A rota emite comentário `: heartbeat` a cada 5 segundos até o serviço retornar.
5. O serviço repete a lógica de thread/cache do sync.
6. Em cache hit, emite `scope` e depois `result`; persiste thread + duas mensagens.
7. Em cache miss, emite:
   - `thinking` com texto fixo `Consultando dados autorizados do Silo.`;
   - chama `generateAssistantMessage()` de forma não-streaming;
   - emite `scope`;
   - emite `thinking` com texto fixo `Consolidando resposta final.`;
   - chama `composeAssistantAnswerWithOllamaStream()`;
   - persiste thread + duas mensagens;
   - emite `result`;
   - agenda embedding da resposta em fire-and-forget.

Observação crítica: o caminho SSE live faz duas sínteses de chat em cache miss. A primeira ocorre dentro de `generateAssistantMessage()`; a segunda ocorre em `composeAssistantAnswerWithOllamaStream()`. Além disso, o `streamInput` da segunda chamada não inclui `ragContext`, então a resposta final do stream pode ser refinada sem o RAG que entrou na primeira síntese.

## 3. Classificação de scope

Ordem real em `answerAssistantMessage()`:

1. `detectScope(content)` por keywords/fuzzy/override forte.
2. `classifyScopeByEmbedding(content)` se keywords não decidiram.
3. `classifyAssistantScopeWithOllama(...)` se embedding não decidiu.

`AI_ASSISTANT_SCOPES` contém:

```text
models, pending, reports, problems, solutions, projects, general, generate_pdf
```

`SCOPE_PRIORITY`, usado pelo classificador por keywords, contém apenas:

```text
models, pending, reports, problems, solutions, projects
```

Consequência: `general` e `generate_pdf` não vencem por scoring de keywords. `general` ainda pode ser retornado pelo fallback de `PROJECT_KEYWORDS`; `generate_pdf` não.

O classificador LLM recebe como escopos válidos:

```text
models, pending, reports, problems, solutions, projects, general
```

Consequência: `generate_pdf` também não vence pelo classificador LLM. O scope `generate_pdf` só é alcançado quando o classificador por embedding retorna `generate_pdf`.

### 3.1 Vencedor de classificação por scope

| Scope | Primeiro vencedor esperado | Fallbacks possíveis | Observação de risco |
|---|---|---|---|
| `models` | Keywords/fuzzy em `modelo`, `rodada`, `turno`, `disponibilidade`, `intervenção`. | Embedding; LLM. | Empates são resolvidos por `SCOPE_PRIORITY`, com `models` antes dos demais. |
| `pending` | Keywords/fuzzy em `pendência`, `pendente`, `atraso`, `tarefas`, `trava`, `bloqueio`. | Embedding; LLM. | Pode competir com `projects`; prioridade favorece `pending` antes de `projects`. |
| `reports` | Keywords/fuzzy em `relatório`, `dashboard`, `cenário`, `sumário executivo`, `resumo executivo`, `visão geral`. | Embedding; LLM. | Perguntas genéricas com termos do Silo podem cair em `general` se não pontuarem `reports`. |
| `problems` | Override forte quando há problema/falha + recorrência + impacto/tendência; depois keywords/fuzzy em `problema`, `falha`, `incidente`, `erro`. | Embedding; LLM. | Override forte passa antes de qualquer score. |
| `solutions` | Keywords/fuzzy em `solução`, `resolver`, `resolução`, `reabertura`, `correção`, `recorrente`, `impacto`, `tendência`. | Embedding; LLM. | A resposta base reaproveita `buildProblemsAnswer()` e força `scope="solutions"` no retorno. |
| `projects` | Override forte quando há projeto + impacto/urgência/continuidade; depois keywords/fuzzy em `projeto`, `atividade`, `task`, `andamento`, `prazo`, `cronograma`. | Embedding; LLM. | Pode competir com `pending`; `pending` vence empates pela prioridade. |
| `general` | Fallback de `PROJECT_KEYWORDS` após keywords sem score. | Embedding; LLM. | Não participa de `SCOPE_PRIORITY`; só vence por fallback genérico, embedding ou LLM. |
| `generate_pdf` | Embedding. | Nenhum fallback de keywords ou LLM seleciona este scope. | Keywords de PDF existem no mapa, mas não são avaliadas; o prompt LLM exclui `generate_pdf`. |

## 4. RAG atual

`buildRagContext(question, scope)` só executa buscas quando `scope` está neste conjunto:

```text
models, problems, solutions, projects, pending, general
```

Para `reports` e `generate_pdf`, retorna contexto vazio sem consultar as fontes RAG.

Quando habilitado, o RAG chama quatro fontes em paralelo:

| Fonte | Tabela | Busca | Limites e thresholds |
|---|---|---|---|
| Problemas similares | `product_problem` | pgvector + `pg_trgm`, depois rerank por similaridade vetorial + overlap de keywords. | `limit=5`, candidatos `15`, threshold final `0.35`. |
| Soluções similares | `product_solution` | pgvector + `pg_trgm`, depois rerank por similaridade vetorial + overlap de keywords. | `limit=5`, candidatos `15`, threshold final `0.35`. |
| Chunks de manual | `product_manual_chunk` | pgvector direto por menor distância. | `limit=5`, threshold `0.35`. |
| Ajuda do sistema | `help` | pgvector direto, filtrando `h.id = 'system-help'`. | no máximo 1 item, threshold `0.35`. |

Pesos declarados:

- híbrido SQL: vetorial `0.6`, texto `0.4`;
- rerank final: vetorial `0.5`, keyword `0.3`, recência `0.2`.

Observação congelada na Fase 1.17: o peso de recência é declarado, mas não participa do cálculo efetivo do rerank. Também foi observado que o SQL encontra problemas/soluções, mas o serviço legado retorna vazio nessas duas fontes por discrepância provável entre aliases snake_case da query e leitura camelCase no mapper. Manual e ajuda entram no prompt.

O texto de RAG enviado ao prompt é limitado a 2.000 caracteres e pode conter as seções:

- `Problemas similares já registrados no SILO`
- `Soluções similares já aplicadas`
- `Trechos relevantes dos manuais de produto`
- `Documentação de ajuda relevante`

## 5. Contagem de chamadas LLM/embedding

As contagens abaixo separam chamadas de chat de chamadas de embedding, porque ambas usam runtime IA mas têm efeitos e custos diferentes.

### 5.1 Cache hit

| Caminho | Chat LLM | Embeddings síncronos | Writes |
|---|---:|---:|---|
| Sync ou SSE em thread nova/curta com cache hit | 0 | 1 para lookup do cache | cria/atualiza thread + insere 2 mensagens. |

Cache hit não agenda novo embedding da resposta cacheada.

### 5.2 Cache miss com scope decidido por keywords

| Caminho | Chat LLM | Embeddings síncronos | Embeddings assíncronos | Writes |
|---|---:|---:|---:|---|
| Sync com RAG habilitado | 1 composição | 1 cache lookup se gate ativo + 4 RAG | 1 para salvar cache futuro | cria/atualiza thread + insere 2 mensagens + `UPDATE embedding` assíncrono. |
| Sync sem RAG | 1 composição | 1 cache lookup se gate ativo | 1 para salvar cache futuro | cria/atualiza thread + insere 2 mensagens + `UPDATE embedding` assíncrono. |
| SSE com RAG habilitado | 2 composições | 1 cache lookup se gate ativo + 4 RAG | 1 para salvar cache futuro | cria/atualiza thread + insere 2 mensagens + `UPDATE embedding` assíncrono. |
| SSE sem RAG | 2 composições | 1 cache lookup se gate ativo | 1 para salvar cache futuro | cria/atualiza thread + insere 2 mensagens + `UPDATE embedding` assíncrono. |

Se a thread existente tem `messageCount > 4`, o gate de cache não roda e a chamada de embedding do lookup de cache não ocorre.

### 5.3 Scope decidido por embedding

Adicionar aos números da seção 5.2:

- 1 embedding da pergunta para classificação;
- na primeira execução do processo, até 8 embeddings de descrições de scope para warmup em memória.

Essa classificação não adiciona chamada de chat.

### 5.4 Scope decidido pelo classificador LLM

Adicionar aos números da seção 5.2:

- 1 chamada de chat para classificação.

Esse caminho só é tentado se keywords e embedding falharem. Ele não pode retornar `generate_pdf`, porque o prompt não lista esse scope.

### 5.5 Falha do chat de composição

No sync, falha em `composeAssistantAnswerWithOllama()` é capturada por `finalizeAssistantResponse()` e a resposta base determinística é retornada. A Fase 1.17 congelou que, nesse fallback, `generation` pode ficar ausente.

No SSE, falha na segunda composição streaming mantém a resposta gerada na primeira composição não-streaming.

## 6. Writes comuns

Todos os scopes em cache miss persistem:

- `ai_assistant_thread`: insert para thread nova ou update para thread existente;
- `ai_assistant_message`: uma linha `user`;
- `ai_assistant_message`: uma linha `assistant`;
- `ai_assistant_message.embedding`: update assíncrono posterior, se `saveAssistantResponseEmbedding()` conseguir gerar embedding.

Metadados da mensagem assistant incluem:

- `scope`
- `isInScope`
- `refusalReason`
- `suggestedQuestions`
- `citations`
- `generation`
- `contextSummary`
- `visualization`, quando existe

O conteúdo persistido em `content` da mensagem assistant é `messageContent`, ou seja, `answer` formatado com as seções `Baseado em:` e `Perguntas que eu posso continuar respondendo:`.

No cache hit, o serviço insere duas mensagens, mas a nova mensagem assistant cacheada não recebe embedding novo.

## 7. Trace por scope

As chamadas de relatório abaixo usam `dateRange` resolvido da pergunta. Quando houver `previous*`, o período anterior é adjacente e calculado por `getPreviousAssistantDateRange()`.

### 7.1 `models`

Classificador vencedor normal:

- keywords/fuzzy de modelos ou execução operacional (`modelo`, `rodada`, `turno`, `disponibilidade`, `intervenção`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getAvailabilityReport(dateRange)`
- `getDashboardSummary()`
- `getExecutiveReport(dateRange)`
- `getAvailabilityReport(previousDateRange.dateRange)`
- `getExecutiveReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda;
- comportamento observado na Fase 1.17: problemas/soluções podem ficar vazios no serviço mesmo quando o SQL ranqueia itens.

Citações:

- `Relatório de disponibilidade`
- `Dashboard de problemas`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Disponibilidade por produto`, com os 5 produtos de menor disponibilidade;
- intenção `image`: `kind="image"`, SVG data URI, título `Visão de modelos`, métricas de produtos, disponibilidade média e intervenções.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição; +4 embeddings RAG; +1 embedding assíncrono de cache futuro;
- SSE cache miss por keywords: 2 chats de composição; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache síncrono se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.2 `pending`

Classificador vencedor normal:

- keywords/fuzzy de pendência (`pendência`, `pendente`, `atraso`, `tarefas`, `trava`, `bloqueio`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getProjectsReport(dateRange)`
- `getExecutiveReport(dateRange)`
- `getProjectsReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda.

Citações:

- `Relatório de projetos`
- `Resumo executivo`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="donut"`, título `Pendências por status`, usando `projects.tasksByStatus`;
- intenção `image`: `kind="mermaid"`, título `Fluxo de Pendências`, diagrama `flowchart TB`.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição; +4 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por keywords: 2 chats de composição; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.3 `reports`

Classificador vencedor normal:

- keywords/fuzzy de relatório ou visão gerencial (`relatório`, `dashboard`, `cenário`, `sumário executivo`, `resumo executivo`, `visão geral`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getExecutiveReport(dateRange)`
- `getProblemsReport(dateRange)`
- `getAvailabilityReport(dateRange)`

RAG:

- desabilitado para este scope;
- `buildRagContext()` retorna contexto vazio sem embeddings RAG.

Citações:

- `Relatório executivo`
- `Disponibilidade`
- `Problemas`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Visão executiva`, categorias `Produtos`, `Problemas`, `Soluções`, `Projetos`;
- intenção `image`: `kind="image"`, SVG data URI, título `Resumo de relatórios`.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição; 0 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por keywords: 2 chats de composição; 0 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.4 `problems`

Classificador vencedor normal:

- override forte quando a pergunta combina problema/falha + recorrência + impacto/tendência;
- senão, keywords/fuzzy de problema (`problema`, `falha`, `incidente`, `erro`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getProblemsReport(dateRange)`
- `getDashboardSummary()`
- `getDashboardProblemsCauses()`
- `getDashboardProblemsSolutions()`
- `getExecutiveReport(dateRange)`
- `getProblemsReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda;
- observar discrepância da Fase 1.17 para problemas/soluções.

Citações:

- `Relatório de problemas`
- `Dashboard de causas`
- `Dashboard de soluções`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Problemas por categoria`;
- intenção `image`: `kind="image"`, SVG data URI, título `Visão de problemas`.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição; +4 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por keywords: 2 chats de composição; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.5 `solutions`

Classificador vencedor normal:

- keywords/fuzzy de solução (`solução`, `resolver`, `resolução`, `reabertura`, `correção`, `recorrente`, `impacto`, `tendência`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getProblemsReport(dateRange)`
- `getDashboardSummary()`
- `getDashboardProblemsCauses()`
- `getDashboardProblemsSolutions()`
- `getExecutiveReport(dateRange)`
- `getProblemsReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda;
- observar discrepância da Fase 1.17 para problemas/soluções.

Citações:

- a resposta base vem de `buildProblemsAnswer()`, com:
  - `Relatório de problemas`
  - `Dashboard de causas`
  - `Dashboard de soluções`

Visualização:

- igual ao scope `problems`;
- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Problemas por categoria`;
- intenção `image`: `kind="image"`, SVG data URI, título `Visão de problemas`.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição com `scopeOverride="solutions"`; +4 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por keywords: 2 chats de composição; a primeira usa `scopeOverride="solutions"` dentro de `generateAssistantMessage()`, a segunda usa o scope do resultado; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

Observação: após finalizar, o retorno força `scope="solutions"`, troca `suggestedQuestions` para as perguntas de soluções e substitui `contextSummary` por um resumo específico de soluções.

### 7.6 `projects`

Classificador vencedor normal:

- override forte quando a pergunta combina projeto + impacto/urgência/continuidade;
- senão, keywords/fuzzy de projeto (`projeto`, `atividade`, `task`, `andamento`, `prazo`, `cronograma`);
- embedding ou LLM apenas se keywords não decidirem.

Chamadas de dados:

- `getProjectsReport(dateRange)`
- `getExecutiveReport(dateRange)`
- `getProjectsReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda.

Citações:

- `Relatório de projetos`
- `Resumo executivo`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Projetos com menor progresso`;
- intenção `image`: `kind="mermaid"`, título `Fluxo dos Projetos`, diagrama `flowchart LR`.

LLM e embeddings:

- sync cache miss por keywords: 1 chat de composição; +4 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por keywords: 2 chats de composição; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se keywords não vencerem.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.7 `general`

Classificador vencedor normal:

- fallback de `PROJECT_KEYWORDS` quando a pergunta contém termos do domínio Silo mas não pontua um dos scopes de `SCOPE_PRIORITY`;
- embedding ou LLM também podem retornar `general`.

Chamadas de dados:

- `getExecutiveReport(dateRange)`
- `getAvailabilityReport(dateRange)`
- `getProblemsReport(dateRange)`
- `getProjectsReport(dateRange)`
- `getExecutiveReport(previousDateRange.dateRange)`
- `getAvailabilityReport(previousDateRange.dateRange)`
- `getProblemsReport(previousDateRange.dateRange)`
- `getProjectsReport(previousDateRange.dateRange)`

RAG:

- habilitado;
- tenta problemas, soluções, chunks de manual e ajuda;
- observar discrepância da Fase 1.17 para problemas/soluções.

Citações:

- `Resumo executivo`
- `Disponibilidade`
- `Problemas`
- `Projetos`

Visualização:

- sem intenção visual: nenhuma;
- intenção `chart`: `kind="chart"`, `chartType="bar"`, título `Resumo operacional`;
- intenção `image`: `kind="image"`, SVG data URI, título `Resumo executivo`.

LLM e embeddings:

- sync cache miss por fallback/keywords de domínio: 1 chat de composição; +4 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss por fallback/keywords de domínio: 2 chats de composição; +4 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar classificação por embedding/LLM conforme seção 5 se o fallback não vencer.

Writes:

- writes comuns da seção 6;
- nenhum arquivo ou efeito externo adicional.

### 7.8 `generate_pdf`

Classificador vencedor normal:

- somente `classifyScopeByEmbedding()` pode retornar `generate_pdf`;
- keywords de PDF existem em `SCOPE_KEYWORDS.generate_pdf`, mas não são avaliadas porque `generate_pdf` não está em `SCOPE_PRIORITY`;
- `classifyAssistantScopeWithOllama()` não retorna `generate_pdf`, porque o prompt não lista esse scope.

Seleção interna do tipo de PDF:

- padrão: `executive`;
- se a pergunta contém `disponibilidade|modelo|turno|intervenção`: `availability`;
- senão, se contém `problema|falha|incidente|erro|solução`: `problems`;
- senão, se contém `projeto|atividade|task|cronograma`: `projects`.

Chamadas de dados:

- `getExecutiveReport(dateRange)`
- `getProblemsReport(dateRange)`
- `getAvailabilityReport(dateRange)`
- `getProjectsReport(dateRange)`

Observação congelada: o Node coleta os quatro relatórios sempre e descarta três na geração do arquivo. O destino Python/LangGraph não deve preservar essa coleta excessiva; ele deve resolver primeiro o tipo e consultar só o dataset necessário, conforme o plano.

RAG:

- desabilitado para este scope;
- `buildRagContext()` retorna contexto vazio sem embeddings RAG.

Citações:

- a resposta final usa `buildReportsAnswer(executive, problems, availability, periodLabel)`, portanto as citações são:
  - `Relatório executivo`
  - `Disponibilidade`
  - `Problemas`

Visualização/artefato:

- se `generatePdf()` retorna URL, o retorno usa `visualization.kind="image"` com `src` apontando para o PDF;
- isso disfarça PDF como imagem no DTO atual;
- se `generatePdf()` falha, `visualization` fica ausente;
- não há `artifacts[]` no contrato atual.

LLM e embeddings:

- sync cache miss quando embedding seleciona `generate_pdf`: 1 chat de composição; 0 embeddings RAG; +1 embedding assíncrono;
- SSE cache miss quando alcançado: 2 chats de composição; 0 embeddings RAG; +1 embedding assíncrono;
- adicionar lookup de cache se gate ativo;
- adicionar custo de classificação por embedding: 1 embedding da pergunta e, no primeiro uso, até 8 embeddings de warmup;
- não existe caminho de classificação LLM para este scope.

Writes:

- writes comuns da seção 6;
- arquivo PDF em disco via `generatePdf()`, normalmente sob uploads de relatórios;
- nenhum registro de artefato dedicado além da URL guardada em `metadata.visualization`, quando existe.

## 8. Riscos vinculantes para a porta Python/LangGraph

1. LangGraph deve orquestrar o workflow; Ollama continua sendo runtime de chat/embedding atrás de adaptadores.
2. O primeiro grafo deve preservar o roteamento determinístico e expor tools tipadas, não SQL/HTTP/filesystem genéricos ao modelo.
3. `generate_pdf` deve continuar sendo nó determinístico com intenção explícita e idempotência; não deve ser tool livre do modelo.
4. O destino não deve reproduzir a dupla síntese SSE live; deve haver uma síntese por resposta live.
5. O destino não deve omitir RAG na resposta final streaming quando RAG foi usado para construir a resposta.
6. Cache Python deve exigir usuário e assinatura versionada. Cache legado sem `graphVersion`, `promptVersion`, `toolCatalogVersion`, `metricVersion`, `chatModel`, `embeddingModel` e `cacheSignature` deve ser tratado como miss.
7. O defeito de aliases do RAG em problemas/soluções está congelado para entendimento, mas não deve virar contrato permanente de LangGraph/tools.
8. PDF não deve permanecer disfarçado de `image` como modelo final. A evolução determinada é `artifacts[]` aditivo, preservando `visualization` apenas durante rollback.
9. Nenhum prompt, resposta, SSE, metadata ou log deve solicitar ou expor cadeia de pensamento privada. O fluxo atual já usa mensagens públicas de `thinking` estáticas no SSE após a correção da Fase 0.
10. Métricas conhecidamente frágeis de relatórios, como resolução fixa em 80%, top-5 sem ordenação estável e `groupId` não aplicado, não podem ser promovidas como fatos do agente até as fases de semântica/métricas.
