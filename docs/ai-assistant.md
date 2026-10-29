# Assistente de IA

Este documento descreve o comportamento atual do assistente de IA do SILO, os
contratos entre backend e frontend e os procedimentos para testar o fluxo
completo.

## Visão geral

O fluxo é executado localmente no stack do SILO:

```text
Browser
  -> Next.js (/api/admin/ai-assistant/*)
  -> FastAPI (/api/ai-assistant/*)
  -> LangGraph + ferramentas autorizadas
  -> PostgreSQL/pgvector e vLLM
```

O backend é a autoridade para threads, permissões, escopo, persistência e
resultado final. O frontend apenas exibe o estado recebido e valida os eventos
SSE antes de alterar a interface.

## Threads e mensagens

### Criação implícita

`threadId` é opcional no envio de uma mensagem. Quando não é informado, o
backend mantém o valor como `null` até o fluxo criar ou localizar a thread
correta. Não deve ser gerado um UUID provisório no cliente ou no estado inicial
do grafo.

O envio pelo endpoint do backend usa:

```http
POST /api/ai-assistant/messages
POST /api/ai-assistant/messages/stream
Content-Type: application/json
```

```json
{
  "content": "Quais produtos tiveram incidentes esta semana?",
  "threadId": null
}
```

No endpoint do frontend, o prefixo equivalente é
`/api/admin/ai-assistant/messages/stream`.

### Validação e segurança

- JSON malformado, UTF-8 inválido, corpo vazio e schema inválido retornam HTTP
  400 com erro de campo controlado.
- Uma thread inexistente retorna erro de domínio controlado; não deve virar
  erro 500.
- Uma thread de outro usuário não é exposta: a consulta sempre filtra pelo
  usuário autenticado.
- Mensagens e respostas são persistidas somente pelo backend.

## Contrato SSE

O endpoint de streaming responde com `text/event-stream` e mantém a conexão
viva com heartbeats enquanto o grafo ainda está processando.

Eventos suportados:

| Evento | Payload | Uso |
|---|---|---|
| `connected` | `{ "status": "processing" }` | Confirma o início do stream. |
| `thinking` | `{ "content": "..." }` | Texto de progresso/raciocínio exibido durante o processamento. |
| `delta` | `{ "content": "..." }` | Fragmento incremental da resposta final. |
| `scope` | `{ "scope": "reports", "isInScope": true }` | Escopo classificado pelo backend. |
| `result` | DTO completo da mensagem | Resultado final validado e persistido. |
| `error` | `{ "content": "..." }` | Falha controlada. |
| `heartbeat` | comentário SSE | Mantém a conexão aberta; não altera o estado do chat. |

O evento `result` é obrigatório para concluir uma resposta. Se o stream terminar
sem esse evento, o frontend trata a operação como falha e oferece retry.

### Streaming do modelo

Quando o runtime vLLM oferece `stream`, o backend encaminha os fragmentos reais
produzidos pelo modelo. Os deltas são extraídos incrementalmente do campo JSON
`answer` e enviados para a fila do stream. O backend não divide uma resposta já
completa artificialmente para simular tokens.

Quando o runtime não oferece streaming, o backend usa explicitamente o caminho
de conclusão tradicional. Nesse caso não são fabricados eventos `delta`; o
frontend aguarda o `result` completo.

O resultado final continua sendo parseado, validado, verificado contra as
evidências autorizadas e persistido uma única vez.

### Interpretação de perguntas e artefatos

- Expressões relativas usam períodos de calendário: “esta semana” começa na
  segunda-feira atual; “semana passada” representa a semana anterior completa;
  “este mês”, “mês passado”, “este trimestre” e equivalentes seguem o mesmo
  princípio.
- Perguntas sobre “incidentes por produto” são encaminhadas para o escopo de
  rodadas/modelos, que possui a métrica `incidentRuns`. A resposta textual lista
  os produtos e suas respectivas contagens quando disponíveis.
- Os títulos dos gráficos são orientados à pergunta, como “Incidentes por
  produto” e “Problemas por categoria”, em vez de expor nomes internos de
  escopo.
- Uma imagem solicitada pelo assistente é um resumo visual SVG determinístico;
  não representa geração criativa por um modelo de imagens.
- Quando o modelo vLLM não produz uma síntese utilizável, a resposta
  determinística é preservada e o frontend identifica o estado como “Resposta
  de contingência”. Uma síntese que contradiga um artefato já gerado é
  descartada.
- Os clientes assíncronos de chat e embeddings criados por uma requisição são
  fechados ao final do fluxo para evitar tarefas pendentes e erros de loop de
  eventos durante a coleta de recursos.

Além das regras acima, o cálculo de períodos relativos usa o fuso operacional
`America/Sao_Paulo`, incluindo as formas "nesta semana", "neste mês" e "neste
trimestre". Gráficos sem registros mantêm uma categoria explícita de ausência
de dados e valor zero. Se a geração de um PDF falhar, o artefato é marcado como
falho e a resposta informa a falha, sem afirmar que o relatório foi preparado.

Para consultas de soluÃ§Ãµes, o grÃ¡fico usa a mÃ©trica disponÃ­vel de problemas
relacionados e deixa isso explÃ­cito no tÃ­tulo; a contagem textual de soluÃ§Ãµes vem
do resumo agregado do relatÃ³rio.

## Frontend

O parser em `apps/frontend/src/lib/ai-assistant-sse.ts`:

- reagrupa frames SSE fragmentados entre chunks;
- ignora comentários de heartbeat e eventos desconhecidos;
- valida o DTO completo do evento `result` com Zod;
- valida `delta.content` como string;
- transforma payloads inválidos em erro controlado, sem aplicar casts cegos.

A página do assistente:

- acumula os deltas no placeholder da mensagem;
- substitui o placeholder pelo resultado persistido quando recebe `result`;
- mantém o timeout até o fim da leitura do `ReadableStream`;
- limpa o timeout em `finally`;
- aborta operações que ultrapassem cinco minutos;
- remove mensagens parciais após falha;
- oferece “Tentar novamente” sem duplicar a mensagem do usuário.

## Markdown e segurança de conteúdo

Mensagens do assistente são renderizadas com `react-markdown` sem habilitar
HTML arbitrário. Assim, títulos, listas, código e links Markdown podem ser
exibidos, mas tags HTML e scripts recebidos como texto não são inseridos como
HTML executável.

Mensagens do usuário continuam sendo renderizadas como texto simples com
`whitespace-pre-wrap`.

## Escopos suportados

O contrato compartilhado em
`packages/engine/src/contracts/dto/ai-assistant.ts` aceita:

```text
models, pending, reports, problems, solutions, projects,
products, general, generate_pdf
```

O backend continua responsável por decidir se a pergunta está dentro do
escopo, quais ferramentas podem ser usadas e quais evidências podem aparecer
na resposta.

## Procedimentos gerais e prioridade das fontes

A página `/admin/procedures` mantém procedimentos avulsos que podem ser
consultados pelo assistente. Para perguntas específicas de produto, o manual
do produto continua recebendo prioridade preferencial. Para resolução
operacional geral, o ranking promove trechos de anexos de procedimentos e o
texto do procedimento, sem descartar uma evidência muito mais específica de
problema, solução ou intervenção registrada.

Os formatos com extração textual são PDF, TXT/MD, DOCX e PPTX. Imagens são
armazenadas no volume de uploads e podem receber descrição/OCR manual; o
modelo textual só usa essa descrição derivada até que um runtime multimodal
seja configurado. Anexos com falha de extração não entram na busca.

As citações preservam o procedimento, o nome do arquivo e página ou slide
quando disponíveis. A consulta é somente leitura: cadastrar, editar,
reprocessar e remover procedimentos exige `procedures:manage`.

Essa prioridade é preferencial, não absoluta: o sistema pode combinar manual,
problema, solução, intervenção e procedimento quando a pergunta envolver uma
rodada, uma alteração de modelo ou um incidente histórico. Assim, a resposta
mantém o manual como referência principal sem esconder evidências operacionais
mais recentes ou diretamente relacionadas.

O campo **Disponivel para consulta da IA** (`active`) e aplicado no momento da
busca. Quando desmarcado, o texto do procedimento e todos os chunks dos seus
anexos ficam fora tanto da recuperacao lexical quanto da vetorial. Os
embeddings podem permanecer armazenados para evitar reprocessamento e voltam a
ser elegiveis se o procedimento for reativado.

Perguntas classificadas como rodadas/modelos tambem executam a busca de
conhecimento automaticamente, para que manuais, problemas, solucoes e
procedimentos ativos possam orientar a resposta sem depender de uma decisao
eventual do modelo.

Na interface, a página segue o padrão mestre–detalhe das páginas de produtos:
a lista usa linhas contínuas com divisores e o detalhe concentra edição,
anexos e pré-visualização no painel ao lado. Isso evita espaços artificiais
entre colunas e facilita a leitura de procedimentos longos.

## Runtime e configuração

Variáveis principais:

```env
AI_AGENT_MODE=hybrid
AI_AGENT_MAX_ROUNDS=2
AI_AGENT_MAX_TOOL_CALLS=4
AI_AGENT_TOOL_TIMEOUT_MS=60000
VLLM_MAX_CONCURRENT_REQUESTS=4
VLLM_CONCURRENCY_ACQUIRE_TIMEOUT_MS=500
VLLM_MODEL=Qwen/Qwen2.5-0.5B-Instruct
VLLM_URL=http://localhost:8000/v1
VLLM_EMBEDDING_URL=http://localhost:8001/v1
```

O modo `deterministic` permanece disponível como fallback operacional. A
indisponibilidade do vLLM deve resultar em fallback ou erro controlado, nunca em
dados fora das ferramentas autorizadas.

## Como testar

### Testes automatizados

Na raiz do repositório:

```bash
npm run test:web -- --run
npm run typecheck
npm run lint
npm run build
```

Backend:

```bash
cd apps/backend
.venv/Scripts/python.exe -m pytest -q \
  tests/unit/test_ai_assistant_service_helpers.py \
  tests/unit/test_ai_assistant_routes.py \
  tests/unit/test_ai_vllm_runtime.py
```

Os testes cobrem criação implícita de thread, parsing de entrada inválida,
streaming incremental, fallback, contratos SSE, retry e Markdown seguro.

### Stack local

```bash
docker compose up -d --build
docker compose ps
Invoke-WebRequest http://localhost:4000/health/live
Invoke-WebRequest http://localhost:4000/health/ready
```

O frontend fica em `http://localhost/silo/admin/ai-assistant` quando
`NEXT_PUBLIC_BASE_PATH=/silo`.

Para acompanhar o runtime:

```bash
docker compose logs -f api ai embeddings indexer worker
```

O smoke test deve verificar login, envio sem `threadId`, eventos `delta`,
`scope`, `result`, ausência de `error` e exclusão da thread temporária.

## Diagnóstico rápido

| Sintoma | Verificações |
|---|---|
| Stream termina sem resposta | Verifique logs da API e se o evento `result` foi emitido. Confirme o modelo em `/api/ai-assistant/status`. |
| Não aparecem deltas | Confirme se o runtime implementa `stream`; sem suporte, o comportamento correto é receber somente `result`. |
| Thread não encontrada | Confira o `threadId`, o usuário autenticado e se a thread pertence ao usuário. Para nova conversa, omita `threadId`. |
| Resposta 400 | Valide JSON, UTF-8, `content` não vazio e nomes camelCase (`threadId`). |
| Timeout no frontend | Verifique `docker compose ps`, healthchecks da API/vLLM e latência do modelo; o limite do cliente é cinco minutos. |
| Markdown aparece sem formatação | Confirme que a mensagem é do assistente e que `react-markdown` está instalado; mensagens do usuário são texto simples por design. |

## Arquivos de referência

- Backend: `apps/backend/src/silo/ai/assistant_service.py`
- Runtime vLLM: `apps/backend/src/silo/ai/assistant_runtime.py`
- Rotas: `apps/backend/src/silo/api/routers/ai_assistant.py`
- Contratos compartilhados: `packages/engine/src/contracts/dto/ai-assistant.ts`
- Parser SSE: `apps/frontend/src/lib/ai-assistant-sse.ts`
- Tela: `apps/frontend/src/app/admin/ai-assistant/page.tsx`
- Bolha de mensagem: `apps/frontend/src/components/admin/chat/message-bubble.tsx`
