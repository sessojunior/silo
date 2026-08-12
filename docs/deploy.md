# Deploy, Docker e CI/CD

---

## Docker

O SILO usa dois arquivos de orquestração:

| Arquivo | Uso | Build |
|---|---|---|
| `docker-compose.yml` | Desenvolvimento local | Constrói imagens (`build:`) |
| `docker-compose.deploy.yml` | Produção | Usa imagem pronta (`image:`) |

### Serviços (desenvolvimento)

| Serviço | Imagem | Porta |
|---|---|---|
| `db` | `pgvector/pgvector:pg17` | 5432 |
| `vllm` | `vllm/vllm-openai:v0.11.2` | 8000 |
| `migrate` | `silo-api-python` (one-shot) | — |
| `api` | `silo-api-python` | 4000 |
| `worker` | `silo-worker-python` | — |
| `web` | `silo-web` | 80 |

### Serviços (produção)

| Serviço | Imagem | Nota |
|---|---|---|
| `vllm` | `vllm/vllm-openai:v0.11.2` | GPU recomendada |
| `migrate` | `${SILO_IMAGE}` (one-shot) | Imagem publicada |
| `api` | `${SILO_IMAGE}` | Imagem publicada |
| `worker` | `${SILO_IMAGE}` | Imagem publicada |

O banco de dados e o frontend em produção são gerenciados externamente (PostgreSQL gerenciado, Nginx/CDN).

### Comandos

```bash
# Desenvolvimento
docker compose up -d --build        # Subir stack
docker compose down                 # Parar
docker compose logs -f vllm api     # Logs

# Produção
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml down
docker compose -f docker-compose.deploy.yml logs -f
```

### GPU (produção)

Para ativar aceleração GPU no vLLM, descomente o bloco `deploy` no serviço `vllm`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

Pré-requisitos: NVIDIA Container Toolkit, drivers 525+, GPU com 4+ GB VRAM.

---

## CI/CD

### GitHub Actions

O workflow principal executa:

1. **Validate** — Lint, typecheck e testes do frontend e backend
2. **Build** — Constrói imagens Docker do backend e web
3. **Test** — Testes de rota e validações contra a API
4. **Security** — SBOM, audit de dependências npm e Python
5. **Deploy** — Deploy por SSH usando a imagem publicada

### GitLab CI

Pipeline com jobs explícitos para Node.js e Python, build de imagem backend e deploy script.

---

## Variáveis de ambiente

Ver [`env.example`](../env.example) para a lista completa. Principais:

```env
# Obrigatórias
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
SESSION_SECRET=...

# IA (vLLM)
VLLM_MODEL=Qwen/Qwen2.5-0.5B-Instruct
VLLM_GPU_MEM_UTIL=0.85
HF_TOKEN=              # Para modelos restritos

# Deploy
SILO_IMAGE=ghcr.io/... # Imagem publicada
SILO_ENV=production
```

---

## Scripts de deploy

```bash
node scripts/deploy/cutover-runbook.mjs preflight   # Verificar pré-condições
node scripts/deploy/cutover-runbook.mjs cutover     # Executar deploy
node scripts/deploy/cutover-runbook.mjs rollback    # Reverter
```

### Segurança

```bash
node scripts/security/check-node-audit.mjs     # Auditar vulnerabilidades npm
node scripts/security/generate-sbom.mjs        # Gerar SBOM CycloneDX
uv --directory apps/backend audit --locked     # Auditar dependências Python
```
