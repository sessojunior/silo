# Plano determinístico de migração do backend Node.js para Python/FastAPI e LangGraph

> Estado: **FASE 0 CONCLUÍDA; FASE 1 AINDA NÃO INICIADA**  
> Repositório: `D:\Projects\silo\silo-sessojunior`  
> Data do levantamento: `2026-07-20`  
> Escopo: API, regras de backend, acesso ao banco, integrações, assistente com LangGraph/tools e worker Kafka  
> Fora do escopo: reescrever o frontend Next.js em Python ou redesenhar regras de negócio

## 0. Regra de execução deste documento

Este arquivo é a fonte única de verdade da migração. Quem executar a migração deve obedecer às regras abaixo.

1. Ler este arquivo inteiro antes de alterar qualquer código.
2. Executar as fases estritamente na ordem numérica. Não iniciar uma fase enquanto o gate da fase anterior não estiver integralmente aprovado.
3. Não “melhorar”, renomear, simplificar ou reinterpretar contratos durante a migração. Primeiro obter paridade; melhorias funcionais ficam para depois do encerramento da janela de rollback.
4. Não apagar, sobrescrever, fazer checkout, reset ou formatar mudanças preexistentes do usuário. No levantamento de 2026-07-20 existem alterações não commitadas em:
   - `apps/api/src/scripts/backfill-embeddings.ts`
   - `apps/api/src/services/embedding-write-service.ts`
5. Se o estado do repositório tiver mudado desde este levantamento, registrar o desvio no diário da migração e atualizar os testes de caracterização antes de continuar. Não atualizar silenciosamente este plano para encaixar uma implementação divergente.
6. Cada fase termina com evidências salvas em `docs/migration/evidence/phase-XX/` e com o respectivo checklist marcado neste arquivo.
7. Qualquer comando que falhar interrompe a fase. Corrigir a causa, repetir o comando completo e salvar a saída bem-sucedida. Não usar `|| true`, `--force`, exclusões de teste ou redução de cobertura para ultrapassar gates.
8. Migração de banco, troca de tráfego e troca do worker exigem backup restaurável e plano de rollback testado. Sem isso, a execução para.
9. API Node e API Python podem coexistir para comparação. Worker Node e worker Python **nunca** podem consumir simultaneamente o mesmo grupo/tópicos de produção.
10. Durante a janela de rollback, toda alteração de banco deve ser aditiva e compatível com Node e Python. Não remover nem renomear tabela, coluna, índice, constraint ou extensão.
11. A aplicação não deve executar DDL ao iniciar. Alembic será o único proprietário de migrations depois do baseline.
12. O executor deve trabalhar em mudanças pequenas e revisáveis. Um commit por fase ou slice descrito neste documento; não misturar fases.
13. Ao concluir uma fase, registrar: SHA do commit, comandos executados, resultados, decisões já fixadas neste plano, desvios encontrados e rollback testado.
14. Se surgir uma decisão não prevista que altere contrato público, dados, segurança ou topologia, parar e pedir autorização. Para detalhes meramente internos, escolher a opção que preserve exatamente o comportamento caracterizado.
15. As correções de cache cross-user, SSE terminal/persistência e exposição de reasoning descritas na Fase 0 são exceções de segurança/funcionamento já determinadas por este plano. Elas devem ocorrer antes dos goldens e passam a ser o baseline; não preservar os defeitos em nome de paridade.

### Estados permitidos para checklists

- `[ ]` pendente
- `[x]` concluído com evidência
- `[!]` bloqueado; deve conter motivo e referência à evidência

### Definição global de pronto

A migração só estará concluída quando, simultaneamente:

- o frontend continuar sendo compilado e testado sem depender de runtime Node na API ou worker;
- todos os endpoints HTTP, cookies, WebSocket e SSE usados pelo frontend tiverem paridade comprovada;
- o schema real do PostgreSQL estiver representado por SQLAlchemy/Alembic e reproduzível do zero;
- API e worker estiverem sendo executados exclusivamente por Python em produção;
- o worker mantiver idempotência, DLQ, retries e continuidade de offsets;
- uploads, PDFs, SMTP, Google OAuth, LangGraph, tools, Ollama, pgvector e Kafka REST Proxy estiverem validados;
- o rollback tiver sido ensaiado antes do cutover e não tiver sido necessário durante a observação;
- a janela de observação de 14 dias tiver terminado sem incidente de severidade alta;
- o código Node exclusivo de API/worker/banco tiver sido removido, mantendo apenas o Node necessário ao Next.js;
- documentação, CI, Docker, scripts e exemplos de ambiente refletirem a arquitetura Python.

---

## 1. Estado atual comprovado do repositório

### 1.1 Componentes atuais

| Componente | Tecnologia atual | Responsabilidade | Destino |
|---|---|---|---|
| `apps/web` | Next.js 16, React 19, TypeScript | UI, proxy same-origin, route de uploads, guardas de página | Permanece em Node/TypeScript |
| `apps/api` | Express 5, TypeScript | REST, auth, WebSocket, SSE, uploads, PDFs, SMTP, Ollama, regras de negócio | Substituído por FastAPI |
| `apps/worker` | Node/TypeScript | Consumer Kafka via REST Proxy, retries, DLQ, deduplicação | Substituído por worker Python |
| `packages/db` | Drizzle ORM + `pg` | Schema, queries, migrations, seed | Substituído por SQLAlchemy + Alembic |
| `packages/engine` | TypeScript/Zod | DTOs, validações, config, regras, Kafka/dataflow e utilitários de UI | Dividido: regras de servidor migram; tipos/UI necessários ao web permanecem |
| PostgreSQL | PostgreSQL 17 + pgvector | Dados, sessão, rate limit, vetores | Mantido sem migração de dados para outro SGBD |
| Ollama | HTTP | runtime local de chat e embeddings | Mantido como provedor inicial; acesso de negócio passa por adaptadores LangGraph/LangChain |
| Assistente IA | pipeline TypeScript determinístico + chamadas Ollama diretas | classificação, relatórios, RAG, cache, threads e SSE | Migrado para grafo híbrido LangGraph com tools tipadas e fallback determinístico |
| Kafka | Confluent-compatible REST Proxy JSON v2 | eventos de modelo/monitoramento/dataflow | Mantido, com cliente Python |

O código levantado contém aproximadamente 18.008 linhas em `apps/api/src`, 481 em `apps/worker/src`, 10.870 em `packages/db/src` e 4.346 em `packages/engine/src`. A migração deve ser feita por slices, nunca por uma tradução massiva única.

### 1.2 Topologia pública atual que deve ser preservada

```text
Browser
  -> Next.js em <origem><NEXT_PUBLIC_BASE_PATH>
     -> /api/admin/* é validado superficialmente pelo proxy e reescrito para /api/*
     -> /api/* é reescrito para API_URL
     -> /uploads/:type/:filename é servido por route handler do web, que chama a API
  -> WebSocket direto em NEXT_PUBLIC_API_ORIGIN/api/chat/ws

API Node :4000
  -> PostgreSQL
  -> Ollama
  -> SMTP
  -> Kafka REST Proxy
  -> volume /app/uploads

Worker Node
  -> Kafka REST Proxy
  -> PostgreSQL
  -> Ollama somente no boot, embora nenhum processor Kafka use IA
```

Compatibilidades obrigatórias:

- porta interna da API: `4000` após o cutover;
- health atual: `GET /health`;
- base interna da API: `/api`;
- prefixo público administrativo: `<BASE_PATH>/api/admin`, removido pelo proxy web;
- WebSocket: `/api/chat/ws`;
- uploads persistidos em `/app/uploads` e URLs públicas `/uploads/<kind>/<filename>`;
- timezone operacional: `America/Sao_Paulo`;
- CORS com credenciais e origens explícitas.

### 1.3 Superfícies de maior risco

1. **Autenticação:** Better Auth grava `user`, `session`, `account` e `verification`, assina `better-auth.session_token`, usa cache em cookie, Google OAuth, senha bcrypt e OTP por e-mail.
2. **Banco:** o entrypoint atual remove `__drizzle_migrations` e executa `drizzle-kit push`. Portanto, os arquivos SQL e o journal não são prova suficiente do schema de produção.
3. **pgvector/RAG:** existem `vector(768)`, HNSW, `pg_trgm`, chunks de manual e SQL manual para similaridade.
4. **Realtime:** chat usa WebSocket bruto, heartbeat ping/pong de 30 s, presença e broadcast em memória.
5. **Streaming:** assistente usa SSE por `POST`, heartbeat a cada 5 s e eventos ordenados.
6. **Worker:** offset manual, deduplicação transacional, retry exponencial, DLQ e dispatcher por prefixo de tópico.
7. **Arquivos:** upload multipart de até 4 MiB, validação real de imagem, rotação EXIF, conversão WebP, resize e volume compartilhado.
8. **PDF:** layout A4 feito com PDFKit e gravado no volume, com quatro tipos de relatório.
9. **Proxy/basePath:** o browser chama majoritariamente `/api/admin/*`, mas a API recebe `/api/*`; SSR chama a API interna diretamente.
10. **Documentação divergente:** `docs/06-api.md` contém rotas e métodos legados que não coincidem integralmente com o código atual.
11. **Orquestração de IA:** `ai-assistant-service.ts` concentra classificação, consultas, montagem de resposta e efeitos; introduzir um loop de agente sem limites pode ampliar acesso, latência e comportamento não determinístico.
12. **Cache semântico:** o comentário diz que o cache é isolado por usuário, porém `findCachedAssistantResponse(question)` não recebe usuário e a SQL não faz join/filtro por `ai_assistant_thread.user_id`. Isso é risco real de vazamento entre usuários e não será copiado.
13. **SSE incompatível:** a rota já emite `connected` e o serviço emite outro; cache usa `data`/`complete`, mas o frontend só finaliza ao receber `result`. O caminho cacheado pode terminar como erro visual mesmo após persistir resposta.
14. **Geração duplicada:** no SSE ao vivo, `generateAssistantMessage()` já chama Ollama no refinamento não-streaming e depois `composeAssistantAnswerWithOllamaStream()` chama o modelo novamente. Isso dobra custo/latência e pode produzir duas respostas divergentes.
15. **Raciocínio exposto:** o prompt exige `thinking` com raciocínio completo, o SSE o transmite incrementalmente e os metadados o persistem. O destino deve emitir apenas progresso operacional sanitizado, nunca cadeia de pensamento privada.
16. **SQL vetorial manual:** cache e RAG usam diversos `sql.raw(...)` para vetor, datas, texto, limites e IDs. Mesmo onde há escape manual, o porte deve usar bind parameters e validação de dimensão/valores finitos.
17. **Modelo pequeno:** o Compose fixa por padrão `qwen2.5:1.5b-instruct-q4_K_M`, enquanto a config em código tem default de 3B. O cliente atual descobre/finge até 131.072 tokens, mas limita `num_ctx` efetivamente a 16.384, `num_predict` a 512 e carrega até 25 mensagens. A capacidade real do modelo implantado para tools/JSON/streaming e o orçamento de prompt precisam ser medidos; não se pode inferir pela família do modelo.
18. **Semântica divergente de execução/incidente:** uma rodada de modelo é registrada em `product_activity` por produto, data e turno. O domínio central considera incidentes `under_support|suspended|not_run|with_problems|run_again`; `report-service.ts` e `dashboard-service.ts` também incluem `pending`; o comentário do schema ainda menciona `off`, ausente do union `ProductStatus`. Nenhuma tool pode responder “rodou”, “falhou” ou “teve incidente” usando agrupamentos implícitos antes de uma matriz canônica ser aprovada.
19. **Duas fontes diferentes de problema:** uma rodada problemática é uma linha de `product_activity` com status/categoria/intervenção; um problema formal é uma linha de `product_problem`, possivelmente ligada a `product_solution`. Somar ou apresentar essas fontes como se fossem o mesmo evento duplica ou distorce ocorrências. As tools e citações devem nomear explicitamente a fonte.
20. **Métricas não confiáveis no relatório atual:** `getProblemsReport()` devolve `resolvedCount=Math.floor(count*0.8)` e `resolutionRate=80` sem consultar resolução real, escolhe os cinco problemas antes de uma ordenação estável e `getExecutiveReport()` aceita `groupId` sem aplicá-lo às consultas. Esses campos não podem ser expostos pelo novo agente como verdade; devem ser corrigidos a partir de regra aprovada ou omitidos com `unsupportedMetrics`.
21. **Artefatos já existentes, mas acoplados:** o frontend já valida/renderiza `chart` (`bar|line|donut`), `image` e `mermaid`; o backend monta cards SVG determinísticos e PDFs A4 de `availability|problems|executive|projects`. A migração deve reaproveitar esses contratos. “Imagem” nesta entrega significa visualização determinística baseada em dados; geração criativa por modelo de imagem não será introduzida silenciosamente.
22. **PDF disfarçado de imagem:** o fluxo atual coloca URL `.pdf` em `visualization.kind="image"`; em falha chega a construir `src=""`, inválido pelo próprio schema `min(1)`. Além disso, o DTO aceita só uma visualização, então não representa corretamente “gráfico e PDF” na mesma resposta. O contrato deve ganhar `artifacts[]` opcional de modo aditivo, preservando `visualization` durante rollback.
23. **Coleta excessiva para PDF:** o scope atual `generate_pdf` executa em paralelo os quatro relatórios e descarta três, independentemente do tipo pedido. Isso amplia carga, latência e superfície de dados. O plano novo resolve primeiro o tipo e executa somente o dataset exigido; combinações só ocorrem quando solicitadas explicitamente.
24. **Contexto/memória do agente:** 25 mensagens de até 4.000 caracteres, RAG, tool results e schemas podem ultrapassar a janela efetiva de 16K ou pressionar RAM antes do Ollama recusar. Resultados completos ficam no DatasetRegistry com teto de bytes; o modelo recebe apenas projeção compacta e a montagem do prompt falha para grounded fallback antes de exceder o orçamento.
25. **Mermaid inseguro no frontend atual:** `assistant-mermaid.tsx` inicializa Mermaid com `securityLevel:"loose"` e interpola `visualization.diagram` em `innerHTML`. Mesmo com builders atuais, histórico/dado hostil transforma isso em superfície XSS. O baseline seguro deve usar `securityLevel:"strict"`, inserir a definição como `textContent`/DOM criado e aceitar no backend apenas templates sem directives/links.
26. **Validação permissiva de mídia:** `isSafeImageSource()` aceita qualquer `data:image/*` e qualquer string iniciada por `/`, inclusive URL protocol-relative `//host`. PDF ainda abre a URL em iframe. Frontend e backend devem allowlistar esquema, MIME, tamanho e prefixos locais depois de normalização/decodificação; CSP é defesa adicional, não o único controle.

### 1.4 Linha de base em 2026-07-20

| Verificação | Resultado observado | Tratamento obrigatório |
|---|---:|---|
| `npm run test:web` | 18 arquivos, 31/31 testes aprovados | Não pode regredir |
| `npm run test:api` | 6 arquivos, 38/40 aprovados | Corrigir 2 expectativas antigas de `priority` antes de capturar o baseline |
| `npm run typecheck:api` | aprovado | Não pode regredir enquanto o legado existir |
| `npm run typecheck:worker` | aprovado | Não pode regredir enquanto o legado existir |
| testes do worker | inexistentes | Criar caracterização antes da porta Python |
| Python local | 3.14.3 | Não depender do Python global; usar versão fixada |
| `uv` local | ausente | Instalar versão fixada na fase 2 |

As duas falhas atuais ficam em `apps/api/src/routes/projects.test.ts`: os mocks de criar/atualizar tarefa não esperam o campo `priority`. O código e o frontend já o enviam. A correção do teste é pré-condição, não mudança de negócio.

### 1.5 Fluxo atual do assistente e implicações para LangGraph

O fluxo observado é um **workflow determinístico com refinamento por LLM**, não um agente com tools:

```text
POST mensagem
  -> valida sessão + reports:view
  -> tenta cache semântico
  -> carrega até 25 mensagens + contextSummary + último scope
  -> classifica scope: keywords -> embedding -> Ollama apenas se ambíguo
  -> calcula período e intenção de visualização
  -> consulta RAG em problemas, soluções, chunks de manual e help
  -> executa conjunto fixo de report/dashboard services conforme o scope
  -> constrói resposta-base, citações e visualização deterministicamente
  -> Ollama reescreve em JSON
  -> persiste thread/mensagens/metadata e agenda embedding da resposta
  -> no SSE atual, repete o refinamento em uma segunda chamada Ollama
```

Conclusões vinculantes desta análise:

1. LangGraph **não substitui Ollama**. LangGraph orquestra estado, nós, edges, tools, limites e fallback; Ollama continua sendo o runtime local inicial do modelo e dos embeddings.
2. Serviços de negócio não chamarão Ollama diretamente. Chat usa `ChatOllama` atrás de um `ModelRuntime`; embeddings usam `OllamaEmbeddings` atrás de um `EmbeddingProvider`; somente esses adaptadores e o probe técnico conhecem URLs Ollama.
3. O RAG PostgreSQL existente será preservado. Não trocar pgvector/pg_trgm por vector store genérico durante a migração, pois isso alteraria ranking, filtros, índices e observabilidade.
4. Os report/dashboard services atuais tornam-se tools de aplicação tipadas. Tools chamam serviços/repositórios autorizados; nunca recebem SQL livre, URL arbitrária, path de arquivo ou nome de função fornecido pelo usuário.
5. O primeiro grafo será híbrido: roteamento e consultas mínimas obrigatórias continuam determinísticos; o modelo só poderá escolher tools suplementares read-only depois de passar avaliação própria.
6. O histórico canônico continua em `ai_assistant_thread`/`ai_assistant_message`. No cutover, o grafo será request-scoped e compilado sem checkpointer persistente para evitar duas fontes de verdade, tabelas automáticas e estados incompatíveis com rollback.
7. `generate_pdf` é o único efeito acionável já presente no assistente. Na primeira versão ele será um nó determinístico, executado somente com pedido explícito do usuário, no máximo uma vez e com chave de idempotência; não será oferecido ao loop de tools do modelo.
8. O worker Kafka não receberá LangGraph nem cliente Ollama. A inicialização/pull de modelos sai do worker e passa para um job one-shot de infraestrutura; indisponibilidade de IA não pode bloquear consumo Kafka.
9. A resposta pública continuará usando os endpoints e DTOs atuais, com uma única extensão aditiva opcional `artifacts[]` para deixar de disfarçar PDF como imagem e permitir visualização+PDF. `provider` continuará representando o runtime (`ollama`) para não quebrar `AiAssistantRuntimeStatusSchema`; `orchestrator=langgraph`, versão do grafo e trajetória de tools ficam em métricas/metadados internos.
10. “Thinking” público passa a significar apenas mensagens estáticas de progresso como “Consultando relatórios autorizados”. Não solicitar, transmitir, persistir ou logar raciocínio privado do modelo.
11. Tools de execução serão pequenas e específicas: resolver modelos, listar rodadas, resumir, comparar períodos, obter histórico e intervenções. Elas consultarão `product`/`product_activity`/`product_activity_history`; não usarão o relatório executivo como atalho opaco.
12. Tools de problema separarão `problematic_run` de `registered_problem`. Toda métrica, citação, gráfico, imagem e PDF carregará `sourceKind`, período, filtros, `asOf` e checksum do dataset que a originou.
13. Gráficos, imagens-resumo, Mermaid e PDFs serão etapas do orquestrador depois da coleta/análise. O modelo não poderá fornecer séries numéricas livres, código Mermaid livre, path ou nome de arquivo; ele apenas poderá propor uma apresentação allowlisted sobre um `datasetId` criado pelo servidor na execução atual.
14. O catálogo completo poderá conter várias tools, mas cada execução e cada chamada `bind_tools` verá apenas o subconjunto mínimo do scope/plano. Isso reduz confusão do modelo pequeno sem sacrificar as capacidades determinísticas do orquestrador.

---

## 2. Arquitetura-alvo já decidida

### 2.1 Decisões vinculantes

1. Criar um único projeto Python em `backend/`, compartilhado por API e worker. Isso evita duplicar modelos, config, regras e cliente Kafka.
2. Usar Python `3.13.14`, fixado em `.python-version`, `requires-python` e imagem Docker `python:3.13.14-slim-bookworm`. A versão local 3.14.3 não será usada: no cutoff, `langgraph==1.2.9` declara/classifica suporte até Python 3.13, enquanto 3.13.14 é uma manutenção estável. Reavaliar 3.14 somente em PR posterior com matriz completa.
3. Usar `uv` `0.11.28` para ambiente e lockfile. `backend/uv.lock` será versionado e CI/Docker usarão `--locked`/`--frozen`.
4. Usar FastAPI/ASGI com Uvicorn, Pydantic v2, SQLAlchemy 2 async e Psycopg 3.
5. Usar uma única instância/processo Uvicorn no primeiro cutover. O hub WebSocket é em memória; múltiplos processos só serão permitidos após introduzir broadcast compartilhado e testes próprios.
6. O PostgreSQL existente continua sendo a fonte de dados. Não haverá cópia permanente para banco paralelo nem conversão de IDs.
7. Alembic será a única ferramenta de DDL após a fase de baseline. API e worker apenas verificam o revision head no startup/readiness.
8. O frontend continuará usando as URLs e shapes atuais. Não será feita adoção ampla de um novo cliente HTTP durante a migração.
9. Os DTOs TypeScript ainda consumidos pelo web permanecem em `packages/engine` durante o cutover. As regras server-only são portadas para Python; remoção de exports ocorre apenas na fase final.
10. Autenticação Python substituirá Better Auth. Usuários, contas Google e hashes bcrypt serão preservados, mas haverá **reset controlado de sessão no cutover**. Usuários precisarão autenticar novamente uma única vez.
11. O novo cookie será `silo_session`. Durante os 14 dias de rollback, o proxy do web reconhecerá tanto `silo_session` quanto os nomes legado `better-auth.session_token`/`__Secure-better-auth.session_token`.
12. Pendências OTP em `verification` não atravessarão o cutover. O cutover só ocorrerá fora de um fluxo OTP ativo; códigos anteriores serão inválidos e poderão ser reenviados.
13. O worker Python usará o mesmo `KAFKA_GROUP_ID` somente no momento do cutover, após encerramento confirmado do worker Node.
14. A migração preservará o envelope heterogêneo atual quando caracterizado: a maioria das rotas usa `{success,data,message,error,field}`, mas `GET /api/auth/get-session`, binários e alguns legados têm formato próprio.
15. FastAPI não retornará seu erro padrão 422 para contratos existentes. Erros de validação serão traduzidos para o status/body legado caracterizado, normalmente 400.
16. Não aceitar redirect automático de barra final como substituto de endpoint. Rotas de coleção serão declaradas com path vazio quando a chamada existente não inclui `/` final.
17. Todas as queries com vetores e SQL manual serão parametrizadas; não portar interpolação de strings do legado.
18. Uploads de imagem continuarão sendo WebP; imagens-resumo do assistente preservam o SVG data URI sanitizado já suportado pelo DTO. PDFs continuarão sendo arquivos no volume, nunca blobs no PostgreSQL.
19. Usar `langgraph==1.2.9` pela Graph API de baixo nível; não usar `create_agent` como caixa-preta. O grafo explícito é necessário para preservar o roteamento determinístico, controlar tools, traduzir SSE e testar cada nó/edge.
20. Usar `langchain-core==1.4.9` apenas para mensagens/tools/interfaces e `langchain-ollama==1.1.0` para `ChatOllama`/`OllamaEmbeddings`. Não adicionar o pacote amplo `langchain` enquanto nenhum import direto o exigir.
21. Compilar o grafo uma vez no lifespan da API, sem checkpointer em produção nesta migração. Testes podem usar `InMemorySaver`; `langgraph-checkpoint-postgres` não entra no lock nem cria tabelas.
22. O modo inicial obrigatório é `deterministic`: LangGraph executa tools escolhidas por edges do servidor e usa uma única chamada de síntese. `hybrid` habilita seleção suplementar pelo modelo somente após o gate de trajetória; nunca há modo totalmente autônomo.
23. Tools read-only ficam em allowlist fixa e recebem identidade/permissões apenas pelo runtime context do servidor. Nenhuma identidade, permissão ou nome de tool vindo do prompt é confiável.
24. Limites iniciais vinculantes por execução: até 8 tools obrigatórias escolhidas pelo orquestrador **incluindo apresentações/PDF**, 2 rodadas agentic e 4 tool calls suplementares, no máximo 12 tools totais, 3 chamadas de modelo totais, `recursion_limit=24`, 20 s por tool, 90 s total, no máximo 2 tools DB paralelas e sem retry automático de chamada LLM. O caminho comum deve usar 1–4 tools. Alterar exige evidência de carga/eval e atualização deste plano.
25. O cache semântico será restrito ao usuário e a thread vazia, e versionado por grafo, prompt, catálogo de tools, modelo e embedding model. Cache antigo não versionado nunca será servido pelo Python.
26. OLLAMA permanece provedor inicial, não dependência de domínio. O modelo de chat pode continuar o atual somente se passar os gates; se falhar tool calling, produção permanece em grafo `deterministic` sem trocar modelo silenciosamente.
27. LangSmith/tracing externo fica desabilitado. Habilitá-lo exigiria aprovação, contrato de tratamento de dados e redaction comprovada; a migração usa logs/métricas locais sem prompts, mensagens ou resultados brutos.
28. Criar um `DatasetRegistry` request-scoped, sem persistência e fora do prompt, para ligar coleta, análise e artefatos. Cada entrada recebe ID opaco imprevisível, schema, origem, filtros normalizados, `asOf`, contagem, truncamento e SHA-256 do conteúdo canônico. Uma tool de apresentação só aceita IDs criados no mesmo graph run.
29. O orquestrador sempre materializa e valida um `ExecutionPlan` antes de executar tools. Em modo `deterministic`, o plano vem de regras; em `hybrid`, o modelo pode sugerir passos suplementares, mas o servidor resolve dependências, remove duplicatas, impõe allowlist/orçamento e nunca permite que o modelo retire uma fonte obrigatória.
30. Solicitações de visualização ignoram o cache semântico de resposta e regeneram o artefato a partir de um snapshot atual. Uma resposta textual cacheada nunca será convertida em gráfico/PDF sem reconsultar e validar o dataset.
31. PDF continua sendo efeito explícito e idempotente fora de `bind_tools`. Chart DTO, card SVG e Mermaid são transformações puras read-only; podem ser selecionados pelo plano validado quando o usuário pedir apresentação visual, mas não recebem dados arbitrários do LLM.
32. Adicionar ao DTO público `artifacts?: [{kind:"pdf",url,filename,title,mimeType:"application/pdf"}]`, no máximo um PDF nesta migração. `visualization` continua sendo zero ou um chart/image/Mermaid. Em pedido apenas de PDF, Python pode preencher também a representação legada `visualization.image` durante a janela de rollback; em pedido combinado, `visualization` contém o gráfico/imagem/Mermaid e `artifacts` contém o PDF. O web deve ser lançado primeiro e tolerar ausência do novo campo no Node.
33. Criar a tabela aditiva `ai_assistant_artifact` para idempotência e reconciliação de PDF, sem armazenar conteúdo/dataset: UUID, user/thread/message opcionais, kind/reportType, hash de idempotência unique, `requestFingerprint`, dataset checksum, metricVersion, status `pending|ready|failed`, owner/lease, path relativo, URL, filename, MIME, byte size, SHA-256, erro sanitizado, `attachedAt` e timestamps. Dataset checksum pode ser nulo apenas enquanto pending/failed e é obrigatório em ready. FKs de thread/message usam `ON DELETE SET NULL`; o reconciler remove ready órfão somente após a janela definida. O Node ignora a tabela. Estado pendente vencido é recuperável; arquivo e registro nunca são assumidos consistentes sem checksum.
34. O web gera um UUID `X-Idempotency-Key` por envio e o reutiliza em retry do mesmo POST sync/SSE. Para plano com PDF, a API calcula o hash estável server-side de `userId+header+operation`, e um fingerprint separado da mensagem normalizada/reportType/metricVersion; o dataset checksum é preenchido depois e não altera a identidade do retry. Reuso da mesma chave com fingerprint diferente retorna `IDEMPOTENCY_KEY_REUSE`. Header bruto não é persistido/logado e nunca vem do prompt/tool. O Node pode ignorá-lo. Assim, retry após mudança nos dados ainda devolve o artefato original daquela mensagem, sem deduplicar envios intencionais com chave nova.
35. Fixar inicialmente `num_ctx=16384`, resposta de até 768 tokens e prompt montado de no máximo 12.000 bytes UTF-8 — limite conservador porque não há tokenizer local confiável e cada byte pode virar token. Política/schema e pergunta integral são obrigatórias; do espaço restante, reservar 65% ao grounding obrigatório, 25% ao histórico recente compactado e 10% ao RAG opcional. Cortar primeiro RAG de menor score, depois mensagens antigas e detalhes opcionais; nunca truncar pergunta, política ou número/citação obrigatórios. Se política+pergunta ou grounding mínimo não couberem, não chamar o modelo e entregar grounded fallback. Alteração exige tokenizer/probe e load eval com digest do modelo.

### 2.2 Estrutura final

```text
backend/
  .python-version
  pyproject.toml
  uv.lock
  alembic.ini
  README.md
  Dockerfile
  migrations/
    env.py
    script.py.mako
    versions/
  src/silo/
    __init__.py
    config.py
    logging.py
    clock.py
    api/
      main.py
      lifespan.py
      errors.py
      middleware.py
      dependencies.py
      routers/
        auth.py
        users.py
        groups.py
        contacts.py
        products.py
        projects.py
        tasks.py
        incidents.py
        help.py
        dashboard.py
        reports.py
        monitoring.py
        product_flow.py
        chat.py
        ai_assistant.py
        uploads.py
        server_time.py
      schemas/
    auth/
      service.py
      sessions.py
      passwords.py
      otp.py
      oauth.py
      permissions.py
    db/
      base.py
      engine.py
      models.py
      types.py
      health.py
    domain/
      scheduling/
      dataflow/
      product_status.py
      product_activity_email.py
    services/
    ai/
      graph.py
      state.py
      context.py
      routing.py
      prompts.py
      output.py
      progress.py
      policies.py
      plan.py
      datasets.py
      status_semantics.py
      tools/
        registry.py
        models.py
        model_runs.py
        problems.py
        projects.py
        reports.py
        knowledge.py
        charts.py
        diagrams.py
        images.py
        pdf.py
      nodes/
        guard.py
        cache.py
        classify.py
        plan.py
        resolve.py
        retrieve.py
        analyze.py
        agent.py
        present.py
        synthesize.py
        validate.py
        persist.py
        fallback.py
    integrations/
      kafka_rest.py
      ai_runtime.py
      ollama_runtime.py
      embedding_provider.py
      smtp.py
      uploads.py
      pdf.py
    realtime/
      chat_hub.py
    worker/
      main.py
      consumer.py
      processor.py
      handlers/
        model.py
        monitoring.py
  tests/
    unit/
    contract/
    integration/
    worker/
    e2e/
    fixtures/
```

Não criar microserviços ou pacotes Python adicionais durante esta migração.

### 2.3 Dependências diretas iniciais

Fixar as versões diretas abaixo no `pyproject.toml`; o `uv.lock` fixa todas as transitivas:

| Uso | Dependência |
|---|---|
| API/ASGI | `fastapi==0.139.2`, `uvicorn[standard]==0.51.0` |
| modelos/config | `pydantic==2.13.4`, `pydantic-settings==2.14.2` |
| banco | `sqlalchemy[asyncio]==2.0.51`, `alembic==1.18.5`, `psycopg[binary,pool]==3.3.4`, `pgvector==0.5.0` |
| HTTP externo | `httpx==0.28.1` |
| grafo/agentes | `langgraph==1.2.9`, `langchain-core==1.4.9`, `langchain-ollama==1.1.0` |
| multipart/imagem | `python-multipart==0.0.32`, `pillow==12.3.0` |
| auth | `authlib==1.7.2`, `bcrypt==5.0.0` |
| e-mail | `aiosmtplib==5.1.2` |
| PDF | `reportlab==5.0.0` |
| qualidade | `pytest==9.1.1`, `ruff==0.15.22`; adicionar `pytest-asyncio`, `pytest-cov`, `respx`, `mypy` e `testcontainers` com `uv add --dev --bounds exact` sob o cutoff fixo da fase 2 |

Não atualizar nenhuma versão durante a migração sem PR exclusivo, changelog revisado e execução integral dos gates.

### 2.4 Topologia de coexistência

Durante desenvolvimento e staging:

```text
api-node   :4000  <- baseline/golden
api-python :4001  <- candidato
web                 seleciona origem apenas por configuração de ambiente
db-test-node         banco clonado A
db-test-python       banco clonado B
fake-kafka-rest      servidor determinístico para testes
fake-ollama          servidor determinístico para testes
model-eval-ollama    Ollama real isolado, com modelo e digest registrados
fake-smtp            caixa de captura de testes
```

Não duplicar writes contra o mesmo banco por shadow traffic. Comparações mutáveis usam bancos clonados. Tráfego de produção só pode ser espelhado para Python em rotas GET comprovadamente sem side effects e com cookies/segredos removidos dos logs.

---

## 3. Invariantes de compatibilidade

### 3.1 HTTP e JSON

- Preservar método, path, nomes de query/path/body, tratamento de DELETE com body, status HTTP, envelope, mensagens relevantes ao frontend e headers observáveis.
- Preservar camelCase nos DTOs, mesmo que os modelos e colunas Python usem snake_case.
- Preservar diferença entre campo ausente e `null`. Usar `response_model_exclude_unset` apenas quando o golden exigir omissão.
- Preservar ordenação de listas quando a UI depende dela.
- Datas devem seguir exatamente os goldens, inclusive `Z`, offset, milissegundos e comportamento de `timestamp without time zone`.
- Não converter automaticamente todos os `201` em `200`, todos os erros em 422, ou todas as respostas para um envelope único.
- Limites de request, timeout, cache e content type devem ser explícitos.
- `X-Request-Id` deve ser aceito/gerado e devolvido, mas nunca mudar o body legado.
- CORS deve permitir somente origens configuradas, com credenciais, e nunca `*` com cookies.
- Headers de proxy só serão confiados quando o peer estiver em `TRUSTED_PROXY_CIDRS`.

### 3.2 Banco

- O schema real introspectado é a fonte de verdade para o baseline; `schema.ts`, SQLs e journal são apenas referências a reconciliar.
- Manter nomes físicos, tipos, defaults, nullability, FKs, `ON DELETE`, uniques e índices.
- Citar explicitamente tabelas reservadas `"user"` e `"group"` no SQL gerado.
- Manter `vector(768)`, operadores de cosseno, índices HNSW e índices GIN/trigram.
- Não usar `metadata.create_all()` em produção.
- Toda request recebe sua própria `AsyncSession`; não compartilhar sessão entre coroutines.
- Toda transação tem commit/rollback explícito e testes de concorrência quando há read-modify-write.
- Pool inicial: `pool_size=10`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=1800`; ajustar somente após carga medida.
- `statement_timeout` e `application_name` devem ser configuráveis; valor inicial de request: 30 s, relatórios/RAG: 60 s.

### 3.3 Autenticação e autorização

- Preservar domínios permitidos, usuário inativo, grupo admin, permissões `view/manage` e ações específicas de chat.
- `manage` continua implicando `view`; ações desconhecidas continuam canonicalizadas como `manage` durante a paridade.
- Sessão: 365 dias; atualização de atividade no máximo a cada 24 h, conforme comportamento atual.
- Cookie em produção: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; host-only por padrão. Atributos finais vêm do teste de caracterização do Better Auth.
- Token de sessão deve ter pelo menos 256 bits de entropia e comparação segura.
- Durante rollback, não converter hashes existentes. Python deve verificar bcrypt legado com custo 10.
- Como bcrypt só considera 72 bytes e `bcrypt` 5 rejeita entrada maior, a camada de compatibilidade deve truncar explicitamente os bytes UTF-8 nos primeiros 72 **somente ao verificar/gerar bcrypt legado**, com testes para ASCII, Unicode e senha >72 bytes.
- Após a janela de rollback, uma migração separada poderá rehashar em Argon2id no login. Isso não faz parte do cutover.
- OTP deve ser aleatório criptograficamente, armazenado como digest, expirar, ter uso único, contador de tentativas e cooldown equivalentes.
- Mutations autenticadas devem validar `Origin`/`Referer` contra origens confiáveis; webhooks por API key são tratados separadamente.
- Nunca logar senha, OTP, cookie, token de sessão, `Authorization`, credenciais SMTP/OAuth ou payload sensível.

### 3.4 Worker

- Preservar content types Confluent JSON v2.
- Resolver tópicos por `KAFKA_TOPIC`, argumento CLI ou `KAFKA_TOPICS`, na precedência atual.
- Manter sufixo do group id quando houver tópico único.
- Extrair message id nesta precedência: `message_id`, `messageId`, `id`, `source.messageId`.
- Payload inválido ou sem message id vai para DLQ; o próximo offset só é commitado depois de DLQ confirmada.
- Insert de `(topic,message_id)` deve decidir idempotência dentro da mesma transação do handler.
- Duplicata é sucesso e avança offset sem executar handler.
- Retry inicial: 3 tentativas, backoff 1 s, 2 s; valores continuam configuráveis.
- Após esgotar retry, publicar em `<KAFKA_DLQ_PREFIX><topic>` com message id como key. Se a publicação falhar, não commitar o offset.
- SIGINT/SIGTERM param novos polls, aguardam o registro em execução, deletam a instância REST e encerram o pool.
- Tópico desconhecido preserva o no-op atual e é marcado como processado; qualquer mudança será posterior à migração.

### 3.5 Realtime, SSE e arquivos

- WebSocket autentica pelo mesmo cookie da API, fecha com policy violation quando sem permissão e envia `chat.connected` imediatamente.
- Manter tipos: `chat.message.created`, `chat.message.read`, `chat.messages.read`, `chat.message.deleted`, `chat.presence.updated`, `chat.connected`.
- Manter ping/pong e desconexão de socket morto; múltiplas abas do mesmo usuário só marcam offline na última desconexão.
- SSE deve manter `text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no` e comentários heartbeat. Após a correção da Fase 0, Python emite `connected`, `scope?`, `thinking*` sanitizado e exatamente um `result|error`; o frontend aceita temporariamente `data/complete` apenas para rollback Node.
- Detectar disconnect/cancelamento do cliente e cancelar graph/model/tools/DB que ainda não devam persistir.
- Uploads permitidos: `general`, `avatars`, `contacts`, `incidents`, `problems`, `solutions`, `manual`, `help`, `projects`, `reports`.
- Aliases: `avatar->avatars`, `contact->contacts`, `problem->problems`, `solution->solutions`.
- Imagens aceitas: JPEG, PNG, WebP e GIF como entrada; saída WebP, EXIF rotacionado.
- Avatar/contato: 200x200 cover, qualidade 85. Outros: até 1200x1200 inside, sem ampliar, qualidade 85.
- Tamanho máximo: 4 MiB. O limite deve ser aplicado durante streaming, não após carregar conteúdo arbitrário.
- Nome deve preservar formato caracterizado: epoch-ms, basename sanitizado até 40 caracteres, 12 hex aleatórios, `.webp`.
- Bloquear `..`, `/`, `\`, symlink escape e path fora de `UPLOADS_DIR`.

### 3.6 LangGraph, modelo e tools

- Neste catálogo, **modelo/rodada** significa o modelo operacional cadastrado em `product` e sua execução em `product_activity`, que é o significado usado pelo dashboard/assistente atual. O modelo de linguagem Ollama é chamado de **chat model/runtime** e aparece apenas em `generation`, status e observabilidade técnica. Não expor logs internos do Ollama por `reports:view`; uma futura tool diagnóstica exigiria permissão administrativa e threat model próprios.
- O grafo recebe um `AgentState` serializável. Segredos, `AsyncSession`, clientes HTTP e objetos de usuário não entram no state; ficam no runtime context server-side.
- O runtime context contém `userId`, snapshot imutável de permissões, `requestId`, clock, session factory e portas de integração. O usuário não pode sobrescrever nenhuma dessas propriedades pelo body, histórico ou tool arguments.
- Cada tool usa schema Pydantic com `extra="forbid"`, limites inferiores/superiores, enums e datas normalizadas. Argumento inválido não chega ao repository.
- Cada capacidade tem um application use case Python sem dependência de LangChain e um adapter fino `@tool`/registry que aplica o mesmo schema/context. Nós determinísticos invocam o registry, não o repository diretamente; `bind_tools` usa os mesmos adapters. Assim, modo deterministic e hybrid não desenvolvem regras ou resultados diferentes.
- Cada tool revalida autorização. O guard da rota não substitui autorização dentro da tool; isso previne execução indevida por chamada direta em teste, refactor ou futuro subgrafo.
- Tools DB paralelas abrem sessões próprias. Nunca compartilhar uma `AsyncSession` entre nós/tasks concorrentes.
- Antes do catálogo, criar `model-run-status-semantics.yaml` versionado. Para cada status observado (`completed`, `with_problems`, `run_again`, `not_run`, `under_support`, `suspended`, `in_progress`, `pending` e legado `off`) ele declara `didExecute=yes|no|unknown`, `isIncident`, `isTerminal`, `isAvailable`, label e justificativa. A matriz deve reconciliar schema, `product-status.ts`, dashboard, relatório e fixtures reais; enquanto um status estiver divergente, a tool retorna o status bruto e flag derivada `unknown`, nunca presume “rodou”.
- Todas as tools de dados retornam `ToolResult[T] = {ok,data,dataset,citations,asOf,truncated,warnings,errorCode}`. `dataset` contém apenas o manifesto (`datasetId`, `schemaId`, `sourceKind`, filtros canônicos, rowCount, checksum); objetos ORM, stack trace, SQL, segredo e dados fora do contrato nunca saem do adapter.
- Argumentos comuns: `dateRange.start/end` em `YYYY-MM-DD` inclusivo e no máximo 366 dias; até 25 `modelIds`; até 8 turnos inteiros de 0–23; paginação por cursor opaco; `limit` padrão 50 e máximo 200; ordenação escolhida de enum fixa. Range maior exige relatório agregado aprovado ou divisão explícita pelo orquestrador.

Catálogo read-only de identidade, execuções e intervenções:

| Tool | Entrada específica | Fonte e saída determinística |
|---|---|---|
| `resolve_models` | `query?`, `modelIds?`, `activeOnly=true`, `priorities?`, `limit<=50` | Resolve nomes/slugs sem o LLM inventar IDs; retorna ID, nome, slug, disponibilidade, prioridade e turnos configurados de `product`, em ordem `name,id`. |
| `resolve_projects` | `query?`, `projectIds?`, `statuses?`, `limit<=50` | Resolve somente projetos já visíveis no contrato de relatórios; retorna ID, nome, status e prioridade em ordem estável, sem tarefas. |
| `resolve_problem_categories` | `query?`, `categoryIds?`, `includeNoIncident=false`, `limit<=50` | Resolve categorias por ID/nome, com a categoria “sem incidente” excluída por padrão e marcada quando incluída explicitamente para diagnóstico. |
| `list_model_runs` | `modelIds?`, `dateRange`, `turns?`, `statuses?`, `didExecute?`, `limit`, `cursor`, `order` | Lista rodadas de `product_activity` com modelo, data, turno, status bruto, flags da matriz, categoria, descrição, intervenção, timestamps e citation. Ordem total estável `date,turn,modelName,id`. `didExecute` só filtra flags não ambíguas. |
| `summarize_model_runs` | mesmos filtros; `groupBy` enum `model`, `day`, `turn`, `status` | Agrega contagens por status e flags, total, concluídas, em execução, não executadas, incidentes, intervenções e disponibilidade segundo fórmula versionada. Não devolve média calculada pelo LLM. |
| `compare_model_run_periods` | `currentRange`, `previousRange?`, filtros, `metrics[]` | Compara ranges de mesma duração; se `previousRange` faltar, usa intervalo imediatamente anterior. Retorna valores absolutos, delta e percentual com regra explícita para divisor zero. |
| `get_model_run_history` | `activityId`, `limit<=100`, `cursor?` | Lê `product_activity_history`, ordenado por timestamp/id, com transições de status, descrição/intervenção e ator minimizado conforme contrato atual. Valida que a atividade pertence ao recorte autorizado. |
| `list_model_interventions` | `modelIds?`, `dateRange`, `statuses?`, paginação | Lista somente rodadas com intervenção não vazia, preservando modelo/data/turno/status/categoria; não interpreta texto como instrução. |

Catálogo read-only de problemas, projetos, relatórios e conhecimento:

| Tool | Entrada específica | Fonte e saída determinística |
|---|---|---|
| `list_problematic_runs` | filtros de modelo/período/turno/status/categoria e paginação | Consulta `product_activity` usando `isIncident=true` da matriz aprovada. Retorna ocorrências operacionais; `sourceKind=problematic_run`. Nunca conta `product_problem` junto. |
| `list_registered_problems` | `modelIds?`, `dateRange`, `categoryIds?`, `hasSolution?`, paginação | Consulta `product_problem` e existência real de `product_solution`, exclui a categoria “sem incidente” conforme constante versionada; `sourceKind=registered_problem`. |
| `get_registered_problem_details` | `problemId` | Retorna problema formal, modelo, categoria, timestamps e resumos de soluções/checks permitidos. Texto recuperado é dado não confiável e recebe citation própria. |
| `summarize_problems` | `sourceKind` enum `problematic_run`, `registered_problem`; filtros; `groupBy` enum `model`, `category`, `day`, `turn` | Agrega uma fonte por chamada. Se a pergunta pedir ambas, o plano executa duas chamadas e apresenta séries separadas, sem soma implícita. |
| `compare_problem_periods` | `sourceKind`, `currentRange`, `previousRange?`, filtros | Compara uma fonte e fórmula por vez, com ordem, divisor zero e timezone fixos. |
| `get_projects_snapshot` | `dateRange`, `projectIds?`, `statuses?`, `priorities?`, `includeTasks=false` | Porta a visão de projetos/tarefas/progresso já autorizada, com IDs resolvidos e limite explícito. |
| `get_availability_report_data` | `dateRange`, `modelIds?` | Dataset canônico para relatório de disponibilidade; fórmula e denominador identificados por `metricVersion`. |
| `get_problems_report_data` | `dateRange`, `modelIds?`, `categoryIds?` | Dataset de problemas formais. Não inclui `resolvedCount`/`resolutionRate` estimados; só os publica após consulta real e regra de resolução aprovada. Top problems usa ordenação estável. |
| `get_executive_report_data` | `dateRange`, `modelIds?`, `groupIds?` | Dataset executivo. `groupIds` só é aceito depois de existir join/filtro testado; antes disso retorna `UNSUPPORTED_FILTER`, nunca ecoa filtro não aplicado. |
| `get_projects_report_data` | `dateRange`, filtros allowlisted | Dataset canônico do relatório de projetos, com progresso calculado no servidor. |
| `search_silo_knowledge` | `query<=4000`, `sources` enum `problems`, `solutions`, `manuals`, `help`; `limit=1..5` | Mantém busca híbrida/ranking existente e contexto máximo inicial de 2.000 caracteres; cada trecho identifica fonte e score. |

Catálogo de apresentação e artefatos, executado por nós determinísticos depois que existe `datasetId`:

| Tool/nó | Entrada permitida | Saída e restrições |
|---|---|---|
| `build_chart_spec` | `datasetId`, `templateId`, `chartType` enum `bar`, `line`, `donut`; dimensões/métricas allowlisted | Produz exatamente o DTO `AiAssistantVisualizationChart` atual. Categorias e séries são projetadas do DatasetRegistry; o LLM não fornece arrays numéricos. Máximo 50 categorias, 6 séries e 500 pontos, números finitos e cores allowlisted. |
| `build_mermaid_diagram` | `datasetId`, `templateId` enum `project_flow`, `run_status_flow`, `problem_flow` | Produz o DTO Mermaid atual por templates e IDs escapados; nunca aceita código Mermaid livre. Limita 50 nós/80 arestas e rejeita links/click directives. |
| `render_summary_image` | `datasetId`, `templateId` enum `metric_card`, `run_status_board`, `problem_summary`, `executive_card` | Produz o DTO `image` atual como SVG determinístico sanitizado/data URI com tamanho limitado, texto escapado e sem scripts, URLs, HTML ou conteúdo externo. Não chama modelo generativo de imagem. |
| `generate_report_pdf` | `reportType` enum `availability`, `problems`, `executive`, `projects`; `datasetId`, filtros canônicos; claim derivado previamente do header validado | Gera o PDF A4 no volume e retorna artifact URL/filename/checksum. Fica fora de `bind_tools`, exige pedido explícito e reutiliza exatamente o dataset usado no texto/gráfico. |

- O `DatasetRegistry` vive somente no runtime context daquele graph run. O state serializável guarda manifestos compactos, nunca sessões/clients; apresentação com ID ausente, de outro run, expirado, schema incompatível ou checksum divergente falha `INVALID_DATASET_REF`.
- Cada template declara schemas de entrada, métricas/dimensões permitidas, ordenação, unidade, arredondamento, limites e fallback. Não existe “execute Python”, expressão de usuário, callback, formatter ou template arbitrário.
- `build_chart_spec`, `build_mermaid_diagram` e `render_summary_image` são transformações puras, sem DB/rede/arquivo, e não entram no `bind_tools`. O agente pode sugerir uma apresentação no `ExecutionPlan`, mas `plan_and_validate` confirma que ela corresponde à intenção atual antes do nó determinístico executá-la.
- `generate_report_pdf` é a única transformação com escrita de arquivo. O arquivo usa diretório resolvido pelo servidor, nome server-side, escrita temporária + rename atômico, checksum, cleanup em falha e idempotência; nenhuma tool aceita path/URL/filename do usuário ou do modelo.
- Limites iniciais por run: resultado bruto de uma tool ≤512 KiB, DatasetRegistry ≤8 MiB, projeção total ao prompt dentro dos 12.000 bytes da decisão 35, chart JSON ≤128 KiB, Mermaid ≤64 KiB, SVG ≤256 KiB e PDF ≤20 MiB/200 páginas. Estouro gera código tipado antes da entrega; os limites não são elevados automaticamente.
- Resultados têm limite por tool e limite agregado; truncamento é explícito. Dataset paginado não pode gerar totais, gráfico ou PDF fingindo completude: usar query agregada completa ou marcar o artefato “amostra truncada” no título/caption.
- Conteúdo do banco, manual, ajuda e tool result é dado não confiável. O prompt delimita-o como dados, ignora instruções encontradas nele e nunca transforma texto recuperado em autorização ou chamada de tool.
- Não existem tools de shell, filesystem genérico, HTTP/web genérico, SQL livre, e-mail, gestão de usuários, alteração de produtos/projetos ou publicação Kafka nesta migração.
- O loop agentic só enxerga, por chamada, no máximo 6 tools read-only suplementares compatíveis com o scope e com o plano. Tools de apresentação/PDF não entram em `bind_tools`. Nome fora da allowlist, argumento inválido, repetição idêntica ou orçamento esgotado encerra o loop e segue para síntese/fallback sem executar a chamada.
- `temperature=0` e output estruturado reduzem variação, mas não tornam o modelo determinístico. Decisões de autorização, período, limites, persistência, PDF e fallback ficam em código/edges.
- Toda execução termina em um dos estados explícitos: `success`, `fallback`, `refused`, `timeout`, `tool_error` ou `model_error`. Nenhum ciclo pode depender apenas de o modelo decidir parar.
- Uma única chamada de síntese é permitida no caminho normal. Uma segunda chamada só pode ocorrer se for a próxima rodada de um tool call válido; o código deve contabilizar chamadas e impedir o padrão duplicado atual.
- O grafo nunca expõe cadeia de pensamento. `thinking` legado é omitido ou preenchido com progresso sanitizado produzido pelo servidor; não usar tokens `thinking` do Ollama/LangGraph.
- A ordem SSE canônica após a correção da Fase 0 é: exatamente um `connected`, zero ou um `scope`, zero ou mais `thinking` de progresso, exatamente um terminal `result` ou `error`. Heartbeats continuam comentários SSE.
- Antes de emitir `result`, a transação de thread/mensagens deve estar commitada. Se persistir falhar, emitir `error`; nunca mostrar resultado como salvo quando não está no banco.
- O cliente desconectado cancela graph, chamada de modelo e tools ainda não essenciais. Efeitos já commitados ou PDF concluído obedecem regra idempotente documentada e são reconciliados.
- A fonte canônica de memória é `ai_assistant_message`; cada request recarrega as últimas 25 mensagens e o resumo conforme contrato. Não usar memória implícita do checkpointer.
- Logs registram `graphVersion`, `promptVersion`, `toolCatalogVersion`, scope, nomes/status/duração das tools, contadores, provider/model, cache hit e erro sanitizado. Não registrar pergunta, histórico, tool payload/result, resposta ou reasoning por padrão.
- Métricas mínimas: duração do grafo/nó/tool/modelo, tool calls por run, fallback/refusal/cache, timeouts, loops bloqueados, tokens quando disponíveis, desconexões SSE e divergência da avaliação.

### 3.7 Contrato determinístico do agente orquestrador

Cada mensagem produz primeiro um `ExecutionPlan` validado com estes campos: `planVersion`, `scope`, `questionKind`, entidades resolvidas/pendentes, ranges, fonte semântica (`model_run|problematic_run|registered_problem|project|knowledge`), métricas, tools obrigatórias ordenadas, dependências, apresentação solicitada, artefato solicitado, orçamento e critérios de conclusão. O plano não contém SQL, path, URL, código ou argumentos livres.

O fluxo é sempre executado nesta ordem; uma etapa só avança se suas pós-condições forem verdadeiras:

1. **Guard:** autenticar, confirmar usuário ativo/`reports:view`, ownership da thread, tamanho, timeout e request ID. Falha termina antes de embedding/model/tool.
2. **Entender:** normalizar pergunta, timezone, período, follow-up e intenção de texto/gráfico/imagem/diagrama/PDF; classificar scope. Pedido fora de escopo termina em recusa.
3. **Planejar:** construir `ExecutionPlan` determinístico. No híbrido, sugestão estruturada do modelo é apenas candidata; o validador resolve dependências, impõe fontes obrigatórias e elimina passos redundantes.
4. **Resolver entidades:** executar `resolve_models` ou resolução de projeto/categoria quando houver nomes. Zero correspondência gera resposta explicativa; múltiplas correspondências não são escolhidas silenciosamente e resultam em lista curta/solicitação de desambiguação.
5. **Coletar:** executar tools de dados independentes em paralelo máximo 2, dependentes em ordem topológica, registrar manifestos no DatasetRegistry e manter citações/proveniência. Uma fonte essencial incompleta bloqueia conclusões factuais.
6. **Analisar:** chamar somente agregadores/comparadores server-side, reconciliar unidades, datas, fonte e completude. O LLM não soma linhas nem calcula percentuais usados como fatos.
7. **Apresentar:** se solicitado, transformar o dataset validado em chart/image/Mermaid e/ou PDF usando templates. Texto, gráfico e PDF devem apontar para o mesmo checksum/snapshot.
8. **Sintetizar:** construir resposta-base factual e citações; então fazer no máximo uma síntese normal pelo chat model. No modo híbrido, tools suplementares já validadas podem ocorrer dentro do orçamento antes da síntese final.
9. **Verificar:** validar schema, números contra datasets, citations, sourceKind, período, URLs, artefatos e ausência de campos privados. Falha usa a resposta-base; não pede ao LLM para “corrigir de memória”.
10. **Commitar e entregar:** persistir mensagens/metadados sanitizados em transação, reconciliar artefato idempotente e só depois emitir o único `result`. Disconnect cancela etapas não commitadas conforme boundary documentada.

Progresso SSE público permitido, sempre produzido pelo servidor: “Entendendo a solicitação”, “Resolvendo modelos e período”, “Consultando execuções”, “Consultando problemas registrados”, “Calculando indicadores”, “Gerando gráfico”, “Gerando imagem-resumo”, “Gerando PDF”, “Validando resultado” e “Salvando resposta”. Não incluir argumentos, registros, prompts, tokens internos ou raciocínio.

Receitas obrigatórias de trajetória:

| Pedido | Plano mínimo validado |
|---|---|
| “Quais modelos rodaram ontem?” | normalizar ontem → opcional `resolve_models` → `list_model_runs(didExecute=yes)` → resposta com status bruto/citations; se a matriz ainda tiver ambiguidade, listar por status sem afirmar execução. |
| “Quais rodaram com problemas e por quê?” | `list_problematic_runs` → se houver pedido de explicação, `summarize_problems(sourceKind=problematic_run,groupBy=category)` e RAG apenas para contexto, nunca para alterar contagem. |
| “Liste os problemas cadastrados e as soluções” | `list_registered_problems(hasSolution=any)` → `get_registered_problem_details` somente para IDs necessários e dentro do limite; não usar rodadas problemáticas como substituto. |
| “Compare falhas desta semana com a anterior e gere um gráfico” | resolver `sourceKind` como `problematic_run` ou `registered_problem` a partir do pedido; se continuar ambíguo, esclarecer → `compare_problem_periods` → `build_chart_spec` no dataset da comparação → síntese; ranges têm mesma duração e timezone. |
| “Gere uma imagem do status dos modelos” | `summarize_model_runs(groupBy=model)` → `render_summary_image(run_status_board)`; a imagem é card/board determinístico e acessível, não arte generativa. |
| “Mostre o fluxo dos projetos” | `get_projects_snapshot(includeTasks=true)` → `build_mermaid_diagram(project_flow)`; nenhuma string Mermaid vem do modelo. |
| “Gere o PDF de problemas dos últimos 30 dias” | `get_problems_report_data` → validar completude/checksum → `generate_report_pdf(problems)` uma vez → persistir e devolver link. |
| “Relatório executivo com gráfico e PDF” | `get_executive_report_data` uma vez → `build_chart_spec` e `generate_report_pdf` referenciando o mesmo `datasetId` → validar números cruzados → resposta. |

Regras de falha por etapa:

- resolução ambígua: não consultar todos os modelos por acidente; responder opções e não gerar artefato;
- tool essencial indisponível/timeout: não seguir para análise ou PDF; devolver fallback de indisponibilidade com o período afetado;
- tool opcional falhar: continuar apenas se a resposta deixar a lacuna explícita e nenhuma métrica depender dela;
- dataset truncado: permitir listagem paginada, proibir total/gráfico/PDF completo salvo se houver agregação separada não truncada;
- gráfico/imagem/Mermaid inválido: manter resposta textual validada e registrar `artifact_error`, sem segunda síntese;
- PDF falhar antes do rename: remover temporário e retornar texto; após rename, registrar/reconciliar por idempotency key;
- afirmação numérica não encontrada no manifesto/citation: substituir pela resposta-base ou remover a afirmação; nunca estimar;
- pedido de imagem generativa: explicar que esta versão oferece imagens-resumo de dados; qualquer provedor generativo exige ADR, política de conteúdo, custo, armazenamento e contrato de frontend próprios.

---

## 4. Fases executáveis

## Fase 0 — Congelar e sanear a linha de base

### Objetivo

Criar uma base repetível antes de portar qualquer código.

### Passos

- [x] 0.1 Criar branch `migration/python-fastapi` a partir do SHA aprovado de `main`.
- [x] 0.2 Salvar `git rev-parse HEAD`, `git status --short`, versões de Node/npm/Python/Docker e lista de imagens em `docs/migration/evidence/phase-00/`.
- [x] 0.3 Preservar as duas mudanças locais de embeddings; se forem do usuário, solicitar que sejam commitadas em branch própria ou manter o diff intacto. Nunca incluí-las acidentalmente no commit da fase.
- [x] 0.4 Corrigir somente as duas expectativas obsoletas de `priority` em `projects.test.ts` e confirmar 40/40 testes da API.
- [x] 0.5 Adicionar teste real do campo `priority` para create/update; não apenas alterar snapshot/matcher permissivamente.
- [x] 0.6 Corrigir os scripts raiz inconsistentes: `test:worker` não pode apontar para script inexistente. Adicionar suíte mínima do worker antes de habilitá-lo.
- [x] 0.7 Criar testes de caracterização do worker Node para JSON inválido, ausência de message id, duplicata, sucesso, retry, DLQ, falha de DLQ e commit do próximo offset.
- [x] 0.8 Ajustar o shutdown Node para não chamar `process.exit()` antes do `finally`; comprovar remoção da instância REST em SIGTERM. Esse ajuste é necessário para um cutover seguro.
- [x] 0.9 Ajustar o comportamento Node para não commitar quando o DLQ falhar, com teste. A implementação Python copiará esse baseline seguro.
- [x] 0.10 Executar e salvar:

```powershell
npm ci --legacy-peer-deps
npm run typecheck:web
npm run typecheck:api
npm run typecheck:worker
npm run lint:web
npm run lint:api
npm run lint:worker
npm run test:web
npm run test:api
npm run test:worker
npm run build:web
npm run build:api
npm run build:worker
```

- [x] 0.11 Classificar divergências entre `docs/06-api.md` e o código. Não corrigir documentação ainda; gerar `docs/migration/legacy-contract-drift.md`.
- [x] 0.12 Instituir congelamento temporário: novas features de API/worker só entram se tiverem contrato Node e tarefa equivalente na matriz de migração.
- [x] 0.13 Criar testes Node que contem chamadas ao Ollama nos caminhos sync, SSE ao vivo, SSE cache hit e fallback. Registrar como defeito conhecido que o SSE ao vivo hoje faz refinamento duas vezes; o destino deverá fazer uma única síntese.
- [x] 0.14 Corrigir o vazamento do cache Node antes de capturar goldens: mudar para `findCachedAssistantResponse(userId, question)`, fazer join com `ai_assistant_thread`, filtrar `thread.user_id = userId` e parametrizar `userId`, data, vetor e message id. Adicionar teste com duas contas e perguntas idênticas provando zero cache cross-user.
- [x] 0.15 Corrigir a incompatibilidade SSE de cache de modo backward-compatible: o frontend passa a aceitar tanto `data`+`complete` legado quanto `result`; o Node passa a emitir exatamente um `result` terminal com o DTO completo. Impedir `connected` duplicado. Congelar esse contrato reparado como golden.
- [x] 0.16 Remover do prompt Node a exigência de “raciocínio completo”, não transmitir tokens de reasoning e não persistir novos `metadata.thinking` com cadeia de pensamento. O evento `thinking` pode carregar somente frases de progresso constantes do servidor. Manter leitura tolerante dos registros antigos, mas não devolvê-los ao cliente.
- [x] 0.17 Criar teste de regressão garantindo: uma resposta de outro usuário nunca é retornada; cache e live terminam em `result`; `result` só é enviado após persistência; zero conteúdo de reasoning aparece em SSE, JSON, banco ou logs novos.
- [x] 0.18 Corrigir o erro Node de PDF para nunca emitir `visualization.image` com `src=""`: em falha, omitir a visualização e devolver fallback válido. Adicionar contador/teste provando também quais quatro services são chamados hoje; registrar a coleta excessiva como comportamento a remover, não como contrato.
- [x] 0.19 Corrigir `assistant-mermaid.tsx` antes dos goldens: trocar `securityLevel:"loose"` por `"strict"`, criar o nó com `document.createElement`/`textContent`/`replaceChildren` em vez de interpolar definição em `innerHTML`, bloquear directives/links e testar payloads HTML/SVG/`click`/`javascript:`. Preservar fallback textual via React escaping.
- [x] 0.20 Substituir `isSafeImageSource()` por validadores separados: URL local deve começar com uma única `/`, passar por decode/normalização sem `..`, `\`, controle ou host e pertencer a prefixo allowlisted; PDF somente em reports e `.pdf`; data URI somente MIME exato/tamanho permitido, com SVG decodificado e sem script/event/foreignObject/recurso externo. Adicionar CSP/frame/img tests e manter os cards atuais funcionando.

### Gate 0

Status: **aprovado em 2026-07-21**. Evidência consolidada em `docs/migration/evidence/phase-00/gate-0-summary.md`.

- Todos os comandos aprovados.
- API 40/40 ou mais, web 31/31 ou mais, worker com suíte criada.
- Nenhuma mudança local do usuário perdida.
- Shutdown e falha de DLQ cobertos.
- Cache cross-user corrigido e testado; nenhuma query desse cache usa `sql.raw` para dado dinâmico.
- SSE reparado e frontend compatível com Node antigo/novo; thinking privado removido.
- Falha de PDF respeita o schema e a futura implementação está autorizada a consultar somente o relatório selecionado.
- Mermaid atual não usa modo loose nem interpola definição em HTML; security tests passam antes de qualquer saída nova do agente.
- Nenhuma visualização aceita `//host`, scheme inesperado, data MIME genérico, SVG ativo ou PDF fora do prefixo local.

### Rollback da fase

Reverter apenas o commit da fase; não tocar nas mudanças preexistentes de embeddings.

---

## Fase 1 — Congelar contratos observáveis do Node

### Objetivo

Transformar a implementação Node em oráculo executável, porque a documentação está desatualizada.

### Passos

- [ ] 1.1 Criar `docs/migration/contract-matrix.yaml`. Cada operação do Apêndice A deve conter: id, método, path público, path recebido pela API, auth, permissão, query, headers, body, status de sucesso, erros, response schema, efeitos no DB/arquivos/e-mail/realtime e teste correspondente.
- [ ] 1.2 Criar banco fixture isolado a partir de migrations/schema efetivos, com usuários: admin ativo, usuário ativo com permissões parciais, usuário sem permissão e usuário inativo.
- [ ] 1.3 Fixar relógio de testes, timezone `America/Sao_Paulo`, UUIDs, random e respostas externas. Campos realmente não determinísticos serão normalizados por JSONPath documentado.
- [ ] 1.4 Criar runner de contrato que execute cada caso contra `api-node:4000` e salve status, headers permitidos, body e side effects em `tests/fixtures/legacy-golden/`.
- [ ] 1.5 Testar tanto chamada direta `/api/*` quanto chamada pública através do Next `/silo/api/admin/*` com `NEXT_PUBLIC_BASE_PATH=/silo` e novamente com base vazia.
- [ ] 1.6 Capturar, para cada rota, pelo menos: sucesso, validação inválida, não autenticado, sem permissão, not found, conflito e falha de infraestrutura aplicáveis.
- [ ] 1.7 Capturar DELETE com id em query, body ou path exatamente como o frontend usa. Não uniformizar.
- [ ] 1.8 Capturar headers e cookies de: login senha, login OTP, cadastro, setup password, get-session, sign-out, início/callback Google.
- [ ] 1.9 Extrair e testar atributos reais de cookies Better Auth em desenvolvimento e produção simulada.
- [ ] 1.10 Consultar logs de acesso de staging/produção por no mínimo 7 dias para descobrir endpoints Better Auth ou externos não chamados pelo código. Redigir allowlist final. Ausência de acesso a endpoints não listados precisa ser registrada.
- [ ] 1.11 Capturar hashes bcrypt reais anonimizados ou vetores de teste produzidos por `bcryptjs`, incluindo senha Unicode e >72 bytes.
- [ ] 1.12 Capturar WebSocket: handshake com/sem cookie, permissão negada, connected, todos os eventos, ping/pong, duas abas e offline final.
- [ ] 1.13 Capturar SSE byte a byte quanto a event names, ordem, separadores, heartbeat, erro antes/depois de headers e cancelamento.
- [ ] 1.14 Capturar uploads com imagens em todas as orientações EXIF/formatos, oversize, arquivo falso, filename hostil e validar dimensões, MIME e pixels essenciais do WebP.
- [ ] 1.15 Gerar um PDF de cada tipo com fixture fixa; salvar texto extraído, quantidade de páginas, metadata e PNG de cada página para comparação visual tolerante.
- [ ] 1.16 Capturar e-mails em SMTP fake: assunto, destinatário, texto/HTML, OTP substituível e links/basePath.
- [ ] 1.17 Capturar queries RAG e outputs com fake Ollama: dimensões 768, ranking híbrido, limiares, cache isolado por usuário, assinatura de cache e fallback.
- [ ] 1.18 Usar `kafka-consumer-api-example.json` e fixtures adicionais para congelar parsing ecFlow/dataflow e comportamento do worker.
- [ ] 1.19 Criar `docs/migration/ai-current-flow.md` com trace de cada scope (`models`, `pending`, `reports`, `problems`, `solutions`, `projects`, `general`, `generate_pdf`): classificador vencedor, reports chamados, fontes RAG, citações, visualização, quantidade de chamadas LLM e writes.
- [ ] 1.20 Criar corpus versionado `backend/tests/fixtures/ai/eval-cases.jsonl` com no mínimo 210 casos: 10 por cada um dos 8 scopes (80), 20 follow-ups elípticos, 10 fora de escopo, 10 prompt injections em pergunta, 10 em documentos recuperados, 20 sobre semântica de “rodou/não rodou/incidente”, 10 separando rodada problemática de problema formal, 10 de gráfico/imagem/Mermaid e 10 de cada um dos quatro PDFs (40). Cada caso pertence a uma categoria primária sem dupla contagem e declara scope, plano esperado, tools obrigatórias/permitidas/proibidas, sourceKind, fontes, números verificáveis, dataset/artifact esperado e se PDF é permitido.
- [ ] 1.21 Registrar hardware de staging do Ollama, imagem/digest do servidor, nome e digest dos blobs dos modelos, RAM/VRAM, context length observado, cold/warm latency e concorrência. Não comparar modelos em hardware diferente.
- [ ] 1.22 Executar capability probe do modelo efetivamente implantado (`qwen2.5:1.5b-instruct-q4_K_M`, salvo override comprovado): JSON schema, uma tool, tools paralelas, argumentos inválidos, duas rodadas, streaming com tool call, português e recusa. Salvar requests/responses sanitizados e taxa de sucesso; esse probe não autoriza ainda modo `hybrid`.
- [ ] 1.23 Congelar o contrato reparado de IA: exatamente um terminal SSE, cache por usuário, uma persistência, ausência de reasoning, status público ainda `provider=ollama` e geração pública sem campos LangGraph obrigatórios.
- [ ] 1.24 Criar fixture cruzada de `product`, `product_activity`, `product_activity_history`, `product_problem`, categorias, soluções e checks cobrindo todos os status, quatro turnos, dois períodos, intervenção vazia/não vazia, problema sem solução, com uma/múltiplas soluções e categoria “sem incidente”. Cada linha recebe resultado esperado manualmente revisado.
- [ ] 1.25 Criar `docs/migration/ai/model-run-status-semantics.yaml` a partir de schema, constantes do engine, dashboard, relatórios e amostra anonimizada real. Para cada status registrar `didExecute`, `isIncident`, `isTerminal`, `isAvailable`, denominação e owner que aprovou. Resolver explicitamente `pending` e `off`; nenhum valor pode ficar implícito.
- [ ] 1.26 Criar `docs/migration/ai/source-semantics.md` distinguindo `problematic_run` (`product_activity`) de `registered_problem` (`product_problem`), com regras de vínculo, deduplicação, exclusão da categoria “sem incidente” e exemplos de perguntas. Não criar FK ou inferência de correspondência nesta migração se ela não existir hoje.
- [ ] 1.27 Caracterizar e abrir teste regressivo para os três defeitos de relatório: resolução fixa em 80%, top-5 sem ordenação e `groupId` não aplicado. Marcar no golden legado como `known-invalid`, não como contrato a preservar; a saída Python só pode corrigir após a regra da Fase 7.
- [ ] 1.28 Capturar para cada visualização atual o DTO completo e o render do frontend: bar/line/donut, SVG summary card, Mermaid e estados vazio/truncado/valores negativos/divisor zero. Validar escaping com nomes hostis, limites de pontos e acessibilidade textual.
- [ ] 1.29 Para os quatro PDFs, registrar dataset canônico, checksum, texto extraído, páginas e imagem renderizada. Demonstrar que texto, gráfico e PDF do mesmo caso compartilham exatamente período, filtros, totais e versão de métrica.
- [ ] 1.30 Usar logs/telemetria de no mínimo 7 dias para inventariar clientes dos POSTs sync/SSE do assistente por origem/User-Agent sanitizados. Confirmar que todos poderão enviar `X-Idempotency-Key`; se existir cliente externo, identificá-lo e atualizá-lo antes da Fase 13. Ausência de owner/compatibilidade bloqueia o gate — a API Python não torna o header opcional para PDF nem assume que só o web chama.

### Comparador

O comparador pode normalizar apenas valores declarados, por exemplo:

```yaml
normalizers:
  - $.data.id: UUID
  - $.data.createdAt: ISO_TIMESTAMP
  - $.data.filename: GENERATED_FILENAME
```

Não normalizar listas inteiras, mensagens de erro, status, `null`, ausência de campo, permissões, offsets, ranking ou eventos.

### Gate 1

- 100% das operações do Apêndice A presentes na matriz.
- Goldens versionados e reproduzíveis.
- Nenhum endpoint observado nos logs sem decisão explícita.
- Frontend passa usando o Node e fixtures congeladas.
- Corpus/evidências de IA completos, com modelo e hardware identificados por digest.
- Matriz de status e semântica das duas fontes aprovadas; nenhum status `pending/off` ou métrica de resolução permanece ambíguo.
- Goldens de chart/image/Mermaid/PDF ligam cada número ao dataset canônico e cobrem escaping/truncamento.
- Todos os clientes de mensagens do assistente têm owner e plano aprovado para o header de idempotência; nenhum consumidor desconhecido fica incompatível.
- Defeitos reparados da Fase 0 não aparecem nos goldens como comportamento a preservar.

---

## Fase 2 — Criar o esqueleto Python reproduzível

### Objetivo

Adicionar Python sem alterar o tráfego ou o banco de produção.

### Passos

- [ ] 2.1 Instalar `uv` 0.11.28 pelo instalador oficial e verificar checksum/versão.
- [ ] 2.2 Criar exatamente a árvore de `backend/` definida na seção 2.2.
- [ ] 2.3 Criar `.python-version` com `3.13.14`, `requires-python = "==3.13.*"` e imagem `python:3.13.14-slim-bookworm`; CI deve falhar se `sys.version_info[:2] != (3, 13)`.
- [ ] 2.4 Definir `tool.uv.exclude-newer = "2026-07-20T23:59:59Z"`, adicionar as dependências exatas da seção 2.3, resolver as ferramentas restantes com `uv add --dev --bounds exact`, gerar `uv.lock` e versionar o lock. Assim, executar o plano em data posterior não muda o universo de releases.
- [ ] 2.5 Configurar Ruff para format e lint, mypy strict para `src/silo`, pytest e cobertura.
- [ ] 2.6 Configurar imports por pacote `src/`; proibir `sys.path` hacks e imports de `apps/*`.
- [ ] 2.7 Implementar `Settings` central com fail-fast. Aceitar durante coexistência:
  - `SILO_ENV`, com fallback controlado de `NODE_ENV`;
  - `DATABASE_URL`, depois `DATABASE_URL_PROD/DEV` conforme ambiente;
  - variáveis atuais de SMTP, Google, Kafka, Ollama, uploads, basePath e product flow;
  - novas `SESSION_SECRET`, `TRUSTED_PROXY_CIDRS`, `LOG_LEVEL`.
- [ ] 2.8 Validar URL, inteiros, booleans, listas CSV e produção. Mensagens nunca exibem valores secretos.
- [ ] 2.9 Implementar logging JSON com timestamp UTC, level, service, request_id e contexto; redaction obrigatória.
- [ ] 2.10 Implementar clock injetável e gerador de IDs injetável para testes.
- [ ] 2.11 Criar FastAPI mínimo com lifespan, `GET /health` compatível e novos `GET /health/live` e `GET /health/ready`.
- [ ] 2.12 Nesta fase, `ready` deve validar configuração e DB quando configurado. A verificação de revision em head é adicionada obrigatoriamente na fase 3, depois que o baseline Alembic existir. Ollama/Kafka não bloqueiam readiness geral, mas aparecem em status interno.
- [ ] 2.13 Criar `backend/Dockerfile` multi-stage com targets `api` e `worker`, usuário não-root, init apropriado, `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1` e lock congelado.
- [ ] 2.14 Criar overlay `docker-compose.migration.yml` com `api-python:4001`; não expor worker Python ainda.
- [ ] 2.15 Atualizar `.gitignore` para `.venv`, caches e coverage Python; não ignorar `uv.lock` nem migrations.
- [ ] 2.16 Adicionar scripts raiz `py:sync`, `py:lint`, `py:format:check`, `py:typecheck`, `py:test`, `py:build` sem remover scripts Node.
- [ ] 2.17 Atualizar GitHub Actions e GitLab CI para jobs Node e Python explícitos. Não usar `npx turbo` se Turbo não estiver declarado/lockado.
- [ ] 2.18 Confirmar pelo `uv lock --check` que `langgraph==1.2.9`, `langchain-core==1.4.9` e `langchain-ollama==1.1.0` resolvem juntos em Windows e Linux/Python 3.13.14. Falha de resolução bloqueia a fase; não afrouxar pins isoladamente.
- [ ] 2.19 Adicionar smoke de import/compilação de um `StateGraph` mínimo e instanciação fake das portas de chat/embedding, sem rede e sem LangSmith.
- [ ] 2.20 Fixar `LANGSMITH_TRACING=false` e rejeitar boot de produção se tracing externo for habilitado sem a flag de aprovação prevista neste plano.

### Comandos do gate

```powershell
cd backend
uv lock --check
uv sync --locked --all-groups
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q --cov=silo --cov-report=term-missing
cd ..
docker compose -f docker-compose.yml -f docker-compose.migration.yml build api-python
docker compose -f docker-compose.yml -f docker-compose.migration.yml up -d api-python
```

### Gate 2

- Imagem Python reproduzível e não-root.
- `/health` em 4001 com shape golden.
- Lock verificado no Windows e Linux CI.
- Nenhum tráfego real ou DDL alterado.

---

## Fase 3 — Reproduzir o schema real com SQLAlchemy e Alembic

### Objetivo

Assumir o banco sem perda, drift ou DDL automático.

### Passos

- [ ] 3.1 Agendar janela somente de leitura para captura do schema de staging e produção. Até a fase 16, produção só pode ser lida para inventário/backup; nenhum `stamp`, DDL ou seed será executado nela.
- [ ] 3.2 Gerar backup lógico completo em formato custom para storage protegido fora do Git e schema-only sanitizado para evidência.
- [ ] 3.3 Validar backup com `pg_restore --list` e restaurá-lo em PostgreSQL descartável. Executar contagens e checksums por tabela.
- [ ] 3.4 Capturar extensões, tabelas, colunas, tipos, defaults, sequences, constraints, FKs, índices, triggers, views e grants via `pg_catalog`/`information_schema`.
- [ ] 3.5 Comparar três fontes: produção real, `packages/db/src/schema.ts` e `packages/db/drizzle/*.sql`. Resolver todo drift em relatório; produção real vence, salvo defeito explicitamente corrigido por migration aditiva.
- [ ] 3.6 Modelar todas as tabelas atuais em SQLAlchemy, incluindo pelo menos:
  - `group`, `user_group`, `group_permissions`;
  - `user`, `session`, `account`, `verification`, `rate_limit`, `user_profile`, `user_preferences`;
  - `product`, `product_availability_exception`, `product_activity`, `product_activity_history`;
  - `picture_page`, `picture_link`, `radar_group`, `radar`;
  - problemas, categorias, imagens, soluções, checks e dependências;
  - contatos, manuais e `product_manual_chunk`;
  - chat e presença;
  - threads/mensagens do assistente;
  - help;
  - projetos, atividades, tarefas, usuários e histórico;
  - `kafka_processed_messages`.
- [ ] 3.7 Mapear nomes Python snake_case e nomes físicos existentes; nunca renomear coluna só por convenção.
- [ ] 3.8 Mapear timestamps sem timezone como `DateTime(timezone=False)` quando esse for o tipo real. Criar serializer de compatibilidade validado pelos goldens; não “corrigir UTC” durante a migração.
- [ ] 3.9 Mapear JSONB, DATE, UUID e `Vector(768)`; registrar dimensão como constante única.
- [ ] 3.10 Criar migration baseline completa que constrói banco vazio, extensões `vector`/`pg_trgm`, tabelas, constraints e índices.
- [ ] 3.11 Em restore descartável e staging, calcular fingerprint canônico e somente então executar `alembic stamp <baseline_revision>`. Se o fingerprint divergir, parar. O `stamp` de produção ocorre exclusivamente pelo serviço `migrate` da fase 16.
- [ ] 3.12 Em banco vazio, executar `alembic upgrade head`; comparar schema resultante com o snapshot real, ignorando apenas owner/grants previamente documentados.
- [ ] 3.13 Executar `alembic check` e `alembic current --check-heads`.
- [ ] 3.14 Portar seed para Python de forma idempotente, mas não rodá-lo automaticamente em produção.
- [ ] 3.15 Criar comando explícito `uv run silo-db-seed` e testes de duas execuções sem duplicata.
- [ ] 3.16 Alterar o entrypoint Node temporário para `SKIP_DB_SYNC=1` no ambiente de coexistência; remover `DROP __drizzle_migrations` e `drizzle-kit push` do caminho oficial.
- [ ] 3.17 Criar serviço one-shot `migrate` no Compose, protegido por advisory lock. API depende de sua conclusão bem-sucedida. A partir daqui, `ready` também exige `alembic current --check-heads` equivalente.
- [ ] 3.18 Depois de provar o baseline exato, criar revision Alembic **aditiva** para `ai_assistant_artifact` conforme decisão 33: FKs thread/message `ON DELETE SET NULL`, unique index no hash de idempotência, `request_fingerprint`, índices de `thread_id`, `message_id`, `status`, `lease_expires_at` e `attached_at`, checks de kind/status/MIME e `status='ready' ⇒ dataset_checksum/file_sha256 não nulos`; `message_id` pode ficar nulo somente na curta janela entre arquivo pronto e commit final. Não armazenar blob/prompt/dataset nem converter mensagens antigas.
- [ ] 3.19 Executar baseline→head em banco vazio e restore→stamp baseline→head em cópia real; comparar o único delta aprovado, testar downgrade apenas em banco descartável e provar que API Node continua operando ignorando a tabela. Produção só recebe essa revision pelo fluxo da Fase 16.

### Gate 3

- Restore integral testado.
- Banco do zero e banco existente stampado chegam ao mesmo fingerprint.
- `alembic check` sem operações inesperadas.
- Node continua funcionando com o schema baseline.
- A migration aditiva de artifact é o único delta pós-baseline, passa upgrade nos dois caminhos e não afeta Node/rollback.
- Nenhum startup da API executa DDL.

### Rollback

Como o baseline não altera objetos existentes e a tabela de artifact é aditiva, rollback da aplicação volta para Node **sem downgrade**: Node ignora `ai_assistant_artifact`, e `alembic_version`/tabela permanecem para nova tentativa. Remover revision/tabela só em banco descartável ou mudança posterior aprovada depois de confirmar zero referência/arquivo; nunca restaurar backup sobre produção em execução.

---

## Fase 4 — Construir a camada de compatibilidade HTTP

### Objetivo

Evitar diferenças sistêmicas FastAPI/Express antes de portar domínios.

### Passos

- [ ] 4.1 Implementar middleware de request id, logging, CORS, trusted proxy, limite de body e duração.
- [ ] 4.2 Reproduzir o rate limit global: 200 requests/60 s, chave por usuário autenticado ou IP, prefixo `api`, skip de `/api/auth`.
- [ ] 4.3 Portar o rate limit persistente de auth com atomicidade e concorrência testadas.
- [ ] 4.4 Criar exceções tipadas: validation, unauthenticated, forbidden, not found, conflict, rate limited, infrastructure unavailable e internal.
- [ ] 4.5 Criar handlers que devolvem o envelope/status golden. O handler de `RequestValidationError` não pode vazar schema Pydantic nem retornar 422.
- [ ] 4.6 Criar modelos base com alias camelCase, serialização controlada e `extra` conforme cada contrato.
- [ ] 4.7 Implementar dependências `get_db`, `get_current_user`, `require_admin`, `require_permission`, `require_chat_access` sem regra duplicada em routers.
- [ ] 4.8 Desabilitar ou proteger `/docs`, `/redoc` e `/openapi.json` em produção; manter OpenAPI disponível em CI/staging.
- [ ] 4.9 Exportar OpenAPI em CI e gerar tipos TypeScript em `packages/engine/src/contracts/generated/`, sem substituir ainda DTOs manuais usados pelo web.
- [ ] 4.10 Adicionar diff de OpenAPI no CI. Mudança breaking exige falha.

### Gate 4

- Testes unitários para todos os middlewares/handlers.
- Casos genéricos do runner Node × Python sem diferenças não normalizadas.
- 401/403/404/409/429/500/503 compatíveis.

---

## Fase 5 — Migrar autenticação, sessões e permissões

### Objetivo

Substituir Better Auth de forma controlada, preservando contas e senhas.

### Passos

- [ ] 5.1 Portar validações de e-mail/nome/senha/OTP de `packages/engine/src/validation/auth.ts` para Pydantic e adicionar vetores compartilhados JSON executados também pelo TypeScript.
- [ ] 5.2 Portar `isValidDomain`, usuário inativo, grupo default e normalização lower-case do e-mail.
- [ ] 5.3 Implementar verificação bcrypt compatível conforme seção 3.3; comprovar todos os vetores Node.
- [ ] 5.4 Reutilizar tabelas `user`, `account` e `session` sem alterar colunas durante rollback.
- [ ] 5.5 Emitir token opaco `silo_session`, gravar sessão, setar cookie e buscar usuário/sessão em uma query segura. Não aceitar token expirado ou usuário inativo.
- [ ] 5.6 Implementar sliding update máximo diário e limpeza assíncrona/lazy de sessões expiradas.
- [ ] 5.7 Implementar `GET /api/auth/get-session` com shape direto exato e `POST /api/auth/sign-out` com expiração de `silo_session` e cookies Better Auth.
- [ ] 5.8 Portar fluxos customizados completos: login senha, login OTP, cadastro, confirmação/reenvio, forget password, verify OTP, setup password.
- [ ] 5.9 Reproduzir limites atuais: tentativas, janelas, cooldown, `retryAfterSeconds`, `resetFlow`, `field` e mensagens.
- [ ] 5.10 Portar templates SMTP e testar assunto/HTML/texto. Em dev sem SMTP, OTP pode ir para log somente com redaction parcial e flag explícita; em produção, ausência de SMTP falha no boot.
- [ ] 5.11 Implementar Google OAuth/OIDC com Authlib, state criptograficamente seguro, nonce, callback `/api/auth/callback/google`, URLs de retorno com basePath e linking somente do provider confiável.
- [ ] 5.12 Preservar registros `account` existentes; testar login de conta Google já vinculada e nova vinculação permitida.
- [ ] 5.13 Portar permissões exatamente: grupos, admin, canonicalização `view/manage`, preferências de chat e recursos listados nas rotas.
- [ ] 5.14 Alterar o web em mudança compatível antecipada:
  - proxy aceita cookie Python e cookies Better Auth;
  - remover uso direto de `authClient.signIn.email` e chamar endpoint compatível;
  - `getAuthUser` continua chamando `/api/auth/get-session`;
  - manter Better Auth instalado até encerrar rollback.
- [ ] 5.15 Criar teste e2e browser: cadastro, OTP, senha, logout, login, usuário inativo, admin, permissão negada, Google fake, expiração e duas abas.
- [ ] 5.16 Documentar comunicação do cutover: sessões e códigos OTP serão reiniciados.

### Gate 5

- Todos os auth goldens aprovados, exceto nome do novo cookie previamente aprovado neste plano.
- Usuários/hashes existentes autenticam.
- Nenhum endpoint mutável aceita CSRF de origem não confiável.
- Frontend funciona com API Node e API Python enquanto usa o proxy dual-cookie.

### Rollback

Trocar origem de API para Node. Usuários com cookie Better Auth continuam; usuários que só possuírem `silo_session` fazem novo login. Não apagar sessões antigas antes do fim da janela.

---

## Fase 6 — Migrar CRUDs e domínios de menor acoplamento

### Ordem obrigatória de slices

1. `server-time`, `check-admin`, health e warmup.
2. `contacts`.
3. `groups` e permissões.
4. `users`, profile, preferences, imagem e troca de e-mail/senha.
5. `help`.
6. `products` CRUD básico.
7. `incidents`.
8. `monitoring` CRUD de pictures/radars.

### Procedimento para cada slice

- [ ] Criar schemas request/response a partir de contrato golden, não a partir apenas do ORM.
- [ ] Portar service e queries com ordenação explícita.
- [ ] Portar router fino e dependências de auth/permissão.
- [ ] Criar unit tests da regra, integration tests PostgreSQL real e contract tests Node × Python.
- [ ] Executar testes do frontend que consomem o slice contra Python.
- [ ] Comparar rows antes/depois, incluindo cascades e arquivos relacionados.
- [ ] Marcar o slice como concluído em `contract-matrix.yaml` somente sem diff.

### Regras específicas

- [ ] 6.1 Não confundir query id por `id`, `userId`, `projectId` etc.; preservar o frontend real.
- [ ] 6.2 Preservar default permissions de novos grupos e proibição de criar grupo admin.
- [ ] 6.3 Preservar admin implícito por `group.role == "admin"`.
- [ ] 6.4 Em e-mail/perfil, manter transações entre `user`, `account`, verification, profile e notificações.
- [ ] 6.5 Background de embeddings acionado por help/problema/solução não pode desfazer a mutation se Ollama falhar; reproduzir comportamento caracterizado e registrar falha.

### Gate 6

- Cada slice com 100% dos casos da matriz aprovados.
- Nenhuma query N+1 nova em listagens.
- Testes web relacionados aprovados contra Python.

---

## Fase 7 — Migrar projetos, tarefas, produtos estendidos, dashboard e relatórios

### Ordem obrigatória

1. scheduling (`availability`, conflicts, shift codes).
2. projects e project activities.
3. project tasks, reorder, users e history.
4. product activities, availability exceptions e history.
5. contacts/dependencies/manual do produto.
6. problems/categories/images/solutions/checks.
7. dashboard.
8. report data services.

### Passos críticos

- [ ] 7.1 Portar regras puras primeiro e executar vetores TypeScript × Python com mesmas entradas/saídas.
- [ ] 7.2 Fixar locale/timezone em cálculos de turnos, datas e disponibilidade.
- [ ] 7.3 Preservar transações de reorder e constraints de posição; testar duas requisições concorrentes.
- [ ] 7.4 Preservar histórico de status/alterações e usuário autor.
- [ ] 7.5 Preservar `priority` de tarefas em request, serviço, DB e response; essa é uma divergência já detectada no baseline.
- [ ] 7.6 Em mutations que geram embeddings, commit de domínio e tarefa de embedding devem ter semântica caracterizada. Se houver risco de perda, registrar outbox/backfill separado sem ampliar o cutover.
- [ ] 7.7 Comparar agregações de dashboard e relatório com dataset fixo, inclusive zeros, vazios, filtros e limites de período.
- [ ] 7.8 Verificar planos de query com `EXPLAIN (ANALYZE, BUFFERS)` em dataset representativo para endpoints mais lentos.
- [ ] 7.9 Implementar uma única `ModelRunStatusSemantics` Python carregada de enum/constante versionada e testar equivalência com `model-run-status-semantics.yaml`. Dashboard, relatórios, tools e builders devem importar essa fonte; proibir sets locais divergentes de incidentes por teste de arquitetura.
- [ ] 7.10 Corrigir `get_problems_report_data`: `resolvedCount` e `resolutionRate` só derivam da regra aprovada sobre soluções/checks reais. Se o domínio não possuir critério suficiente, remover/retornar `null` com `unsupportedMetrics`, ajustar o frontend por contrato dual e nunca manter os 80% estimados.
- [ ] 7.11 Ordenar top problems de modo total e documentado (`createdAt DESC, id ASC`, salvo regra aprovada diferente) antes de aplicar limite; aplicar o mesmo ordenamento no Node reparado, Python, PDF e tools.
- [ ] 7.12 Implementar de fato o filtro executivo por grupo com joins e fixtures de pertencimento, ou rejeitá-lo com `UNSUPPORTED_FILTER` e removê-lo do plano/DTO interno. É proibido ecoar `groupId` como aplicado quando os dados não foram filtrados.
- [ ] 7.13 Extrair queries/aggregators reutilizáveis para rodadas, intervenções, problemas formais, comparações e datasets de relatório. Rotas e tools chamam a mesma camada de aplicação para evitar números diferentes entre frontend, agente e PDF.
- [ ] 7.14 Toda agregação deve declarar `metricVersion`, timezone, range inclusivo, denominador, sourceKind, completude e arredondamento. Testar divisor zero, DST/timezone, range de um dia, limite 366 dias e dados atualizados durante a consulta sob snapshot transacional quando houver múltiplas queries correlatas.
- [ ] 7.15 Executar datasets compostos em transação read-only `REPEATABLE READ` com timeout, sem manter snapshot durante chamada LLM/render; materializar o DatasetRegistry e encerrar a transação antes da apresentação. Teste concorrente insere atividade/problema entre queries e comprova que todos os totais do dataset usam o mesmo snapshot.
- [ ] 7.16 Medir planos das novas consultas keyset/agregadas em volume representativo. Só criar revision aditiva de índice se `EXPLAIN`/SLO provar necessidade, priorizando padrões reais de `product_activity(product_id,date,turn,id)`, `product_problem(product_id,created_at,id)` e history por activity/timestamp. Testar escrita/size/rollback do índice e não criar índices duplicados do snapshot real.

### Gate 7

- Goldens de todos os endpoints aprovados.
- Mesmas transições, históricos, ordenações e agregações.
- Uma única matriz de status governa API/dashboard/relatórios/tools; `pending`/`off` têm decisão explícita e testada.
- Zero taxa de resolução estimada, top-5 instável ou filtro apenas ecoado; métricas não suportadas aparecem como indisponíveis, não como número.
- Datasets correlatos são consistentes no mesmo snapshot e carregam `metricVersion`, sourceKind, período, filtros e checksum.
- Transações read-only terminam antes de LLM/render e os planos de queries/indexes aprovados atendem o volume representativo sem lock prolongado.
- p95 do slice Python não excede Node em mais de 20% nem o SLO absoluto definido na fase 14.

---

## Fase 8 — Migrar uploads, downloads, PDFs e e-mail de domínio

### Passos

- [ ] 8.1 Portar armazenamento de arquivos com `Path.resolve()` e verificação de pertencimento ao root.
- [ ] 8.2 Processar multipart em streaming com limite 4 MiB; rejeitar múltiplos arquivos quando o contrato aceita um.
- [ ] 8.3 Portar Pillow com `ImageOps.exif_transpose`, validação por decode, proteção contra decompression bomb e saída WebP.
- [ ] 8.4 Usar escrita temporária no mesmo filesystem, flush + `fsync` do arquivo no runtime Linux de produção e rename atômico; remover temporário em erro/cancelamento. O teste Windows deve validar a mesma atomicidade suportada pelo filesystem, sem relaxar o fluxo de produção.
- [ ] 8.5 Preservar cache immutable de download, MIME e comportamento 404.
- [ ] 8.6 Portar exclusão de arquivo de forma idempotente conforme golden e garantir que DB não aponte para arquivo removido após rollback de transação.
- [ ] 8.7 Portar PDFKit para ReportLab mantendo A4, cores, fontes base Helvetica, margens, tabelas, quebra e quatro builders.
- [ ] 8.8 Comparar texto, páginas e renders. Diferenças de metadados/compactação são permitidas; perda/overflow de conteúdo não. Renderer interrompe antes de publicar se exceder 200 páginas ou 20 MiB e retorna `ARTIFACT_TOO_LARGE` com texto preservado.
- [ ] 8.9 Testar caracteres portugueses, listas vazias, centenas de linhas, quebra de página e nenhum blank page.
- [ ] 8.10 Portar e-mails de mudança de senha/e-mail e atividade pendente; comparar captura SMTP.
- [ ] 8.11 Montar o mesmo volume em web/API Python e executar teste end-to-end de upload, SSR image, download, delete e PDF.
- [ ] 8.12 Separar `PdfRenderer` puro de `PdfArtifactStore`: renderer aceita somente um dos quatro schemas de dataset validados mais metadata server-side; store escolhe diretório/nome, faz temporário+rename/checksum e retorna URL allowlisted. Nenhuma camada aceita path, filename, HTML ou template do usuário/LLM.
- [ ] 8.13 Implementar `AiArtifactRepository` com state machine `pending→ready|failed`, claim atômico por hash unique, owner token e lease. Concorrente perdedor aguarda bounded ou devolve o ready existente; lease vencido pode ser retomado. Update ready só ocorre após arquivo final/checksum; erro após rename é reparado pelo reconciler usando nome determinístico e checksum. No commit final, inserir user+assistant e atualizar artifact `WHERE owner_token=:owner AND attached_at IS NULL` com thread/message/`attachedAt` na mesma transação; update zero significa que outro request venceu e a resposta já persistida deve ser carregada, não duplicada.
- [ ] 8.14 Implementar comando/job periódico de reconciliação com dry-run e lock: remover temporários/failed/pending vencidos conforme política; verificar existência/tamanho/SHA de ready; reparar rename→DB quando seguro; marcar falha quando não; apagar ready sem `attachedAt`/FK somente após 24 h e artifact de mensagem deletada conforme retenção aprovada. Nunca varrer fora de `uploads/reports` nem seguir symlink.
- [ ] 8.15 Adicionar golden provando que o PDF usa o mesmo dataset/checksum do JSON, chart e resposta; cobrir duas gerações concorrentes com a mesma/diferente `X-Idempotency-Key`, processo interrompido antes/depois do rename/update DB/attach, pending vencido, arquivo ausente/corrompido, volume cheio/read-only, thread apagada e cleanup/reconciliação idempotente.

### Gate 8

- Corpus de upload aprovado e sem path traversal/symlink escape.
- PDFs visualmente aprovados.
- Renderer/store separados, quatro schemas validados e igualdade numérica com datasets canônicos comprovada.
- State machine/lease/idempotência do artifact aprovada sem duplicata ou referência a arquivo ausente.
- Nenhum arquivo órfão nos testes de falha.
- Frontend `next/image` e route handler de uploads funcionam sem alteração de URL.

---

## Fase 9 — Migrar Kafka REST usado pela API e dataflow/ecFlow

### Passos

- [ ] 9.1 Implementar cliente async REST com os mesmos endpoints e media types.
- [ ] 9.2 Tratar `base_uri` absoluto/relativo, auth header, timeouts e corpo de erro redigido.
- [ ] 9.3 Portar `normalizeProductStatus`, clamp, model keys, parser ecFlow, PERT e transformers como funções puras.
- [ ] 9.4 Executar fixtures compartilhadas TypeScript × Python; saída JSON deve ser idêntica após normalização exclusiva de timestamps gerados.
- [ ] 9.5 Portar fallback mock/live e `KAFKA_REST_PROXY_USE_MOCK_DATA` exatamente.
- [ ] 9.6 Garantir remoção da instância REST em `finally`, inclusive timeout/cancelamento.
- [ ] 9.7 Evitar group ids de UI que colidam entre requests simultâneas; preservar prefixo e adicionar sufixo único somente se não alterar offsets esperados.
- [ ] 9.8 Validar `/api/products/:productId/data-flow` e `/api/monitoring/products` com exemplos reais anonimizados.

### Gate 9

- Parser e endpoints sem diff.
- Nenhuma instância consumer órfã após testes de erro.
- Fallback mock e live comprovados.

---

## Fase 10 — Migrar chat REST e WebSocket

### Passos

- [ ] 10.1 Portar `chat-service` mantendo queries, paginação, unread, soft delete, read receipts, sidebar e presença.
- [ ] 10.2 Portar todos os endpoints REST antes do WebSocket; aprovar goldens.
- [ ] 10.3 Implementar `ChatRealtimeHub` no lifespan FastAPI com mapa de sockets e contagem por usuário.
- [ ] 10.4 Autenticar WebSocket pelo `silo_session`, validar chat enabled e permissões.
- [ ] 10.5 Implementar ping/pong/timeout equivalente e cleanup idempotente.
- [ ] 10.6 Publicar evento somente depois de commit bem-sucedido no DB. Se o broadcast falhar, não reverter a mutation já confirmada; logar com request id.
- [ ] 10.7 Preservar payload e ordem de eventos do contrato TypeScript.
- [ ] 10.8 Configurar ingress/reverse proxy para upgrade em `/api/chat/ws`, timeout maior que heartbeat e sem buffering.
- [ ] 10.9 Garantir que `NEXT_PUBLIC_API_ORIGIN` aponte para origem que recebe o cookie. Preferir mesma origem pública com route de upgrade para FastAPI; não ampliar `Domain` do cookie sem necessidade.
- [ ] 10.10 Executar e2e com duas contas, grupo, conversa privada, receipts, delete, presença, reconnect e duas abas.
- [ ] 10.11 Executar soak de 2 h com conexões repetidas e medir sockets/tasks/conexões DB sem crescimento.

### Gate 10

- Todos os eventos e closes do golden aprovados.
- Sem leak em soak.
- Uma única instância Uvicorn explicitamente configurada.

---

## Fase 11 — Migrar o assistente para LangGraph, tools, Ollama e SSE

### Objetivo e fronteiras

Portar o assistente sem confundir orquestrador e provedor: LangGraph controla o workflow e as tools; `ChatOllama`/`OllamaEmbeddings` usam o Ollama local. O resultado deve manter endpoints/DTOs-base do frontend, adicionar apenas `artifacts[]` de forma compatível, eliminar os defeitos listados na seção 1.3 e permitir desativar somente o loop agentic sem retirar LangGraph.

Topologia obrigatória do grafo:

```text
START
  -> guard_and_normalize
  -> understand_and_classify
  -> build_and_validate_plan
       -> refused -> build_refusal
  -> claim_pdf_idempotency_if_needed
       -> attached hit -> load_persisted_result -> emit_result -> END
       -> key reused with different fingerprint -> conflict -> END
       -> new/reclaimed claim
  -> semantic_cache_if_text_only
       -> eligible hit -> persist_cached -> emit_result -> END
       -> artifact/visualization or miss
  -> resolve_entities
       -> ambiguous -> build_clarification -> persist -> emit_result -> END
  -> execute_required_data_tools (DAG, paralelo <= 2)
  -> analyze_and_register_datasets
  -> mode?
       -> deterministic
       -> hybrid -> agent_decide
                       -> supplemental_read_tool -> analyze_supplemental -> agent_decide (limitado)
                       -> no tool
  -> presentation_router
       -> none
       -> build_chart_spec
       -> build_mermaid_diagram
       -> render_summary_image
       -> generate_report_pdf (pedido explícito; fora de bind_tools)
  -> build_grounded_response
  -> synthesize_once
       -> invalid/timeout/error -> grounded_response
  -> validate_output_citations_and_artifacts
       -> invalid -> grounded_response sem artefato inválido
  -> persist_transaction
  -> emit_result
  -> END
```

`build_and_validate_plan` é o dono da sequência. O modelo pode sugerir enriquecimento no modo híbrido, mas não reordenar etapas, remover fonte obrigatória, transformar um problema formal em rodada problemática ou gerar artefato sem dataset. `generate_report_pdf` e as três apresentações puras nunca participam do loop `agent_decide`.

### 11.A — Portas de modelo, embeddings e paridade determinística

- [ ] 11.1 Antes de portar, registrar SHA e diff aprovado de `backfill-embeddings.ts` e `embedding-write-service.ts`; incorporar o truncamento de help em 3.000 caracteres presente nas mudanças do usuário, sem sobrescrevê-las.
- [ ] 11.2 Definir portas `ChatModelRuntime`, `EmbeddingProvider` e `AiRuntimeProbe`; serviços/graphs dependem das portas, não de `ChatOllama`, URL ou payload Ollama concreto.
- [ ] 11.3 Implementar `OllamaModelRuntime` com `ChatOllama`, `temperature=0`, `num_ctx=16384`, output máximo 768 tokens, timeout, semaphore e cancelamento async. Montar seções pelo orçamento de 12.000 bytes UTF-8 da decisão 35 e medir `prompt_eval_count` observado; excesso preflight ou resposta acima do limite vai a fallback. Contabilizar cada invocação; o caminho determinístico normal deve ter exatamente uma chamada de chat.
- [ ] 11.4 Implementar `OllamaEmbeddingProvider` com `OllamaEmbeddings`, cache LRU limitado e timeout. Não misturar cache de chat, cache de scope e cache de embedding.
- [ ] 11.5 Permitir HTTP Ollama direto somente dentro do probe/administrador técnico quando a integração não expuser `/api/show`, `/api/tags` ou keep-alive. Nenhum router, service de domínio, tool ou worker pode usar URL Ollama diretamente.
- [ ] 11.6 Portar probe de chat e embedding separadamente. `/api/ai-assistant/status` continua com `provider="ollama"` e `mode="ollama"|"fallback"`; falha de IA não torna CRUD/worker indisponível nem derruba `/health/ready` global.
- [ ] 11.7 Criar job Compose one-shot `ollama-init` para aguardar servidor, puxar os dois modelos, confirmar nomes/digests e aquecer chat. API não faz pull implicitamente; worker não inicializa modelo. Produção deve pré-provisionar blobs imutáveis e registrar digests.
- [ ] 11.8 Validar cada embedding: exatamente 768 floats, todos finitos, tamanho serializado limitado. Dimensão divergente ou NaN/Infinity falha antes da query; zero vector só é aceito para texto vazio no comportamento explicitamente caracterizado.
- [ ] 11.9 Portar chunking markdown com as fixtures atuais, incluindo limites, overlap, Unicode, headings, conteúdo vazio e texto acima de 3.000 caracteres.
- [ ] 11.10 Portar RAG híbrido sem vector store genérico: pgvector cosseno, pg_trgm, pesos 0,6/0,4, rerank 0,5/0,3/0,2, limite 5, multiplier 3, threshold 0,35 e contexto máximo 2.000 caracteres até nova avaliação.
- [ ] 11.11 Substituir todos os `sql.raw` dinâmicos por bind parameters/tipos pgvector. Testar aspas, backslash, Unicode, payload hostil, limites extremos, NaN/Infinity e explain plan usando índices esperados.
- [ ] 11.12 Portar o classificador em três camadas na ordem atual: keywords/fuzzy, embeddings e somente então modelo estruturado para ambiguidade. O classificador do modelo não recebe tools.
- [ ] 11.13 Portar builders determinísticos de respostas, períodos, comparações, citações e visualizações antes de introduzir seleção agentic. Eles formam o `grounded_fallback` sempre disponível.
- [ ] 11.14 Provar com fake model que cada scope executa os mesmos report/dashboard services e produz o mesmo DTO normalizado, exceto os desvios de segurança/SSE aprovados na Fase 0.

### Gate 11.A

- RAG/rankings/dimensões idênticos nos goldens e SQL totalmente parametrizada.
- Scope, resposta-base, citações e visualizações compatíveis em 100% dos fixtures determinísticos.
- Exatamente uma chamada de chat no caminho determinístico live e zero em cache hit/fallback sem modelo.
- Probe diferencia chat/embedding e nenhuma indisponibilidade de IA para o worker.

### 11.B — Catálogo de tools e fronteiras de segurança

- [ ] 11.15 Definir `ToolResult[T]`, `DatasetManifest`, citations, warnings e códigos de erro estáveis; schemas Pydantic usam `extra="forbid"`, datas/ranges/limites/enums da seção 3.6. Para cada use case criar um único adapter registry/`@tool` compartilhado por nós determinísticos e `bind_tools`, sem bypass de auth/schema. Implementar `ModelRunStatusSemantics` e bloquear startup/teste se YAML, enum Python e status reais conhecidos divergirem. Versionar tudo em `AI_TOOL_CATALOG_VERSION` e `AI_METRIC_VERSION`.
- [ ] 11.16 Implementar o `DatasetRegistry` request-scoped com IDs aleatórios não enumeráveis, canonical JSON, SHA-256, schemas allowlisted, teto 512 KiB por result/8 MiB por run, cleanup em `finally` e APIs `register/get/project`. Contabilizar bytes antes/depois de canonicalização; testar ID de outro run, schema trocado, checksum adulterado, item removido, concorrência e dataset acima do limite.
- [ ] 11.17 Implementar `resolve_models`, `resolve_projects` e `resolve_problem_categories` com busca exata por ID/slug aplicável antes de fuzzy por nome, normalização Unicode, ordem total e resultado ambíguo explícito. Nunca usar primeiro match silenciosamente; IDs resolvidos são os únicos passados às tools seguintes. Excluir “sem incidente” por padrão e não criar `resolve_groups` até existir lookup autorizado + filtro executivo funcional.
- [ ] 11.18 Implementar `list_model_runs` exatamente sobre `product_activity`, joins allowlisted e paginação keyset. Retornar status bruto mais flags semânticas; filtros `didExecute` não incluem `unknown`. Cobrir todos os status, turnos, range inclusivo São Paulo, modelo indisponível, registros históricos e cursor estável sob empate.
- [ ] 11.19 Implementar `summarize_model_runs` e `compare_model_run_periods` com queries agregadas parametrizadas, fórmulas versionadas e período anterior adjacente. Comparação nunca deriva de página truncada; testar divisor zero, conjunto vazio, atualização concorrente e equivalência com dashboard/report corrigidos.
- [ ] 11.20 Implementar `get_model_run_history` e `list_model_interventions`; limitar ator/PII ao contrato autorizado, ordenar por timestamp+id, omitir intervenção vazia, escapar texto e citar a linha de origem. História não pode ser interpretada como execução atual.
- [ ] 11.21 Implementar separadamente `list_problematic_runs`, `list_registered_problems`, `get_registered_problem_details`, `summarize_problems` e `compare_problem_periods`. Exigir `sourceKind` nas agregações/comparações, excluir “sem incidente” segundo regra aprovada, calcular existência/resolução por joins reais e proibir soma automática entre as duas fontes.
- [ ] 11.22 Implementar `get_projects_snapshot`, os quatro `get_*_report_data` e `search_silo_knowledge`. Reusar a camada de aplicação da Fase 7; `get_problems_report_data` não expõe 80% estimado, `get_executive_report_data` aplica grupos ou rejeita filtro, top lists têm ordenação total e RAG mantém `sources`, `limit=1..5` e contexto máximo 2.000.
- [ ] 11.23 Implementar `build_chart_spec` como projeção de DatasetRegistry por `templateId`; validar schema, unidade, série/categoria, máximo 500 pontos/50 categorias/6 séries, finitude, cores, JSON ≤128 KiB e DTO Zod atual via contract fixture. Cobrir bar/line/donut, vazio, truncado, divisor zero e nomes hostis. Nenhum número entra pelo argumento do LLM.
- [ ] 11.24 Implementar `build_mermaid_diagram` e `render_summary_image` por templates determinísticos. Mermaid ≤64 KiB bloqueia `click`, links, init directives e código livre; SVG ≤256 KiB escapa todo texto, não contém script/foreignObject/recurso externo. Validar DTO e render do frontend em browser test.
- [ ] 11.25 Implementar `generate_report_pdf` fora de `bind_tools`: exigir intenção explícita atual, `reports:view`, claim válido de `X-Idempotency-Key`, tipo allowlisted e dataset completo do schema correto. Usar `AiArtifactRepository`/lease da Fase 8, preencher dataset checksum, gerar temporário, fsync/close, rename atômico, file checksum e transição ready. Repetição devolve o mesmo artefato válido; falha remove temporário ou deixa estado reconciliável, nunca uma URL “ready” sem arquivo íntegro.
- [ ] 11.26 Cada tool revalida `reports:view` pelo runtime context, recebe sessão própria e fecha em `finally`; aplicar timeout 20 s, duas DB tools paralelas, limite por resultado/agregado e cancelamento. Testar chamada direta sem usuário, inativo, sem permissão, spoof de ID/context, pool pequeno, timeout, disconnect e falha parcial.
- [ ] 11.27 Criar registry explícito por scope/plano. O catálogo server-side contém somente os nomes da seção 3.6; cada `bind_tools` expõe no máximo seis tools read-only relevantes e nunca apresentação/PDF. Teste de arquitetura/`rg` proíbe SQL/HTTP/filesystem/shell/e-mail/Kafka/mutation genéricos, import direto de router e registro por string vinda do prompt.
- [ ] 11.28 Tratar todos os dados como não confiáveis e executar matriz de segurança/contrato: prompt injection em pergunta/histórico/help/manual/problema/solução/nomes; argument smuggling; IDOR de dataset/atividade/problema; cursor adulterado; SVG/Mermaid injection; path traversal; PDF duplicado; números inventados e sourceKind trocado. Resultado: zero acesso proibido, zero artefato inseguro, zero segredo/PII adicional e fallback tipado.

### Gate 11.B

- 100% das chamadas sem permissão ou fora da allowlist recusadas antes de DB/arquivo/rede.
- 100% dos argumentos inválidos rejeitados pelos schemas; nenhuma tool aceita parâmetro extra.
- 100% dos casos “rodou/incidente/problema formal” usam status/sourceKind corretos; zero métrica fixa/estimada apresentada como fato.
- Chart/image/Mermaid reproduzem o dataset e passam schema, escaping e render; PDF é idempotente, atômico, usa o mesmo checksum e nunca é selecionável pelo modelo.
- Zero tool de acesso genérico presente; registry completo e allowlists por scope aprovados por teste de arquitetura.
- Sem sessão/conexão vazada em sucesso, timeout, cancelamento ou falha parcial.

### 11.C — Grafo LangGraph explícito

- [ ] 11.29 Definir `AgentState` via `TypedDict`/dataclass com: pergunta normalizada, thread/history/memory, scope/confidence, `ExecutionPlan`, entidades, ranges/sourceKinds, manifestos de dataset, required/supplemental results compactos, artifact intents/results, cache, contadores, resposta-base/final, citations, visualization, generation, progresso, erros e `RemainingSteps`. Reducers de listas usam IDs/chaves e ordem determinística, nunca concatenação implícita duplicável.
- [ ] 11.30 Definir `AgentRuntimeContext` separado com user id, permissões, request/run id, clock, session factory, DatasetRegistry, semaphore, cancel token e portas. Criar teste provando que state serializado não contém segredo, cookie, dados brutos, DB session, registry ou cliente.
- [ ] 11.31 Versionar grafo, prompt e catálogo por constantes imutáveis. Toda alteração futura em node/edge/prompt/tool que mude resposta incrementa a versão e invalida cache correspondente.
- [ ] 11.32 Implementar cada caixa do diagrama como nó pequeno, com retorno parcial de state; edges de autorização, scope, cache eligibility, dependência, ambiguidade, modo, apresentação, loop e fallback são funções puras testáveis. Emitir somente mensagens de progresso fixas da seção 3.7.
- [ ] 11.33 `guard_and_normalize` valida tamanho, whitespace, thread ownership e permissão antes de embedding/model/tool; inicia deadline, orçamento e run ID. `understand_and_classify` normaliza follow-up, timezone, período e intenção de apresentação sem aceitar instruções do histórico como autorização.
- [ ] 11.34 `build_and_validate_plan` produz schema `ExecutionPlan` e DAG de dependências. Em deterministic usa regras; em hybrid valida qualquer sugestão contra scope/catálogo. Deve inserir resolução de entidade, separar sourceKinds, escolher query agregada para totais/artefatos, deduplicar chamadas e terminar em recusa/clarificação quando necessário.
- [ ] 11.35 `claim_pdf_idempotency_if_needed` roda imediatamente após o plano: valida UUID, cria/busca hash `user+key+operation`, compara fingerprint e adquire/reclama lease; artifact já anexado carrega a mensagem persistida e encerra sem tools/modelo/writes. Depois, `semantic_cache_if_text_only` consulta cache só para plano textual: PDF, chart, image, Mermaid, follow-up com thread e pedido de freshness são inelegíveis; hit exige usuário/scope/versions/modelo/ranges/sourceKinds iguais e nunca cria artefato de resposta cacheada.
- [ ] 11.36 `resolve_entities` usa resolvers tipados. Zero match produz resposta factual vazia; match ambíguo produz clarificação com opções limitadas e não executa coleta/artefato. IDs no prompt nunca contornam autorização/validação.
- [ ] 11.37 `execute_required_data_tools` percorre a DAG, máximo duas DB tools paralelas, sessões independentes e merge por step ID. O validador reserva dentro do teto de oito chamadas obrigatórias os passos posteriores de chart/image/Mermaid/PDF; portanto coleta não pode consumir slots de apresentação já planejados. Fonte essencial que falha bloqueia dependentes; falha opcional é warning explícito. Registrar DatasetManifest em ordem estável.
- [ ] 11.38 `analyze_and_register_datasets` executa agregações/comparações determinísticas, confirma completude/sourceKind/unidades e cria os datasets derivados. `build_grounded_response` fica pronto antes da síntese e contém todos os fatos/citations que o LLM poderá usar.
- [ ] 11.39 No modo `hybrid`, `agent_decide` usa `bind_tools` somente para dados suplementares compatíveis com o plano. Validar novamente, executar, analisar e retornar `ToolMessage` delimitada; sem chamada válida segue adiante. O modelo nunca devolve diretamente artifact args, números canônicos ou resposta terminal não verificada.
- [ ] 11.40 Impor em código: 8 tools obrigatórias, 2 rodadas/4 suplementares, 12 totais, 3 model calls, 24 supersteps e 90 s total; uma assinatura `toolName+canonicalArgs` só executa uma vez. `RemainingSteps`/deadline roteiam preventivamente ao grounded fallback; capturar recursion, timeout e cancelamento sem loop.
- [ ] 11.41 `presentation_router` executa no máximo uma visualização entre chart, image e Mermaid conforme o DTO atual, além de no máximo um PDF explícito em `artifacts`; combinação visualização+PDF só quando a mensagem atual pede ambas. Todos referenciam DatasetRegistry e falha de apresentação não destrói texto validado.
- [ ] 11.42 `synthesize_once` usa structured output `{answer,contextSummary}` sem `thinking`, recebe apenas resposta-base/manifests compactos e não pode alterar números/citations. `validate_output_citations_and_artifacts` compara fatos com datasets, verifica URLs/checksums/schema/tamanho e remove output inválido; falha volta à resposta-base sem nova chamada.
- [ ] 11.43 Compilar o grafo uma vez no lifespan, **sem checkpointer**. Não chamar `.setup()`, não criar tabelas `checkpoint*` e não usar `threadId` da aplicação como cursor LangGraph persistente.
- [ ] 11.44 Em testes, compilar grafo novo com fakes por caso; snapshot do `ExecutionPlan` e trajetória exata; testar nós/edges isolados, DAG paralela, resolução ambígua, sourceKinds, apresentação simples/combinada, execução parcial, todas as terminações, cache inelegível, limite 8+4/24 e ordem de merge.

### 11.D — Threads, cache, persistência e adaptador SSE

- [ ] 11.45 Portar threads/mensagens mantendo `ai_assistant_thread` e `ai_assistant_message` como fonte única, limite de 25 mensagens, ownership e exclusão/reconciliação de artifacts PDF. Persistir somente DTO público validado de visualização/artifact e metadata sanitizada; não persistir mensagens internas de tool como chat público.
- [ ] 11.46 Mover consulta de cache para depois do `ExecutionPlan`. Servir somente a `userId` correspondente, thread nova/vazia e plano exclusivamente textual; exigir metadata com `graphVersion`, `promptVersion`, `toolCatalogVersion`, `metricVersion`, chat/embedding model, scope, ranges e sourceKinds idênticos. Qualquer intenção de chart/image/Mermaid/PDF é cache miss obrigatório.
- [ ] 11.47 Registros antigos sem assinatura permanecem histórico, mas são cache miss. TTL inicial continua 6 h e threshold 0,90; qualquer mudança exige avaliação de freshness.
- [ ] 11.48 Persistir em metadata interna apenas trajetória sanitizada: hash/versão do plano, nomes/status/duração/counts de tools, sourceKinds, dataset schema/checksum/rowCount sem conteúdo, artifact kind/checksum e versões. Não persistir argumentos/results brutos, IDs sensíveis ou reasoning. Manter campos públicos legados opcionais compatíveis.
- [ ] 11.49 No endpoint sync, executar grafo e persistir user+assistant, contador e attach do artifact em uma transação, então responder. Em plano PDF, somente o owner do claim com `attachedAt IS NULL` pode inserir as mensagens; retry/concorrente carrega o `messageId` já anexado e devolve o mesmo DTO. Falha de embedding pós-resposta continua não revertendo mensagem, mas é observada/retryável.
- [ ] 11.50 No SSE, a rota é a única dona de `connected` e heartbeat. Traduzir etapas internas para `scope` e somente as mensagens de progresso allowlisted da seção 3.7; LangGraph event names, planos, IDs de dataset, state e tool/artifact payloads nunca atravessam a API.
- [ ] 11.51 Antes de `result`, persistir user+assistant/thread e attach de artifact aplicável em transação e confirmar commit. Em cache hit ou retry PDF já anexado seguir a mesma regra de resposta única sem reinserir. Após headers, falha terminal gera um único `error`; nunca `data/complete` no contrato novo.
- [ ] 11.52 Manter o frontend capaz de ler `data/complete` durante rollback Node, mas testar que Python sempre usa `result|error`. Eventos desconhecidos continuam ignorados sem engolir evento `error`.
- [ ] 11.53 Cancelar graph/model/tools no disconnect. Se não houve commit/PDF, não persistir; se PDF já concluiu, registrar artefato idempotente e cleanup/reconciliação; documentar cada boundary em teste.
- [ ] 11.54 Preservar DTO `AiAssistantRuntimeStatusDto` e `AiAssistantGenerationDto`: `provider/model` descrevem Ollama; `status=fallback` descreve fallback. Expor orquestrador apenas em header diagnóstico interno/metadado opcional não consumido pelo web.
- [ ] 11.55 Instrumentar por request/run sem conteúdo: duração por nó/tool/model, contagens, cache, scope, modo, versions, fallback/error/cancel. Confirmar `LANGSMITH_TRACING=false` e fazer teste de redaction.
- [ ] 11.56 Portar backfill como comando idempotente, paginado, retomável, rate-limited e com dry-run; validar truncamento de help, dimensão e model digest. Nunca executar automaticamente no deploy.

### 11.E — Avaliação, habilitação agentic e rollback

- [ ] 11.57 Rodar os 210+ casos com fake model para planos/trajetórias exatas: required tools 100%, sourceKind/status semantics 100%, artefatos/checksums 100%, forbidden tools 0, terminação 100%, cache isolation/eligibility 100%, SSE terminal 100% e chamadas dentro de 8 obrigatórias+4 suplementares/24 supersteps.
- [ ] 11.58 Rodar o corpus no Ollama real/digest fixo três vezes por caso em hardware registrado. Salvar somente scores/trajectory sanitizada, nunca conteúdo de produção.
- [ ] 11.59 Aprovar modo `deterministic` se: scopes compatíveis com goldens, 100% das fontes obrigatórias consultadas, zero número inventado no subconjunto factual, 100% citations válidas, >=97% conclusão sem erro e p95 de primeira emissão/final dentro do baseline Node +20% ou exceção aprovada.
- [ ] 11.60 Aprovar modo `hybrid` somente se, nas no mínimo 630 execuções (210 casos × 3): zero chamada proibida/sem permissão, 100% tool args executados válidos, 100% separação de sourceKind, 100% artefatos numericamente iguais ao dataset, >=98% recall de tools obrigatórias, >=95% trajetória aceitável, >=95% citations cobrindo afirmações verificáveis, zero exfiltração/prompt/artifact injection e p95 <= modo determinístico +30%.
- [ ] 11.61 Se o modelo atual falhar 11.60, registrar casos e manter `AI_AGENT_MODE=deterministic`. Não trocar modelo, aumentar recursos ou relaxar limiar nesta migração. LangGraph/tools continuam em produção com edges determinísticas.
- [ ] 11.62 Se passar, habilitar `hybrid` somente em staging por coorte estável 5% -> 25% -> 100%, mínimo 24 h em cada estágio, com comparação de fallback, tools, ground truth, latência e recursos. Qualquer violação volta imediatamente a deterministic.
- [ ] 11.63 Testar rollback operacional alterando apenas `AI_AGENT_MODE=deterministic` e reiniciando API graciosamente; threads/cache continuam legíveis porque não há checkpoint. Depois testar rollback completo para API Node.

### Gate 11 final

- Gates 11.A e 11.B aprovados e grafo termina em todos os caminhos.
- Todos os endpoints/DTOs e o SSE reparado são compatíveis com frontend e rollback.
- Sem cache cross-user, reasoning, tool proibida, SQL dinâmica, loop ilimitado, dupla síntese ou resultado emitido antes do commit.
- Perguntas sobre execuções/problemas distinguem status bruto, rodada problemática e problema formal; nenhum relatório publica resolução estimada ou filtro não aplicado.
- Chart/image/Mermaid/PDF são gerados somente depois da coleta/análise, usam dataset/checksum verificável e permanecem compatíveis com o frontend atual.
- Rankings/dimensões/backfill validados; timeout/cancelamento não deixa task, transação, conexão ou arquivo órfão.
- `deterministic` está aprovado. `hybrid` fica marcado explicitamente `APROVADO` ou `DESABILITADO POR GATE 11.60`; nunca fica em estado ambíguo.

### Rollback da fase

1. Para problema apenas de seleção agentic, definir `AI_AGENT_MODE=deterministic`, reiniciar uma instância por vez e executar smoke SSE/cache/tools.
2. Para problema do grafo/provider/persistência, retirar API Python da rota e usar API Node reparada; não alterar DB nem apagar mensagens/checkpoints, pois nenhum checkpoint existe.
3. Invalidar cache por incremento de `AI_GRAPH_VERSION`; não deletar histórico de usuário.
4. Registrar trajectory/version/model digest e repetir 11.57–11.63 antes de reabilitar.

---

## Fase 12 — Migrar o worker Kafka

### Passos

- [ ] 12.1 Portar config e resolução de tópicos.
- [ ] 12.2 Portar create/subscribe/fetch/commit/delete/produce REST com fake server que registra ordem exata das chamadas.
- [ ] 12.3 Portar normalização do record e message id.
- [ ] 12.4 Implementar deduplicação com `INSERT ... ON CONFLICT DO NOTHING RETURNING`; se nada for inserido, não executar handler.
- [ ] 12.5 Garantir que dedup insert e handler compartilham a mesma transação e commit.
- [ ] 12.6 Portar handler `model.*`, mantendo lookup por productId/slug e append de `dataProductFlow`.
- [ ] 12.7 Portar handler `monitoring.*`, mantendo aliases e update parcial.
- [ ] 12.8 Preservar no-op de tópico desconhecido.
- [ ] 12.9 Implementar retry exponencial e DLQ conforme invariantes.
- [ ] 12.10 Implementar shutdown cooperativo e deletion REST.
- [ ] 12.11 Testar offsets acima de `2^53`, múltiplas partitions, value objeto/string/null, duplicates concorrentes, DB indisponível, REST 4xx/5xx/timeout e SIGTERM durante handler.
- [ ] 12.12 Executar comparação Node × Python contra bancos clonados A/B com as mesmas fixtures; comparar tabelas, DLQ e sequência de commits.
- [ ] 12.13 Criar modo de validação isolado com group id exclusivo e banco descartável. Não criar “dry-run” que ainda comite offsets reais.
- [ ] 12.14 Adicionar health interno do worker: timestamp do último poll bem-sucedido, último erro e in-flight; Docker healthcheck deve falhar se o loop travar além do limite configurado.
- [ ] 12.15 Medir throughput e lag em staging com volume representativo.
- [ ] 12.16 Não portar `apps/worker/src/lib/ollama-init.ts` para o worker Python. Confirmar por `rg` que nenhum processor/handler usa LLM ou embeddings; remover `OLLAMA_*`, LangGraph e LangChain do ambiente/import graph do processo worker.
- [ ] 12.17 Fazer o worker depender somente de DB/Kafka REST e do próprio config. Reiniciar/indisponibilizar Ollama durante teste de consumo e provar que poll, handler, DLQ, commit e health continuam normais.
- [ ] 12.18 Validar que o job one-shot `ollama-init` da Fase 11 é independente do worker e que falha/pull lento não causa rebalance ou atraso Kafka.

### Gate 12

- Todos os testes de caracterização Node e Python aprovados.
- Zero diferença de side effect não justificada.
- Shutdown remove consumer e não perde registro in-flight.
- Nunca houve dois workers no mesmo grupo durante o teste.
- Worker não contém import, variável, dependência ou chamada de LangGraph/LangChain/Ollama.

---

## Fase 13 — Reconciliar o frontend e contratos TypeScript

### Objetivo

Eliminar acoplamentos de runtime Node no web sem redesenhar a UI.

### Passos

- [ ] 13.1 Rodar todos os testes web apontando para API Python.
- [ ] 13.2 Validar SSR, client fetch, proxy `/api/admin`, basePath `/silo` e base vazia.
- [ ] 13.3 Substituir `getSessionCookie` do Better Auth no proxy por detecção explícita dual-cookie durante rollback; validação real continua na API.
- [ ] 13.4 Remover uso de Better Auth React depois que nenhum import restante existir; manter pacote até o fim do rollback apenas se o bundle legado ainda precisar.
- [ ] 13.5 Classificar exports de `packages/engine`:
  - `web-only/shared-contract`: manter;
  - `server-only`: marcar para remoção final;
  - regra usada em web e Python: manter vetores JSON compartilhados, não tentar importar Python no TS.
- [ ] 13.6 Garantir que `apps/web` não importa `@silo/database` — hoje não importa e deve continuar assim.
- [ ] 13.7 Comparar schemas TypeScript gerados do OpenAPI com DTOs manuais. Diferença deve ser resolvida no FastAPI ou no contrato, nunca escondida por `any`.
- [ ] 13.8 Executar fluxos browser: auth completo, usuários, grupos, contatos, produtos, problemas/soluções, projetos/kanban, dashboard, monitoring, relatórios/PDF, chat e assistente.
- [ ] 13.9 Validar uploads e imagens no Next Image em Docker e no deploy público.
- [ ] 13.10 Manter parser SSE dual durante rollback: aceitar Node antigo `data` seguido de `complete` e contrato reparado/Python `result`; em ambos substituir placeholder exatamente uma vez e nunca reportar “stream sem resposta final” após terminal válido.
- [ ] 13.11 Tratar `thinking` somente como progresso opcional. A UI não deve exigir esse evento, renderizar cadeia de pensamento antiga nem persistir estado parcial como mensagem final.
- [ ] 13.12 Testar streams fragmentados em qualquer byte, múltiplas linhas `data:`, heartbeat entre eventos, `connected` duplicado legado, evento desconhecido, `error`, abort e EOF sem terminal. O parser não pode engolir `error` dentro de catch de JSON.
- [ ] 13.13 Preservar `AiAssistantRuntimeStatusDto.provider="ollama"`; não obrigar o web a conhecer LangGraph, tool calls ou nomes de nós nesta migração.
- [ ] 13.14 Não renderizar argumentos/results de tools. Citações, visualização e artifacts continuam vindo apenas no DTO final validado.
- [ ] 13.15 Adicionar de modo compatível `AiAssistantArtifactSchema` e `artifacts?: AiAssistantArtifactDto[]` aos DTOs de resposta e mensagem: nesta versão somente `{kind:"pdf",url,filename,title,mimeType:"application/pdf"}`, array máximo 1, URL same-origin allowlisted e strings limitadas. Não transformar PDF em um tipo de imagem no contrato novo.
- [ ] 13.16 Atualizar persistência/serialização/SSE e o web para artifacts ausente, vazio e um PDF. O frontend deve renderizar botão de abrir/baixar com filename seguro, sem `dangerouslySetInnerHTML`, e manter `visualization` independente para suportar gráfico+PDF na mesma mensagem.
- [ ] 13.17 Durante coexistência, publicar o web tolerante antes da API Python. Para pedido exclusivamente PDF, aceitar o legado Node `visualization.image` e o novo `artifacts`; deduplicar por URL/filename. Para pedido combinado vindo do Python, renderizar uma visualização mais o PDF. Não exigir que Node seja retroativamente alterado para emitir `artifacts`.
- [ ] 13.18 Manter Mermaid em `securityLevel:"strict"` e definição inserida por `textContent`, nunca template `innerHTML`; testar `isSafeImageSource`, URL de PDF e Mermaid contra `javascript:`, `data:text/html`, host externo, path traversal, URL dupla-encoded, SVG/script e directives. PDF só aceita rota local `/api/upload/serve/reports/` ou caminho público equivalente normalizado; imagem data URI só aceita MIME/tamanho previstos.
- [ ] 13.19 Executar e2e do assistente para: chart sozinho, image-resumo, Mermaid, PDF sozinho Node/Python, chart+PDF Python, falha de artefato com texto preservado, reload da thread e download após rollback. Validar acessibilidade, dark mode, basePath vazio/`/silo` e zero erro de schema/console.
- [ ] 13.20 O web gera `X-Idempotency-Key` UUID a cada clique de envio, mantém a mesma chave durante retry/reconexão da mesma mensagem e cria nova chave para novo envio intencional. Enviar no POST sync/SSE, permitir o header no CORS/proxy e testar Node ignorando-o, Python exigindo-o somente quando o plano contém PDF, duas abas e duplo clique.

### Gate 13

```powershell
npm run typecheck:web
npm run lint:web
npm run test:web
npm run build:web
```

Mais todos os e2e aprovados nos dois basePath e nenhum erro no console/rede.

Adicionar ao gate: cache hit, live deterministic, live hybrid quando aprovado, fallback sem Ollama e disconnect devem deixar exatamente uma mensagem final ou nenhuma, conforme o boundary de commit.

Adicionar ao gate: Node sem `artifacts` e Python com `artifacts` passam o mesmo web; chart/image/Mermaid/PDF e chart+PDF são renderizados sem URL insegura, duplicação ou abuso do tipo `image`.

Adicionar ao gate: retry/duplo clique com a mesma chave produz uma mensagem/um PDF conforme contrato; novo envio recebe chave nova e não é deduplicado indevidamente.

---

## Fase 14 — Hardening, carga, segurança e infraestrutura final

### Passos

- [ ] 14.1 Executar suíte total Node, Python e web em CI Linux e ambiente Windows suportado.
- [ ] 14.2 Exigir cobertura Python total >=90%; auth, permissions, worker processor e uploads >=95%. Todo endpoint deve ter ao menos um integration test.
- [ ] 14.3 Rodar scanner de dependências/SBOM em `uv.lock` e `package-lock.json`; bloquear vulnerabilidade crítica/alta sem exceção documentada.
- [ ] 14.4 Revisar auth, CSRF, CORS, cookies, proxy headers, open redirect OAuth, brute force, session fixation e privilege escalation.
- [ ] 14.5 Fuzz de upload/path, JSON profundo/grande, query strings, UUIDs inválidos e WebSocket frames.
- [ ] 14.6 Garantir que logs/traces não contêm secrets, PII desnecessária, prompt, histórico, tool arguments/results ou reasoning.
- [ ] 14.7 Carga com mix realista. SLO inicial em staging:
  - health p95 <100 ms;
  - CRUD simples p95 <500 ms;
  - dashboard/report JSON p95 <2 s;
  - primeira emissão SSE dentro do limite Node +20%;
  - assistente deterministic final p95 <= Node reparado +20%; hybrid, se aprovado, <= deterministic +30%;
  - zero execução acima de 8 tools obrigatórias, 4 suplementares, 12 totais, 3 model calls, 24 supersteps ou 90 s;
  - zero prompt/tool result/registry/chart/Mermaid/SVG/PDF acima dos limites vinculantes e zero OOM;
  - erro HTTP <1% excluindo 4xx esperados;
  - zero erro de pool/transaction;
  - Python não piora p95 Node em >20% sem justificativa aprovada.
- [ ] 14.8 Testar 24 h de soak de API/WS/worker em staging.
- [ ] 14.9 Definir limites de CPU/memória, graceful timeout e stop grace period maior que maior handler esperado.
- [ ] 14.10 Atualizar Compose final:
  - `api` usa target Python e porta 4000;
  - `worker` usa target Python;
  - `migrate` one-shot;
  - `ollama-init` one-shot independente, com modelos de chat/embedding e digests registrados;
  - healthchecks de db/api/worker;
  - web mantém `API_URL=http://api:4000`;
  - mesmo volume de uploads;
  - secrets por ambiente, não baked na imagem.
- [ ] 14.11 Atualizar `env.example`, README, docs 00–16, diagramas, operação, backup, migrations, logs, Kafka e deploy.
- [ ] 14.12 Atualizar `.github/instructions` que ainda descrevem Express/Drizzle/worker Node.
- [ ] 14.13 Atualizar `.gitlab-ci.yml`, `.github/workflows/ci.yml`, `vercel.json`, root scripts e Docker docs. Vercel deve construir somente o web.
- [ ] 14.14 Pin de imagens base e externas por tag exata e digest aprovado; registrar processo mensal de atualização fora da migração.
- [ ] 14.15 Fazer threat model específico do agente: prompt injection direta/indireta, tool confusion, argument smuggling, cross-user cache, IDOR de atividade/problema/dataset, excessive agency, loop/DoS, context poisoning, data exfiltration, números inventados, sourceKind confusion, SVG/Mermaid/output injection, path/URL injection e PDF duplicado/órfão.
- [ ] 14.16 Executar chaos com Ollama fora do ar/lento/malformed/disconnect, embedding de dimensão errada, tool timeout, DB pool esgotado, dataset registry cheio/corrompido, renderer inválido, volume de PDF cheio/read-only, `GraphRecursionError`, cancelamento SSE e resposta estruturada inválida. Cada caso deve terminar no fallback/error previsto sem leak nem artefato inconsistente.
- [ ] 14.17 Criar dashboard/alertas locais para `ai_graph_runs_total`, duração, mode, fallback/error, cache hit, tool calls obrigatórias/suplementares/denials/timeouts, sourceKind, dataset/artifact status, model calls, recursion guard e SSE disconnect. Labels nunca incluem pergunta, user id bruto, thread id bruto, dataset id ou conteúdo.
- [ ] 14.18 Auditar lock/licenças/CVEs de LangGraph, LangChain Core, langchain-ollama e transitivas; SBOM deve distinguir dependências apenas da API das do worker.
- [ ] 14.19 Confirmar por teste de imagem/import graph que o processo worker não importa/carrega LangGraph/LangChain e que a API não inicia tracing externo.

### Gate 14

- CI verde, segurança sem high/critical, carga e soak aprovados.
- Runbook e rollback ensaiáveis por pessoa que não escreveu a migração.

---

## Fase 15 — Ensaio completo em staging

### Passos

- [ ] 15.1 Restaurar cópia recente e sanitizada de produção em staging.
- [ ] 15.2 Executar `migrate`, verificar head/fingerprint e iniciar API Python.
- [ ] 15.3 Manter worker Node inicialmente; apontar web staging para API Python e executar smoke/e2e.
- [ ] 15.4 Validar login de contas existentes; confirmar reset de sessão e re-login.
- [ ] 15.5 Capturar offsets/lag do worker Node por tópico/partition.
- [ ] 15.6 Enviar SIGTERM, aguardar `in-flight=0` e confirmação de consumer REST deletado.
- [ ] 15.7 Iniciar worker Python com mesmo group id; confirmar primeiro offset esperado e processar lote controlado.
- [ ] 15.8 Validar tabelas dedup, side effects, DLQ e lag.
- [ ] 15.9 Executar rollback ensaiado:
  1. parar worker Python graciosamente;
  2. confirmar offsets;
  3. iniciar worker Node;
  4. trocar API/web para Node;
  5. realizar login legado e smoke;
  6. confirmar que migrations aditivas não quebraram Node.
- [ ] 15.10 Reexecutar cutover para Python e manter staging 7 dias.
- [ ] 15.11 Iniciar assistente em `AI_AGENT_MODE=deterministic`; executar corpus, e2e cache/live/fallback/PDF e pelo menos 24 h de carga/uso controlado antes de qualquer hybrid.
- [ ] 15.12 Se e somente se Gate 11.60 estiver aprovado, executar coortes hybrid 5%, 25% e 100% com 24 h em cada estágio. Coorte é hash estável server-side; body do usuário não escolhe modo.
- [ ] 15.13 Em cada estágio comparar planos, required/supplemental tools, sourceKinds/status flags, respostas factuais, citations, datasets/checksums, chart/image/Mermaid/PDF, p50/p95/p99, CPU/RAM/VRAM, model calls, fallback e timeouts. Divergência factual/artefato inseguro volta para deterministic e reinicia o gate.
- [ ] 15.14 Reiniciar API no meio de uma conversa e provar continuidade pelo histórico PostgreSQL sem checkpoint. Confirmar ausência de tabelas `checkpoint*`/writes automáticos.
- [ ] 15.15 Derrubar Ollama durante API+worker: API CRUD/worker permanecem saudáveis, status de IA mostra fallback e assistente retorna resposta-base/erro previsto; restaurar e confirmar recovery sem restart do worker.

### Gate 15

- Cutover e rollback completos, cronometrados e com evidência.
- RTO observado <=15 min.
- RPO 0 para DB/offsets nos cenários testados.
- Sete dias sem incidente alto em staging.
- Modo de produção decidido e registrado como `deterministic` ou `hybrid aprovado`; ausência dessa decisão bloqueia cutover.

---

## Fase 16 — Cutover de produção

### Pré-condições go/no-go

- [ ] Backup feito e restore testado nos últimos 7 dias.
- [ ] Imagens imutáveis de Node e Python identificadas por digest.
- [ ] Acesso para trocar route/Compose e contatos de rollback disponíveis.
- [ ] Não há migration destrutiva.
- [ ] Não há incidentes abertos de DB/Kafka/Ollama/SMTP.
- [ ] `AI_AGENT_MODE` final, `AI_GRAPH_VERSION`, prompt/tool catalog versions, Ollama image digest e model digests são os mesmos aprovados em staging.
- [ ] Gate 11 marca hybrid explicitamente aprovado ou desabilitado; produção nunca assume hybrid por default implícito.
- [ ] Usuários foram avisados do re-login e possível reenvio de OTP.
- [ ] Janela de baixa atividade aprovada.

### Sequência exata

1. [ ] Declarar início e congelar deploys.
2. [ ] Registrar métricas baseline: taxa, p50/p95/p99, 5xx, conexões DB, WebSockets, worker lag e offsets.
3. [ ] Fazer backup final e validar arquivo/listagem.
4. [ ] Construir/puxar imagens já testadas; não buildar código diferente no servidor.
5. [ ] Executar serviço `migrate`; exigir exit 0, `alembic current --check-heads` e fingerprint.
6. [ ] Executar `ollama-init`; exigir chat/embedding models e digests aprovados. Falha bloqueia IA, mas não autoriza trocar tag/modelo.
7. [ ] Subir API Python em porta/serviço paralelo sem tráfego público; testar `/health/live`, `/health/ready`, status IA e smoke interno.
8. [ ] Confirmar `AI_AGENT_MODE` explícito. Começar em `deterministic`; hybrid só segue a coorte/decisão aprovada, nunca 100% diretamente.
9. [ ] Trocar web/ingress para API Python mantendo API Node parada ou fora de rota, mas disponível para rollback.
10. [ ] Expirar cookies Better Auth nas respostas de auth e confirmar login Python em admin e usuário comum.
11. [ ] Testar GET e uma mutation reversível em cada domínio, upload/download, PDF, WebSocket, SSE live/cache/fallback e isolamento entre duas contas.
12. [ ] Parar worker Node com SIGTERM; aguardar in-flight zero e consumer deletado.
13. [ ] Registrar offsets confirmados.
14. [ ] Subir worker Python com o mesmo group id e tópicos; ele não aguarda Ollama.
15. [ ] Confirmar primeiros offsets, dedup e redução/estabilidade do lag.
16. [ ] Observar intensivamente por 2 h, depois continuamente por 24 h.

### Critérios de rollback imediato

Executar rollback se qualquer um ocorrer e não for resolvido em 10 minutos:

- corrupção, perda ou duplicação não idempotente de dados;
- worker commitando após falha de handler/DLQ;
- lag cresce continuamente por 15 min;
- erro 5xx >2% por 5 min ou +0,5 ponto percentual sobre baseline;
- p95 >2x baseline por 10 min;
- falha de login generalizada, privilege escalation ou falha CSRF/CORS crítica;
- WebSocket/SSE indisponível para maioria dos usuários;
- cache ou tool retornando dados de outro usuário, tool proibida executada, prompt injection bem-sucedida, loop acima do orçamento ou reasoning exposto;
- respostas do assistente com números não sustentados no corpus/smoke crítico ou taxa de fallback/erro >5% por 10 min;
- pool de DB esgotado ou migrations fora de head;
- upload/PDF gravando fora do volume ou arquivos inacessíveis.

### Rollback exato

1. [ ] Se o incidente for exclusivamente do modo hybrid e não envolver vazamento/segurança, mudar para `AI_AGENT_MODE=deterministic`, reiniciar graciosamente e executar smoke por no máximo 5 min. Isso é contenção, não encerra o incidente.
2. [ ] Se houver segurança/dados ou a contenção falhar, parar entrada de novas mutations se houver risco de dados.
3. [ ] Parar worker Python graciosamente e registrar offset final.
4. [ ] Iniciar worker Node com mesmo group id; nunca sobrepor os processos.
5. [ ] Retirar API Python da rota e recolocar API Node reparada.
6. [ ] Manter frontend dual-cookie/SSE; usuários Python podem precisar fazer login novamente no Node.
7. [ ] Não executar downgrade Alembic automático. Como migrations da janela são aditivas, Node deve operar com elas.
8. [ ] Validar health, auth, mutation, Kafka, arquivos e assistente sem cache cross-user/reasoning.
9. [ ] Não apagar histórico nem procurar checkpoint LangGraph; não há checkpointer. Invalidar cache apenas por versão.
10. [ ] Abrir incidente com timeline, graph/model/tool versions e trajetória sanitizada. Nova tentativa exige correção e repetição da fase 15.

### Gate 16

- 24 h sem critério de rollback.
- Zero inconsistência de DB/offset.
- Métricas dentro dos limites.

---

## Fase 17 — Observação e remoção do legado Node

### Janela de 14 dias

- [ ] 17.1 Manter imagens/source/tag Node recuperáveis, mas sem tráfego.
- [ ] 17.2 Não executar migration destrutiva nem rehash incompatível.
- [ ] 17.3 Revisar diariamente 5xx, latência, DB, sessions, SMTP, OAuth, WS, SSE, LangGraph mode/versions, tools/denials/loops, cache/fallback, Ollama, Kafka lag/DLQ e storage.
- [ ] 17.4 Executar smoke automatizado diário e restore de backup ao menos uma vez na janela.

### Limpeza após aprovação formal

- [ ] 17.5 Remover `apps/api` Node e `apps/worker` Node.
- [ ] 17.6 Remover `packages/db` Drizzle, `entrypoint-api.sh` e Dockerfiles Node de API/worker.
- [ ] 17.7 Remover scripts root `build/test/lint/typecheck` exclusivos dos workspaces apagados e trocar comandos DB por Alembic/Python.
- [ ] 17.8 Remover Better Auth do web e engine se `rg` confirmar zero imports/uso. Remover cookies legado do proxy em mudança separada.
- [ ] 17.9 Dividir `packages/engine`: manter somente contracts/types/validation/regras realmente usadas pelo web; remover config, auth, email, Kafka e regras server-only já portadas.
- [ ] 17.10 Atualizar `package-lock.json` com `npm install`, revisar diff e executar web completo.
- [ ] 17.11 Atualizar Compose para não conter profiles/serviços legacy nem porta 4001.
- [ ] 17.12 Arquivar goldens Node em `docs/migration/archive/`; manter contract tests canônicos contra Python.
- [ ] 17.13 Habilitar futuras migrations não aditivas somente após backup e PR próprio.
- [ ] 17.14 Gerar relatório final com métricas antes/depois, incidentes, débitos e owners.
- [ ] 17.15 Remover `ollama-init`/env do worker legado e confirmar que somente API/job de infraestrutura dependem de Ollama.
- [ ] 17.16 Manter checkpointer fora de escopo. Se futuramente forem necessários durable execution, HITL ou write tools, abrir ADR/migration próprios para schema, retenção, idempotência, approvals e compatibilidade de graph state.
- [ ] 17.17 Reavaliar se o campo `thinking` legado pode ser removido dos DTOs/UI em PR versionado; até lá ele continua opcional e nunca contém reasoning novo.

### Gate final

```powershell
cd backend
uv lock --check
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest --cov=silo --cov-fail-under=90
uv run --locked alembic current --check-heads
cd ..
npm ci --legacy-peer-deps
npm run typecheck:web
npm run lint:web
npm run test:web
npm run build:web
docker compose build
docker compose up -d
docker compose ps
```

Além dos comandos: e2e completo, worker fixture suite, carga curta, scans e `rg` confirmando ausência de Express/Drizzle/Better Auth no runtime backend/worker.

---

## Estratégia transversal de testes obrigatória

### 5.1 Pirâmide

| Camada | Finalidade | Banco/externos |
|---|---|---|
| Unit | regras puras, serializers, auth, parser, retries | sem rede |
| Contract | Node golden × Python | fixtures determinísticas |
| Integration | queries/transações/migrations | PostgreSQL real pgvector |
| Component | API/worker com fakes HTTP/SMTP/Kafka/Ollama | containers |
| Graph trajectory | nós/edges/tools/limites com fake chat model | sem rede; execução exata |
| Model eval | LangGraph + Ollama real fixado, repetido 3x | hardware/model digest registrados |
| E2E | browser Next + FastAPI | stack completa |
| Load/soak | concorrência, leaks, SLO | staging representativo |

SQLite não pode substituir PostgreSQL em integration tests devido a pgvector, JSONB, quoting, timestamp, constraints e concorrência.

### 5.2 Casos transversais mínimos por endpoint

- request válido mínimo e completo;
- campo ausente, tipo errado, vazio, whitespace, extra e limite;
- não autenticado, inativo, sem permissão e admin;
- recurso inexistente e FK/conflito unique;
- DB indisponível/timeout;
- caracteres Unicode e timezone;
- concorrência para mutations com contador/reorder;
- body/query/path conforme frontend;
- envelope, status, headers e side effects.

### 5.3 Dados e migrations

- upgrade do zero;
- stamp de snapshot existente;
- upgrade do baseline para cada revision;
- `alembic check` vazio;
- backup/restore e checksums;
- seed duas vezes;
- modelo ORM não gera DDL diferente;
- queries em tabelas reservadas e vetores.

### 5.4 Segurança

- cookie roubado/inválido/expirado;
- CSRF cross-origin;
- spoof de forwarded headers;
- brute force distribuído e concorrente;
- OAuth state/nonce/open redirect;
- permission escalation;
- IDOR em chat/thread/project/upload;
- path traversal, symlink, MIME spoof, decompression bomb;
- injection em filtros, vector SQL, Kafka topic e filenames;
- prompt injection direta e indireta em RAG/tool results;
- tool fora de scope, argumento extra, identidade forjada, loop e excessive agency;
- cache cross-user, context poisoning e checkpoint/thread confusion;
- reasoning/prompt/tool payload em SSE, resposta, banco, trace ou log;
- secret redaction.

---

## Matriz transversal de dados e conflitos a verificar

| Tema | Risco | Resolução determinada |
|---|---|---|
| Drizzle push | schema real diverge de migrations | introspectar, baseline Alembic, desativar DDL no startup |
| journal 0–4 vs SQL 5–8 | migrations não refletem pgvector/RAG | fingerprint real inclui extensões/índices 7/8 |
| `timestamp` sem TZ | Python serializa diferente | mapear sem timezone e testar goldens no TZ atual |
| `user`/`group` | palavras reservadas | nomes físicos explícitos/quoted |
| bcrypt >72 bytes | bcrypt Python 5 lança erro | truncamento de bytes somente na compatibilidade bcrypt + testes |
| Better Auth cookie | formato assinado específico | reset controlado e cookie novo; proxy dual durante rollback |
| OTP pendente | formato Better Auth incompatível | drenar/inutilizar e permitir reenvio |
| FastAPI 422 | frontend espera 400/envelope | exception handler de compatibilidade |
| trailing slash | 307 indesejado | declarar path vazio conforme chamadas |
| null vs ausente | UI pode distinguir | schemas/serialização por golden |
| DELETE heterogêneo | ids em query/body/path | preservar endpoint por endpoint |
| WebSocket multi-worker | broadcasts se perdem | um processo no cutover |
| WebSocket cookie/origem | browser pode não enviar cookie | mesma origem/ingress de upgrade; testar |
| SSE buffering | eventos chegam juntos | headers e proxy no-buffer; teste temporal |
| upload volume | web/API veem roots diferentes | mesmo volume e path canônico |
| Pillow vs Sharp | pixel/layout diferente | corpus e tolerância visual definida |
| ReportLab vs PDFKit | paginação diferente | comparar texto/páginas/renders |
| Kafka offset Number | JS perde precisão >2^53 | Python int e teste; commit string correto |
| worker paralelo | partições divididas/comportamento misto | stop-confirm-start obrigatório |
| DLQ falha | perda se offset for commitado | baseline e Python não commitam |
| handler unknown | no-op silencioso atual | preservar durante migração, observar métrica |
| Ollama lento | bloqueio do event loop | HTTP async, semaphore, timeout/cancel |
| LangGraph vs Ollama | tratar orquestrador como servidor de modelo | LangGraph orquestra; Ollama continua runtime atrás de portas |
| modelo 1.5B e tools | seleção/JSON pode ser instável | modo deterministic obrigatório; hybrid somente após Gate 11.60 |
| contexto 16K + 25 mensagens/tools | overflow, latência ou OOM | prompt ≤12.000 bytes, DatasetRegistry 8 MiB, projeção compacta e fallback preflight |
| geração SSE duplicada | duas chamadas divergem e dobram latência | uma síntese deterministic; contador e orçamento por run |
| cache não isola usuário | resposta/metadados vazam entre contas | corrigir Node na Fase 0; Python exige userId + assinatura versionada |
| SSE cache `data/complete` | frontend só finaliza `result` | parser dual no rollback; Python emite terminal canônico |
| chain-of-thought | raciocínio completo é transmitido/persistido | remover do prompt; progresso server-side sanitizado |
| tool com acesso amplo | modelo amplia permissões/escopo | allowlist por scope + auth dentro de cada tool + schemas strict |
| prompt injection via RAG | documento tenta controlar agente | tool result não confiável, delimitação, limites e enforcement em código |
| semântica de status divergente | “rodou/falhou” muda entre tela, relatório e agente | matriz única versionada; flags ambíguas `unknown`; gate antes das tools |
| rodada problemática vs problema formal | contagem duplicada ou explicação da fonte errada | sourceKind obrigatório e datasets/séries separados |
| taxa de resolução fixa | agente transforma estimativa de 80% em fato | remover; calcular por soluções/checks reais ou marcar unsupported |
| dataset alterado pelo LLM | gráfico/PDF contém números inventados | DatasetRegistry opaco; projeções/templates server-side; validação por checksum |
| dataset truncado | total/artefato apresenta amostra como universo | agregador completo separado ou título/caption explícito de amostra; PDF completo bloqueado |
| SVG/Mermaid injection | script/link/diretiva executada no web | escaping, templates fixos, diretivas proibidas, CSP e browser security tests |
| PDF disfarçado de image | schema inválido e impossível combinar chart+PDF | `artifacts[]` aditivo; web dual; tipo image fica só para imagem |
| loop/tool storm | CPU/DB/Ollama esgotados | 8 required + 4 supplemental/12 total, 2 rounds, 3 model calls, 24 steps, timeouts e fallback |
| sessions concorrentes | AsyncSession compartilhada quebra transação | sessão independente por tool; máximo 2 paralelas |
| dupla persistência | checkpoint e tabelas atuais divergem | sem checkpointer na migração; mensagens PostgreSQL são canônicas |
| PDF agentic | efeito repetido/arquivo órfão | nó determinístico, intenção explícita, idempotency key, fora de bind_tools |
| tracing externo | prompts/dados saem do ambiente | LangSmith off, telemetria local redigida |
| Ollama no worker | falha de IA bloqueia Kafka sem necessidade | remover init/env/import; job one-shot separado |
| embedding dimensão | SQL falha ou ranking inválido | validar 768 antes de persistir |
| mudanças locais RAG | port pode usar código antigo | incorporar SHA/diff aprovado antes da fase 11 |
| docs obsoletas | contrato errado | código+goldens são oráculo; docs atualizadas no fim |
| CI com Turbo implícito | workflow não reproduzível | comandos explícitos e ferramentas lockadas |

---

## Apêndice A — Inventário de endpoints que deve entrar na matriz

Paths abaixo são os recebidos pela API. Para consumo administrativo via browser, testar também a forma pública com `/api/admin/` reescrita pelo Next.

### Sistema

- `GET /health`
- `GET /health/live` (novo, operacional)
- `GET /health/ready` (novo, operacional)
- `POST /api/warmup`
- `GET /api/check-admin`
- `GET /api/server-time`

### Auth custom e compatibilidade Better Auth observada

- `GET /api/auth/get-session`
- `POST /api/auth/login/password`
- `POST /api/auth/login-email/send-otp`
- `POST /api/auth/login-email/verify-otp`
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-up/email/send-otp`
- `POST /api/auth/sign-up/email/verify-otp`
- `POST /api/auth/forget-password`
- `POST /api/auth/forget-password/verify-otp`
- `POST /api/auth/setup-password`
- `GET /api/auth/login-google`
- `GET /api/auth/callback/google`
- `POST /api/auth/sign-in/email` enquanto houver cliente legado observado
- `POST /api/auth/sign-out`
- Qualquer outra rota Better Auth encontrada nos logs da fase 1

### Users

- `GET|POST|PUT|DELETE /api/users`
- `POST /api/users/:id/resend-password-setup`
- `GET|PUT /api/users/profile`
- `POST /api/users/profile-image`
- `POST /api/users/profile-image/update`
- `GET|PUT /api/users/preferences`
- `PUT /api/users/email`
- `POST|PUT /api/users/email-change`
- `PUT /api/users/password`
- Alias legado `/api/user-password` somente se fase 1 provar uso/contrato

### Groups e contacts

- `GET|POST|PUT|DELETE /api/groups`
- `GET|PUT /api/groups/permissions`
- `DELETE /api/groups/users`
- `GET|POST|PUT|DELETE /api/contacts`

### Products

- `GET|POST|PUT|DELETE /api/products`
- `GET /api/products/activities/availability`
- `POST|PUT /api/products/activities`
- `GET|POST /api/products/activities/pending-email`
- `GET|POST|DELETE /api/products/availability-exceptions`
- `GET|POST|DELETE /api/products/contacts`
- `GET|POST|PUT|DELETE /api/products/dependencies`
- `PUT /api/products/dependencies/reorder`
- `GET|PUT /api/products/manual`
- `GET|DELETE /api/products/manual/images`
- `GET|POST|PUT|DELETE /api/products/problems`
- `GET|POST|PUT|DELETE /api/products/problems/categories`
- `GET|POST|DELETE /api/products/images`
- `GET|POST|PUT|DELETE /api/products/solutions`
- `POST /api/products/solutions/count`
- `GET /api/products/solutions/summary`
- `GET|POST|DELETE /api/products/solutions/images`
- `GET /api/products/:productId/history`
- `GET /api/products/:productId/data-flow`

### Product flow, monitoring e incidents

- `POST /api/product-flow/receive`
- `GET|POST|PUT|DELETE /api/monitoring/picture-pages`
- `PUT|DELETE /api/monitoring/picture-links`
- `GET|POST|PUT|DELETE /api/monitoring/radar-groups`
- `GET|PUT|DELETE /api/monitoring/radars`
- `POST /api/monitoring/seed-radars`
- `POST /api/monitoring/products`
- `GET|POST|PUT|DELETE /api/incidents`
- `GET /api/incidents/usage`
- `GET|POST|DELETE /api/incidents/images`

### Projects e tasks

- `GET|POST|PUT|DELETE /api/projects`
- `GET|POST|PUT|DELETE /api/projects/:projectId/activities`
- `GET|POST|PUT|DELETE|PATCH /api/projects/:projectId/activities/:activityId/tasks`
- `GET /api/tasks/:taskId/history`
- `GET|POST /api/tasks/:taskId/users`

### Dashboard, help e reports

- `GET /api/dashboard`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/problems-causes`
- `GET /api/dashboard/problems-solutions`
- `GET /api/dashboard/projects`
- `GET|PUT /api/help`
- `GET|DELETE /api/help/images`
- `GET /api/reports/availability`
- `POST /api/reports/availability/pdf`
- `GET /api/reports/problems`
- `POST /api/reports/problems/pdf`
- `GET /api/reports/executive`
- `POST /api/reports/executive/pdf`
- `GET /api/reports/projects`
- `POST /api/reports/projects/pdf`
- `GET /api/reports/files`

### Uploads

- `POST /api/upload/:kind`
- `GET /api/upload/serve/:kind/:filename`
- `DELETE /api/upload/serve/:kind/:filename`
- Route pública do web `GET|DELETE /uploads/:type/:filename`

### Chat REST e realtime

- `GET /api/chat/messages`
- `GET /api/chat/messages/count`
- `POST /api/chat/messages`
- `POST /api/chat/messages/read`
- `POST /api/chat/messages/:messageId/read`
- `PATCH|DELETE /api/chat/messages/:messageId`
- `GET|POST|PATCH /api/chat/presence`
- `GET /api/chat/unread-messages`
- `GET /api/chat/sidebar`
- `POST /api/chat/status`
- `WS /api/chat/ws`

### Assistente de IA

- `GET /api/ai-assistant/status`
- `GET /api/ai-assistant/examples`
- `GET|POST /api/ai-assistant/threads`
- `GET|DELETE /api/ai-assistant/threads/:threadId`
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId`
- `POST /api/ai-assistant/messages`
- `POST /api/ai-assistant/messages/stream` (SSE)

Tools LangGraph são internas e não criam endpoints públicos. Qualquer futura rota de tool/debug exige contrato, auth, threat model e aprovação fora desta migração.

---

## Apêndice B — Variáveis de ambiente a reconciliar

### Mantidas

`DATABASE_URL`, `DATABASE_URL_DEV`, `DATABASE_URL_PROD`, `APP_URL_DEV`, `APP_URL_PROD`, `NEXT_PUBLIC_BASE_PATH`, `API_URL`, `NEXT_PUBLIC_API_ORIGIN`, `ALLOWED_EMAIL_DOMAINS`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `KAFKA_REST_PROXY_URL`, `KAFKA_REST_PROXY_AUTH`, `KAFKA_REST_PROXY_USE_MOCK_DATA`, `KAFKA_DATAFLOW_TOPIC_PREFIX`, `KAFKA_GROUP_ID`, `KAFKA_TOPIC`, `KAFKA_TOPICS`, `KAFKA_DLQ_PREFIX`, `KAFKA_PROCESS_RETRY_COUNT`, `KAFKA_RETRY_BACKOFF_MS`, `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_TIMEOUT_MS`, `OLLAMA_MAX_CONCURRENT_REQUESTS`, `PRODUCT_FLOW_API_KEY`, `UPLOADS_DIR`, `API_PORT`, `TZ`.

### Novas

- `SILO_ENV=development|test|staging|production`
- `SESSION_SECRET=<mínimo 32 bytes aleatórios>`
- `TRUSTED_PROXY_CIDRS=<CSV>`
- `LOG_LEVEL=INFO`
- `DB_POOL_SIZE=10`
- `DB_MAX_OVERFLOW=10`
- `DB_STATEMENT_TIMEOUT_MS=30000`
- `WORKER_POLL_STALE_AFTER_SECONDS=60`
- `WORKER_SHUTDOWN_GRACE_SECONDS=60`
- `WORKER_HEARTBEAT_FILE=/tmp/silo-worker-heartbeat`
- `AI_AGENT_MODE=deterministic|hybrid` (obrigatória; default seguro fora de produção: `deterministic`)
- `AI_HYBRID_COHORT_PERCENT=0|5|25|100` (só tem efeito se hybrid estiver aprovado)
- `AI_AGENT_MAX_TOOL_ROUNDS=2`
- `AI_AGENT_MAX_REQUIRED_TOOL_CALLS=8`
- `AI_AGENT_MAX_SUPPLEMENTAL_TOOL_CALLS=4`
- `AI_AGENT_MAX_TOTAL_TOOL_CALLS=12`
- `AI_AGENT_MAX_MODEL_CALLS=3`
- `AI_GRAPH_RECURSION_LIMIT=24`
- `AI_AGENT_TOOL_TIMEOUT_MS=20000`
- `AI_AGENT_TOTAL_TIMEOUT_MS=90000`
- `AI_AGENT_MAX_PARALLEL_TOOLS=2`
- `AI_AGENT_MAX_PROMPT_UTF8_BYTES=12000`
- `AI_AGENT_MAX_TOOL_RESULT_BYTES=524288`
- `AI_AGENT_MAX_DATASET_REGISTRY_BYTES=8388608`
- `AI_AGENT_MAX_CHART_BYTES=131072`
- `AI_AGENT_MAX_MERMAID_BYTES=65536`
- `AI_AGENT_MAX_SVG_BYTES=262144`
- `AI_AGENT_MAX_PDF_BYTES=20971520`
- `AI_AGENT_MAX_PDF_PAGES=200`
- `OLLAMA_NUM_CTX=16384`
- `OLLAMA_NUM_PREDICT=768`
- `OLLAMA_CHAT_MODEL_DIGEST=<digest aprovado>`
- `OLLAMA_EMBEDDING_MODEL_DIGEST=<digest aprovado>`
- `LANGSMITH_TRACING=false`

O worker atualiza o heartbeat após cada poll REST bem-sucedido, inclusive vazio. O Docker healthcheck executa um módulo Python que falha se o arquivo estiver ausente, inválido ou mais antigo que `WORKER_POLL_STALE_AFTER_SECONDS`; nenhuma porta extra é exposta.

### Legado temporário

- `NODE_ENV`: continua necessário ao web; backend aceita fallback durante coexistência.
- `BETTER_AUTH_SECRET` e `BETTER_AUTH_BASE_URL`: manter somente enquanto Node/rollback existir; remover na fase 17.

Regras:

- produção falha no boot se DB, session secret, app URL ou SMTP obrigatório estiver ausente;
- produção falha no boot se `AI_AGENT_MODE` não for explícito, se os limites excederem os máximos vinculantes ou se o model digest observado divergir do aprovado; a API pode subir com assistente em fallback somente se a política operacional aprovada assim determinar;
- `hybrid` com `AI_HYBRID_COHORT_PERCENT>0` falha no boot/deploy se a evidência do Gate 11.60 não estiver anexada à release;
- variáveis `AI_*`, `OLLAMA_*`, LangGraph e LangChain não são injetadas/importadas pelo container/processo worker;
- `LANGSMITH_TRACING` diferente de `false` é rejeitado em produção nesta migração;
- Google é opcional somente se ambas as credenciais estiverem vazias;
- não imprimir valores no erro de validação;
- `env.example` contém placeholders, nunca secrets reais;
- `.env` não é lido nem copiado para a imagem Docker.

---

## Apêndice C — Referências técnicas fixadas

- FastAPI recomenda fixar a versão usada; esta migração fixa `0.139.2`: <https://fastapi.tiangolo.com/deployment/versions/>
- O lockfile do uv deve ser versionado e usado de forma congelada: <https://docs.astral.sh/uv/concepts/projects/sync/>
- SQLAlchemy suporta Psycopg 3 sync/async no mesmo dialeto: <https://docs.sqlalchemy.org/en/20/dialects/postgresql.html>
- Uso async do SQLAlchemy: <https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html>
- Baseline/stamp e verificação de heads com Alembic: <https://alembic.sqlalchemy.org/en/latest/cookbook.html>
- Python 3.13.14 é a manutenção fixada para a matriz: <https://www.python.org/downloads/release/python-31314/>
- A imagem oficial disponibiliza `python:3.13.14-slim-bookworm`; a release ainda fixa seu digest no build aprovado: <https://hub.docker.com/_/python/>
- LangGraph Graph API explicita state, nodes, edges, runtime context e limites: <https://docs.langchain.com/oss/python/langgraph/graph-api>
- Streaming LangGraph deve ser adaptado ao SSE público existente, sem expor eventos internos: <https://docs.langchain.com/oss/python/langgraph/streaming>
- Persistência/checkpoints exigem thread id e criam outra fonte de state; por isso ficam fora do cutover: <https://docs.langchain.com/oss/python/langgraph/persistence>
- Tools acessam state/context/runtime, mas autorização continua sendo responsabilidade da aplicação: <https://docs.langchain.com/oss/python/langchain/tools>
- Testes LangGraph permitem nós, edges, execução parcial e checkpointer em memória somente no teste: <https://docs.langchain.com/oss/python/langgraph/test>
- Recursion limit e `RemainingSteps` são usados como guard de terminação: <https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT>
- `ChatOllama` suporta async, streaming, structured output e tool calling, sujeito à capacidade do modelo: <https://docs.langchain.com/oss/python/integrations/chat/ollama>
- Ollama suporta tool loops e streaming, mas exige acumular tool calls/resultados corretamente: <https://docs.ollama.com/capabilities/tool-calling>
- Versões fixadas no cutoff: LangGraph 1.2.9, langchain-core 1.4.9 e langchain-ollama 1.1.0: <https://pypi.org/project/langgraph/>, <https://pypi.org/project/langchain-core/>, <https://pypi.org/project/langchain-ollama/>

---

## Comando para a próxima solicitação

Depois que este plano for revisado, a solicitação de execução deve ser exatamente:

> **Siga apenas o `/PLAN.md`, começando pela Fase 0. Não pule etapas, não mude o escopo e pare em qualquer gate que falhar.**

O executor deve então começar pela Fase 0, atualizar este arquivo à medida que conclui gates e jamais iniciar diretamente pela tradução das rotas.
