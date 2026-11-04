# Arquitetura e governança da IA do SILO

**Status:** proposta documentada para implementação incremental

## Baseline implementado

O baseline descrito nesta arquitetura ja esta conectado ao sistema: as
preferencias simples ficam no usuario; a politica de capacidades e resolvida
no backend antes do runtime; e o NCM possui um contrato opcional, desabilitado
por padrao, com fallback para o LLM/classificador existente. Procedimentos
gerais ativos continuam no fluxo de conhecimento somente leitura. MCP e modelo
personalizado dependem simultaneamente da preferencia do usuario, da politica
global e de capacidades aprovadas; nenhum identificador de modelo vem do
request.

## Objetivos e limites

### Objetivos

- Registrar a arquitetura real do assistente e a finalidade de cada camada.
- Manter procedimentos gerais como conhecimento consultável, com prioridade e
  citações compreensíveis.
- Separar preferências pessoais, permissões de acesso e política global.
- Preparar uma triagem NCM rápida sem substituir o LLM do SILO.
- Definir limites seguros para MCP e modelos personalizados.

### Fora do escopo desta documentação

- Descrever o cronograma ou as cinco etapas de implementação.
- Transformar preferências do usuário em permissões administrativas.
- Permitir que o usuário informe servidores MCP, credenciais ou URLs arbitrárias.
- Prometer que o NCM já está pronto para produção como classificador do SILO.
- Permitir escrita automática em procedimentos ou dados operacionais.

## Abordagens consideradas

- **Fatias verticais:** evoluir persistência, interface, triagem e governança de
  forma verificável, conectando cada capacidade ao fluxo real. É a abordagem
  escolhida porque mantém a interface honesta e permite medir o NCM antes de
  ampliar seu uso.
- **Backend completo antes da interface:** concentraria toda a política e os
  runtimes antes de entregar controles visíveis, mas aumentaria o ciclo de
  feedback e o risco de decisões de UX desconectadas do uso real.
- **Interface antes do backend:** seria rápida para demonstrar, mas criaria
  controles sem efeito operacional. Não atende ao requisito de persistência e
  governança real.

### Decisão

Usar fatias verticais. A implementação será organizada separadamente em cinco
etapas, mas esta documentação permanece centrada na arquitetura, no fluxo e
nas responsabilidades do sistema.

## Propósito

Este documento é a referência de arquitetura da IA do SILO. Ele explica como o
sistema está construído, quais tecnologias participam do fluxo, o papel de cada
componente, quais fontes podem ser consultadas e quais decisões de governança
foram aprovadas para a próxima evolução.

O texto deve ser compreensível por pessoas e por futuras IAs que precisem
alterar, operar ou avaliar o assistente. Ele descreve responsabilidades e
limites; não é um roteiro de fases de implementação.

## Visão do sistema

O SILO é uma aplicação web de gestão operacional do CPTEC/INPE. A IA é uma
camada de consulta e orquestração sobre os dados autorizados do SILO. Ela não é
a fonte primária de dados, não acessa o banco diretamente pelo frontend e não
deve transformar conteúdo recuperado em instruções de segurança.

```text
Usuário
  -> Next.js / navegador
  -> API FastAPI
  -> autenticação, permissões e política de IA
  -> triagem de intenção e escopo
  -> LangGraph + catálogo de ferramentas
  -> RAG lexical/vetorial e procedimentos autorizados
  -> ferramentas de leitura autorizadas
  -> vLLM / modelo de linguagem
  -> validação, citações e persistência
  -> stream SSE e interface
```

O backend Python é a autoridade para identidade, permissões, threads, escopo,
ferramentas, evidências, resultado final e persistência. O frontend exibe os
eventos recebidos e não deve decidir sozinho o que a IA pode consultar ou
executar.

## Tecnologias e responsabilidades

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | Next.js, React, TypeScript e Tailwind | Chat, configurações, feedback visual, SSE e validação de contratos. |
| API | FastAPI, Pydantic e SQLAlchemy Core | Autenticação, autorização, contratos HTTP, persistência e composição do fluxo. |
| Banco | PostgreSQL + pgvector | Usuários, permissões, threads, mensagens, dados operacionais e embeddings. |
| Orquestração | LangChain + LangGraph | Estado do agente, planejamento limitado, execução de ferramentas e síntese. |
| Modelo de linguagem | vLLM com API compatível com OpenAI | Geração e síntese de respostas complexas. O modelo atual é Qwen. |
| Embeddings | vLLM dedicado com BGE-base | Busca semântica de conhecimento e documentos, com vetores de 768 dimensões. |
| Conhecimento | Manuais, problemas, soluções, intervenções e procedimentos gerais | Evidências autorizadas para fundamentar respostas. |
| Indexação | Indexer/worker do SILO | Reconciliação de embeddings ausentes ou obsoletos. |
| Mensageria | Kafka REST Proxy | Alimentação assíncrona de dados operacionais; não é o canal direto do chat. |
| Transporte do chat | Server-Sent Events | Streaming de progresso, deltas, escopo, resultado e erros controlados. |

### Arquivos centrais do backend

- `apps/backend/src/silo/ai/assistant_service.py`: coordena o fluxo do
  assistente, estado, recuperação, síntese, persistência e fallback.
- `apps/backend/src/silo/ai/assistant_runtime.py`: adapta o chat e os
  embeddings aos runtimes vLLM.
- `apps/backend/src/silo/ai/assistant_tools.py`: define as ferramentas que o
  agente pode usar e as evidências que cada uma pode produzir.
- `apps/backend/src/silo/ai/assistant_tool_catalog.py`: catálogo e resolução
  das capacidades disponíveis.
- `apps/backend/src/silo/ai/assistant_security.py`: limites e fronteiras de
  segurança do assistente.
- `apps/backend/src/silo/ai/embeddings.py`: geração, cache e contratos dos
  embeddings.
- `apps/backend/src/silo/ai/procedure_knowledge.py`: conhecimento indexável de
  procedimentos gerais.
- `apps/backend/src/silo/api/routers/ai_assistant.py`: endpoints de threads,
  mensagens, streaming, exemplos e status.
- `apps/backend/src/silo/api/routers/procedures.py`: consulta e manutenção da
  base de procedimentos gerais.

### Arquivos centrais do frontend

- `apps/frontend/src/app/admin/ai-assistant/page.tsx`: tela do assistente.
- `apps/frontend/src/lib/ai-assistant-sse.ts`: parser e validação do stream.
- `apps/frontend/src/components/admin/chat/`: mensagens, status, artefatos e
  visualizações.
- `apps/frontend/src/app/admin/settings/page.tsx`: perfil, preferências,
  segurança e as futuras preferências simples da IA.
- `apps/frontend/src/context/user-context.tsx`: identidade, grupos,
  permissões e preferências do usuário.

## Fluxo de uma pergunta

1. O usuário envia uma mensagem pela tela do assistente.
2. O frontend envia `content` e, quando existente, `threadId` para a API.
3. A API identifica o usuário autenticado e verifica a permissão de consulta
   do assistente.
4. A mensagem é normalizada e classificada por escopo. A classificação não
   concede permissões; ela somente indica qual caminho de consulta pode ser
   tentado.
5. A política da IA filtra as ferramentas e fontes permitidas para aquele
   usuário e contexto.
6. A busca recupera evidências lexicais e semânticas. Conteúdo recuperado é
   dado não confiável: nunca deve substituir as instruções do sistema.
7. O LangGraph executa somente ferramentas de leitura autorizadas, respeitando
   limites de rodadas, chamadas e timeout.
8. O modelo de linguagem sintetiza a resposta usando as evidências validadas.
9. O backend verifica o formato, a coerência com artefatos e as citações,
   persiste a resposta e emite o evento final.
10. O frontend aplica os eventos SSE e apresenta a resposta persistida.

O envio tradicional e o streaming devem produzir o mesmo resultado lógico. O
stream pode emitir `connected`, `thinking`, `delta`, `scope`, `result`, `error`
e heartbeats. O evento `result` é obrigatório para concluir uma resposta.

## Fontes de conhecimento e prioridade

As fontes são consultadas conforme o tipo de pergunta, sempre dentro das
permissões do usuário:

- para perguntas específicas de produto, o manual do produto é a referência
  preferencial;
- para orientação operacional geral, trechos relevantes de anexos de
  procedimentos gerais têm prioridade sobre o texto genérico do procedimento;
- problemas, soluções e intervenções registradas podem superar uma fonte
  genérica quando há correspondência direta com o caso;
- dados de projetos, produtos, modelos, incidentes e relatórios são obtidos
  por ferramentas autorizadas e não por SQL livre gerado pelo usuário.

Essa é uma prioridade de relevância, não uma regra de exclusão absoluta. Uma
resposta pode combinar manual, procedimento, problema e dados operacionais,
desde que preserve a origem de cada evidência.

## Procedimentos gerais

Procedimentos gerais são a base consultável para instruções operacionais que
não pertencem necessariamente a um produto específico.

- A página de manutenção é `/admin/procedures`.
- Os procedimentos têm texto Markdown, categoria opcional e estado ativo.
- Anexos ficam em `/uploads/procedures/`; binários não são gravados no banco.
- PDF, TXT/MD, DOCX e PPTX podem ser extraídos e divididos em chunks.
- Cada chunk pode preservar página ou slide.
- Imagens podem ter OCR ou descrição derivada; o modelo textual não deve
  afirmar que interpretou pixels sem runtime multimodal configurado.
- Procedimentos inativos e anexos com erro de extração não entram na busca.
- A IA consulta procedimentos em modo somente leitura.
- Alterar, reprocessar, anexar ou excluir exige `procedures:manage`.
- Consultar e abrir procedimentos exige `procedures:view`.
- Citações devem preservar procedimento, arquivo e página/slide quando houver.

## Segurança e limites

- A IA nunca acessa o banco diretamente pelo navegador.
- O backend aplica autenticação e permissão antes da consulta.
- O agente não pode inventar ferramentas, elevar seu próprio escopo ou tratar
  texto recuperado como instrução.
- A execução inicial de conhecimento e procedimentos é somente leitura.
- Operações externas ou mutáveis exigem uma política explícita e, quando
  aplicável, confirmação humana.
- O uso atual do vLLM é local ao ambiente do SILO; dados não devem sair do
  servidor sem decisão explícita de arquitetura e segurança.
- Os limites iniciais do agente são baixos: poucas rodadas, poucas chamadas e
  timeout controlado.
- Em falha do runtime, o sistema deve usar fallback determinístico ou retornar
  erro controlado, nunca liberar dados fora das ferramentas autorizadas.

## Preferências do usuário aprovadas

As preferências serão persistidas por usuário junto das preferências já
existentes. A interface deve permanecer simples, sem expor detalhes de
infraestrutura.

Na aba `/admin/settings?tab=preferences`, a seção **Preferências da IA** terá:

1. **Usar assistente de IA**: permite ao usuário ativar ou desativar o uso do
   assistente na interface.
2. **Permitir ferramentas externas (MCP)**: indica se o usuário aceita que a
   IA utilize ferramentas MCP que também estejam autorizadas pelo backend.
3. **Usar modelo personalizado**: indica preferência por um modelo aprovado e
   disponível para aquele usuário. Não permite informar URL, credencial ou
   identificador arbitrário.

Desligar uma preferência do usuário nunca pode conceder capacidade. A política
global, as permissões do grupo e a disponibilidade do modelo sempre prevalecem.
Se o usuário escolher uma capacidade indisponível, o backend deve continuar
usando o caminho seguro padrão e informar o estado de fallback quando isso for
relevante.

## NCM como triagem global

NCM significa **Next-Concept Modeling**. No SILO, sua função planejada é ser
uma camada rápida de triagem e roteamento antes do LLM, não substituir o LLM.

```text
Mensagem
  -> NCM/classificador rápido
  -> decisão estruturada de rota
  -> resposta determinística, RAG, agente, MCP ou LLM
```

O classificador poderá identificar intenções como resposta simples, consulta
de conhecimento, consulta operacional, uso de agente, uso de MCP ou pergunta
fora do escopo. Ele deve produzir uma decisão estruturada e uma confiança; não
deve produzir a resposta final nem executar ações.

Regras de segurança do roteador:

- baixa confiança encaminha para o caminho seguro do LLM;
- a classificação não altera permissões;
- o LLM continua sendo responsável por síntese complexa e decisões que exigem
  raciocínio contextual;
- métricas de qualidade, latência e fallback devem ser coletadas antes de
  ampliar o uso;
- o modelo de triagem é uma configuração global do sistema, não uma escolha
  livre de cada usuário.

O NCM publicado pela HazyResearch é um framework de geração paralela, com
modelos e tarefas específicas. Portanto, para o SILO, será necessário validar
ou adaptar um modelo para as classes reais de triagem antes de considerá-lo
confiável em produção.

## MCP e modelos personalizados

MCP será tratado como uma capacidade externa governada pelo host do SILO. A
preferência do usuário apenas participa da decisão; ela não substitui:

- permissão do usuário ou grupo;
- lista de servidores e ferramentas aprovados;
- filtragem por contexto e recurso;
- confirmação para ações mutáveis;
- limites de tempo, chamadas e auditoria.

A descoberta de ferramentas deve ser progressiva quando houver muitos
servidores: localizar a capacidade relevante, carregar somente o esquema
necessário e executar pelo broker autorizado. Isso reduz contexto e evita
expor todas as ferramentas ao LLM em toda pergunta.

Modelos personalizados, incluindo fine-tuning, serão registrados pelo backend
com nome, capacidade, versão, estado e escopo permitido. A aplicação não deve
aceitar seleção arbitrária de modelos por entrada do usuário. O modelo padrão
continua sendo o fallback.

## Observabilidade e avaliação

O sistema deve acompanhar, sem registrar conteúdo sensível em labels:

- latência da triagem NCM;
- latência de recuperação e do LLM;
- rota escolhida e motivo de fallback;
- quantidade de chamadas de ferramentas;
- erros, timeouts e abstentions;
- qualidade da classificação em corpus versionado;
- presença e origem das citações.

Prompts, conteúdo integral de ferramentas, IDs de usuário e IDs de thread não
devem ser usados como labels de métricas.

## Configuração atual e configuração futura

Hoje, a execução da IA é configurada principalmente por ambiente, incluindo
modo do agente, limites de rodadas e chamadas, timeouts, URL do vLLM e modelo
de embeddings.

As preferências pessoais futuras serão dados de aplicação persistidos no
usuário. A separação é intencional:

- ambiente e política global controlam infraestrutura e limites;
- grupos e permissões controlam o que o usuário pode acessar;
- preferências pessoais controlam apenas escolhas permitidas dentro desses
  limites.

## Glossário

- **LLM:** modelo de linguagem usado para síntese, interpretação e raciocínio.
- **NCM:** Next-Concept Modeling; no SILO, classificador/roteador rápido
  planejado para triagem.
- **RAG:** recuperação de conhecimento antes da síntese da resposta.
- **MCP:** protocolo para conectar o host da IA a ferramentas e recursos
  externos de forma padronizada.
- **Embedding:** representação vetorial usada para busca semântica.
- **Agente:** fluxo controlado que decide e executa ferramentas permitidas.
- **Fallback:** caminho seguro usado quando um runtime, classificação ou
  síntese não é confiável.

## Referências

- `docs/ai-assistant.md`: contratos atuais do assistente, SSE, testes e
  diagnóstico.
- `docs/backend.md`: arquitetura do backend, vLLM, embeddings e limites.
- `docs/superpowers/specs/2026-10-23-general-procedures-design.md`:
  especificação dos procedimentos gerais.
- `docs/superpowers/plans/2026-10-23-general-procedures.md`: plano e critérios
  de verificação dos procedimentos gerais.
- `apps/backend/src/silo/ai/`: implementação da IA.
- [NCM da HazyResearch](https://github.com/HazyResearch/ncm): referência
  externa do Next-Concept Modeling.
