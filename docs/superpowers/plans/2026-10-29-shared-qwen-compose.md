# Shared Qwen Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar o Qwen compartilhado do Compose do SILO, usando o nome simples `qwen`, mantendo embeddings e dados vetoriais dentro do SILO.

**Architecture:** Um novo `docker-compose.inference.yml` executará o serviço `qwen` na GPU 0 e publicará a rede externa `shared-inference`. Os Compose do SILO removerão o serviço `ai`, apontarão `VLLM_URL` para `qwen` e manterão `embeddings`, indexador, banco, API, worker e frontend no projeto SILO.

**Tech Stack:** Docker Compose, vLLM OpenAI-compatible, FastAPI, PostgreSQL/pgvector, documentação Markdown e testes pytest.

**Spec:** `docs/superpowers/specs/2026-10-29-shared-qwen-compose-design.md`

## Global Constraints

- O serviço compartilhado deve se chamar `qwen`, sem prefixo `silo-` ou `inference-`.
- O serviço `embeddings` e os dados vetoriais continuam pertencendo ao SILO.
- O serviço `migrate` continua definido e usado como one-shot.
- Não remover volumes persistentes do banco, uploads ou cache de embeddings.
- A GPU padrão do Qwen é 0; a GPU padrão do embedding no deploy será 1.

## Review Focus

- Compose de desenvolvimento e produção não podem depender de `ai` nem de `http://ai:8000`.
- API e indexador devem alcançar `qwen` pela rede externa sem perder a URL própria de embeddings.
- A configuração de GPU não pode fazer Qwen e embeddings disputarem a GPU 0 por padrão.
- Documentação e scripts não devem instruir o uso de `silo-ai` como modelo compartilhado.
- A configuração gerada por `docker compose config` deve ser válida nos três Compose relevantes.

---

### Task 1: Compose separado e contratos de configuração

**Files:**
- Create: `docker-compose.inference.yml`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Modify: `env.example`
- Modify: `apps/backend/src/silo/config.py`
- Modify: `apps/backend/tests/unit/test_node_coexistence_entrypoint.py`
- Modify: `apps/backend/tests/unit/test_settings.py`
- Modify: `apps/backend/tests/unit/test_ci_contract.py`

- [x] Atualizar os testes para exigir o serviço `qwen`, a rede externa e a remoção de `ai`.
- [x] Executar os testes e observar a falha esperada.
- [x] Criar o Compose compartilhado e mover a configuração do Qwen para ele.
- [x] Ajustar URLs, dependências, redes e IDs de GPU do SILO.
- [x] Executar os testes afetados e validar os três arquivos Compose.

### Task 2: Documentação, scripts e verificação final

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/index.md`
- Modify: `docs/backend.md`
- Modify: `docs/deploy.md`
- Modify: `docs/ai-assistant.md`
- Create: `docs/shared-inference.md`
- Modify: `deploy.txt`
- Modify: `docs/superpowers/plans/2026-10-23-docker-service-naming.md`

- [x] Atualizar comandos, nomes, diagramas, URLs e instruções de GPU.
- [x] Adicionar contrato para projetos consumidores e comandos para iniciar os dois Compose.
- [x] Executar busca global por referências operacionais a `silo-ai` e `http://ai:8000`.
- [x] Executar `git diff --check`, testes backend, lint, typecheck e validação dos Compose.
- [x] Verificar o daemon Docker; o smoke test do `qwen` ficou limitado pelo pull da imagem vLLM não presente localmente.
