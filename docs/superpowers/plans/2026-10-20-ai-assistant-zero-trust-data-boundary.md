# Limite de Dados Zero-Trust do Assistente de IA — Plano de Implementação

> **Para agentes de implementação:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir o Assistente de IA a mensagens/histórico autorizado e consultas allowlisted de dados do SILO, com efeitos colaterais e acessos externos bloqueados por código, banco, processo, container e rede.

**Architecture:** Separar leitura de dados, persistência da conversa e transporte do modelo em interfaces distintas. O modelo receberá somente texto já autorizado; as ferramentas receberão um gateway read-only, nunca uma conexão genérica. O executor será isolado de uploads, filesystem operacional e rede externa, mantendo apenas o transporte interno necessário para o vLLM.

**Tech Stack:** Python, FastAPI, SQLAlchemy, PostgreSQL, Pydantic, vLLM/OpenAI-compatible API, Docker Compose, pytest.

**Spec:** `docs/superpowers/specs/2026-10-20-ai-assistant-zero-trust-data-boundary.md`

## Global Constraints

- O modelo não pode escolher SQL, tabelas, arquivos, URLs, processos ou ferramentas.
- Toda capacidade deve ser allowlisted e falhar fechada quando ausente.
- A persistência de mensagens é uma operação da aplicação, não uma capacidade SQL do modelo.
- O assistente não deve gerar ou manipular PDFs, imagens, áudio, uploads ou arquivos.
- O único transporte de rede permitido ao runtime do modelo é o endpoint interno allowlisted do vLLM/embedding.
- Dados do usuário e do banco são conteúdo não confiável e não podem alterar a política de capacidades.
- Não alterar mudanças já existentes no worktree que não sejam necessárias para este plano.

## Review Focus

- Uma ferramenta tenta usar a conexão de persistência para escrever no banco — deve falhar e ser coberta na Tarefa 2.
- Um texto do banco contém instruções de prompt injection — deve continuar sendo tratado como dado e ser coberto na Tarefa 4.
- Uma configuração aponta o vLLM para URL externa — o serviço deve falhar no startup e ser coberto na Tarefa 5.
- O processo tenta ler `/app/uploads`, variável secreta ou executar subprocesso — deve ser impossível no executor e ser coberto na Tarefa 6.
- Uma resposta parcial ou falha de acesso é apresentada como resposta de contingência — deve virar erro explícito e ser coberta na Tarefa 7.

---

### Task 1: Contrato de capacidades e contexto seguro

**Files:**
- Create: `apps/backend/src/silo/ai/assistant_security.py`
- Modify: `apps/backend/src/silo/ai/assistant_registry.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_tool_catalog.py`
- Test: `apps/backend/tests/unit/test_ai_security_policy.py`

**Interfaces:**
- Produces `AssistantCapability` as a closed enum containing only `CONVERSATION_READ`, `DATABASE_READ`, `CONVERSATION_PERSIST`.
- Produces immutable `AssistantSecurityPolicy(capabilities: frozenset[AssistantCapability], allowed_model_hosts: frozenset[str])`.
- Produces `require_capability(policy, capability) -> None`, raising `AssistantSecurityError` when absent.
- `AgentRuntimeContext` will expose `security_policy` and `read_gateway`, not a generic write connection to tools.

- [ ] Escrever testes para capacidades desconhecidas, capacidade ausente e tentativa de execução de ferramenta sem `DATABASE_READ`.
- [ ] Executar `pytest apps/backend/tests/unit/test_ai_security_policy.py -q` e confirmar falha inicial.
- [ ] Implementar o enum, a política imutável e a validação fail-closed.
- [ ] Alterar o catálogo para validar política antes de executar qualquer ferramenta.
- [ ] Executar o teste novamente e confirmar aprovação.

### Task 2: Gateway read-only e persistência separada

**Files:**
- Create: `apps/backend/src/silo/ai/assistant_data_gateway.py`
- Modify: `apps/backend/src/silo/api/dependencies.py`
- Modify: `apps/backend/src/silo/api/routers/ai_assistant.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_tool_catalog.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_data_gateway.py`
- Test: `apps/backend/tests/integration/test_ai_assistant_read_only_boundary.py`

**Interfaces:**
- Create `AssistantReadGateway(connection: Connection, user_id: str)` with methods explícitos para os datasets atuais do assistente, todos retornando estruturas DTO/dicionários limitados.
- Create `AssistantPersistenceGateway(connection: Connection)` with only `save_user_message`, `save_assistant_message`, `update_thread_state` and `save_audit_event`.
- `execute_hybrid_tool_async(...)` must receive `AssistantReadGateway`, never create a generic connection from `connection.engine`.

- [ ] Escrever testes que comprovem que ferramentas só recebem o gateway de leitura e que `INSERT`, `UPDATE`, `DELETE` e DDL são rejeitados.
- [ ] Criar/configurar o usuário PostgreSQL `silo_assistant_ro` com `SELECT` apenas nas relações autorizadas; registrar isso em `ops/postgres/assistant_read_role.sql` ou no mecanismo de provisionamento vigente.
- [ ] Implementar transação read-only, `statement_timeout` de 5000 ms, limite de linhas e encerramento explícito da conexão.
- [ ] Migrar a leitura de thread, histórico, knowledge e datasets para o gateway.
- [ ] Migrar a persistência da conversa para o gateway de escrita controlada, sem expor a conexão ao modelo.
- [ ] Executar testes unitários e integração contra PostgreSQL e confirmar que o usuário read-only não consegue escrever.

### Task 3: Remoção de filesystem e artefatos do caminho do assistente

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `apps/backend/src/silo/ai/assistant_contracts.py`
- Modify: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`
- Create: `apps/backend/tests/unit/test_ai_assistant_no_artifacts.py`

**Interfaces:**
- O contrato de resposta do assistente terá somente conteúdo textual, citações e metadados de origem autorizados.
- Solicitações de PDF, imagem, áudio, Mermaid persistido ou upload retornarão `ASSISTANT_CAPABILITY_DENIED`, sem tentativa de gerar arquivo.

- [ ] Escrever testes que falhem quando o caminho do assistente importar ou chamar storage, `get_upload_file_path`, `delete_upload_file`, `PdfArtifactStore` ou renderer de arquivo.
- [ ] Remover o roteamento de artefatos do grafo e os imports de storage/PDF.
- [ ] Remover o volume de uploads do serviço executor do assistente.
- [ ] Atualizar contratos e frontend para mostrar “recurso não permitido” quando solicitado, sem fallback enganoso.
- [ ] Executar testes de regressão do assistente e confirmar que nenhuma chamada de filesystem ocorre.

### Task 4: Composição de prompt e defesa contra prompt injection

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Create: `apps/backend/src/silo/ai/assistant_prompt_boundary.py`
- Test: `apps/backend/tests/unit/test_ai_prompt_boundary.py`
- Test: `apps/backend/tests/unit/test_ai_prompt_injection.py`

**Interfaces:**
- Create `build_authorized_model_messages(user_message: str, history: Sequence[ChatMessage], datasets: Sequence[AuthorizedDataset]) -> list[ChatMessage]`.
- `AuthorizedDataset` deve carregar `source_id`, `schema_id`, `data`, `checksum` e `trusted_as_instruction=False`.

- [ ] Escrever testes com instruções maliciosas inseridas no usuário, histórico e dados do banco.
- [ ] Implementar separação explícita entre instrução de sistema fixa e blocos de dados delimitados.
- [ ] Garantir que o modelo nunca receba env, headers, tokens, caminhos, stack traces ou objetos de conexão.
- [ ] Validar que somente datasets registrados pelo gateway podem entrar no prompt.
- [ ] Executar os testes de injection e revisar snapshots do prompt.

### Task 5: Allowlist do transporte vLLM e bloqueio de egress

**Files:**
- Modify: `apps/backend/src/silo/config.py`
- Modify: `apps/backend/src/silo/ai/assistant_runtime.py`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Test: `apps/backend/tests/unit/test_ai_runtime_network_policy.py`

**Interfaces:**
- Criar `validate_internal_model_url(value: str, allowed_hosts: frozenset[str]) -> str`.
- O runtime HTTP deve usar `httpx.AsyncClient(..., trust_env=False)`.
- Hosts permitidos em produção: `ai` e `embeddings`; hosts de desenvolvimento devem ser explicitamente opt-in.

- [ ] Escrever testes para rejeitar `http://example.com`, IPs não permitidos, URLs com credenciais, redirecionamentos externos e proxies de ambiente.
- [ ] Implementar validação no carregamento da configuração e antes de criar clientes.
- [ ] Configurar a rede `inference` como interna e remover publicação de portas do vLLM em produção.
- [ ] Garantir que o serviço executor só alcance DB e vLLM internos.
- [ ] Executar teste de conexão externa a partir do container e confirmar falha.

### Task 6: Executor isolado e hardening do container

**Files:**
- Create: `apps/backend/Dockerfile.assistant`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Create: `ops/security/assistant-container-policy.md`
- Test: `apps/backend/tests/integration/test_ai_executor_isolation.py`

**Interfaces:**
- Criar serviço `assistant-executor` sem volume de uploads e sem acesso às redes `frontend` ou a integrações externas.
- O executor terá apenas o contrato interno necessário para receber a requisição autenticada já autorizada e devolver resultado textual.

- [ ] Escrever testes/config checks para `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `/tmp` efêmero limitado, ausência de uploads e ausência de portas públicas.
- [ ] Separar o processamento do assistente do processo geral da API, mantendo a API como camada de autenticação e persistência controlada.
- [ ] Aplicar limites de timeout, memória, CPU, tamanho de prompt e tamanho de resposta.
- [ ] Remover do ambiente do executor chaves SMTP, Google, Kafka, Product Flow e outros segredos não necessários.
- [ ] Construir a imagem e executar testes de acesso a arquivo, processo, DNS/rede externa e volume.

### Task 7: Testes adversariais, observabilidade e falha honesta

**Files:**
- Create: `apps/backend/tests/security/test_ai_assistant_boundary.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/api/routers/ai_assistant.py`
- Modify: `apps/frontend/src/app/admin/ai-assistant/page.tsx`
- Modify: `apps/frontend/src/components/admin/chat/message-bubble.tsx`

**Interfaces:**
- Erros de política devem usar códigos estáveis: `ASSISTANT_CAPABILITY_DENIED`, `ASSISTANT_DATA_ACCESS_DENIED`, `ASSISTANT_MODEL_UNAVAILABLE` e `ASSISTANT_EXECUTION_TIMEOUT`.
- Nenhum erro pode ser serializado como `generation.status = fallback` quando o modelo não foi chamado.

- [ ] Testar ferramenta desconhecida, argumento malformado, SQL de escrita, path traversal, URL externa, subprocesso e prompt injection.
- [ ] Testar que o estado final registra se o modelo foi realmente chamado, quais fontes foram consultadas e qual política foi aplicada, sem registrar segredos.
- [ ] Testar que timeout e indisponibilidade produzem erro explícito e botão de nova tentativa, nunca texto de contingência apresentado como resposta.
- [ ] Executar a suíte completa backend/frontend e validar os eventos SSE.

### Task 8: Verificação operacional e documentação de implantação

**Files:**
- Create: `docs/security/ai-assistant-data-boundary.md`
- Create: `ops/security/verify-ai-assistant-boundary.ps1`
- Modify: `apps/backend/README.md`
- Modify: `docker-compose.deploy.yml`

- [ ] Documentar o threat model, os únicos destinos permitidos, as credenciais mínimas e o procedimento de rotação.
- [ ] Criar verificação automatizada que inspecione grants PostgreSQL, montagem de volumes, redes, portas publicadas, capabilities e variáveis do executor.
- [ ] Executar a verificação em ambiente limpo e arquivar os resultados como evidência de release.
- [ ] Validar que qualquer mudança de ferramenta, import sensível, volume, endpoint ou grant falha no CI sem revisão de segurança.
- [ ] Fazer revisão final independente do diff e da configuração efetiva gerada por `docker compose config`.

## Verificação final

Executar, no mínimo:

```powershell
pytest apps/backend/tests/security apps/backend/tests/unit apps/backend/tests/integration -q
docker compose config
docker compose build assistant-executor
pwsh -File ops/security/verify-ai-assistant-boundary.ps1
```

Critério de sucesso: todos os testes passam, o usuário read-only não escreve, o executor não monta uploads, não possui segredos desnecessários, não consegue egress externo e qualquer operação fora do contrato termina em erro explícito.
