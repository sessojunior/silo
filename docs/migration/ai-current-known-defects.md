# Defeitos conhecidos do assistente Node antes dos goldens

Fase: `0.13`
Data: `2026-07-21`

## SSE live faz duas passagens pelo modelo

O caminho sync (`POST /api/ai-assistant/messages`) faz uma chamada
non-streaming ao Ollama para refinamento da resposta.

O caminho SSE live (`POST /api/ai-assistant/messages/stream`) faz hoje:

1. `generateAssistantMessage()`, que chama o refinamento non-streaming;
2. `composeAssistantAnswerWithOllamaStream()`, que chama o refinamento streaming.

Isso dobra custo/latencia e pode gerar divergencia entre a resposta base
refinada e a resposta final do stream.

Evidencia automatizada:

- `apps/api/src/services/ai-assistant-ollama-calls.test.ts`
- caso `live SSE path currently performs two refinements: one non-streaming and one streaming`

Tratamento determinado pelo plano de migração:

- nao preservar esse comportamento como contrato;
- a implementacao Python/LangGraph deve fazer uma unica sintese no caminho live;
- cache hit deve continuar com zero chamada de chat/stream ao Ollama.

## generate_pdf coleta quatro relatórios mesmo quando só um PDF é pedido

O caminho Node atual do scope `generate_pdf` detecta o tipo de PDF, mas antes
de gerar o arquivo ainda coleta:

1. `getExecutiveReport(dateRange)`;
2. `getProblemsReport(dateRange)`;
3. `getAvailabilityReport(dateRange)`;
4. `getProjectsReport(dateRange)`.

Depois disso, apenas um desses datasets é usado em `generatePdf()`.

Evidencia automatizada:

- `apps/api/src/services/ai-assistant-ollama-calls.test.ts`
- caso `PDF generation failure omits visualization and still calls the four current report services`

Tratamento determinado pelo plano de migração:

- não preservar essa coleta excessiva como contrato;
- a implementação Python/LangGraph deve resolver primeiro o tipo de relatório e
  chamar somente o dataset necessário;
- combinações de datasets só devem ocorrer quando solicitadas explicitamente
  pelo usuário e materializadas no plano validado do orquestrador.
