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
| `vllm` | `vllm/vllm-openai-cpu:v0.29.0-x86_64` | 8000 (CPU) |
| `migrate` | `silo-api-python` (one-shot) | — |
| `api` | `silo-api-python` | 4000 |
| `worker` | `silo-worker-python` | — |
| `web` | `silo-web` | 80 |

### Serviços (produção)

| Serviço | Imagem | Nota |
|---|---|---|
| `vllm` | `${SILO_VLLM_GPU_IMAGE}` | GPU NVIDIA |
| `migrate` | `${SILO_IMAGE}` (one-shot) | Imagem publicada |
| `api` | `${SILO_IMAGE}` | Imagem publicada |
| `worker` | `${SILO_IMAGE}` | Imagem publicada |
| `embedding-backfill` | `${SILO_IMAGE}` | Reconcilia embeddings ausentes ou obsoletos |

O banco de dados e o frontend em produção são gerenciados externamente (PostgreSQL gerenciado, Nginx/CDN).

### Comandos

```bash
# Desenvolvimento
docker compose up -d --build        # Subir stack
docker compose down                 # Parar
docker compose logs -f vllm api     # Logs

# Verificação do assistente após atualizar a API
docker compose ps
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready

# Produção
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml down
docker compose -f docker-compose.deploy.yml logs -f
```

Depois de um deploy, valide também o fluxo do assistente conforme
[`ai-assistant.md`](ai-assistant.md): login, envio sem `threadId`, eventos SSE
`delta`/`scope`/`result`, ausência de erro e limpeza da thread temporária. O
healthcheck da API confirma disponibilidade de configuração e banco, mas não
substitui o smoke test do modelo vLLM.

### GPU (produção)

O deploy já reserva GPU NVIDIA explicitamente. Por padrão, chat e embedding usam
a GPU 0. Para separar em duas GPUs, defina `SILO_VLLM_GPU_ID=0` e
`SILO_VLLM_EMBED_GPU_ID=1` no `.env`. O perfil compartilhado usa
`SILO_VLLM_GPU_MEM_UTIL=0.70` e `SILO_VLLM_EMBED_GPU_MEM_UTIL=0.20`; com GPUs
separadas, ambos podem ser ajustados para `0.85`.

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ["${SILO_VLLM_GPU_ID:-0}"]
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

O runner precisa ter a chave SSH do destino previamente verificada em
`~/.ssh/known_hosts`, obtida por um canal independente. O deploy usa o arquivo
padrao com `StrictHostKeyChecking=yes`; se o host ou a porta não tiverem uma chave
cadastrada, a conexão falha. O pipeline não descobre chaves durante o deploy.
Como o job roda em um container efêmero, o runner deve montar ou fornecer esse
arquivo antes de executar o script.

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
SILO_VLLM_GPU_MEM_UTIL=0.70
SILO_VLLM_EMBED_GPU_MEM_UTIL=0.20
HF_TOKEN=              # Para modelos restritos

# Deploy
SILO_IMAGE=ghcr.io/... # Imagem publicada
SILO_ENV=production
```

O vLLM não usa autenticação por chave. No Compose de produção, os serviços de
inferência não publicam portas no host e ficam apenas na rede privada `inference`,
acessível pela API e pelo worker. No Compose local, as portas publicadas ficam em
`127.0.0.1` por padrão. Não exponha essas portas em uma interface pública. Se um
proxy estiver em outra máquina, configure `SILO_BIND_ADDRESS` para uma interface
privada e restrinja o firewall ao proxy; containers autorizados na rede `inference`
podem chamar o vLLM sem credencial.

Em 16/09/2026, a imagem fixada em `v0.29.0` ainda está no intervalo afetado pelo
aviso upstream [GHSA-p6g9-7v3x-m8mv](https://github.com/vllm-project/vllm/security/advisories/GHSA-p6g9-7v3x-m8mv),
que descreve consumo excessivo de memória e banda ao buscar mídia remota antes de
aplicar limites. O aviso indica correção em versões posteriores a `0.29.0`, mas
essa ainda é a versão mais recente publicada. O SILO envia texto simples ao vLLM
e mantém os serviços de inferência privados; reavalie este risco antes de habilitar
entrada multimodal ou atualizar a imagem.

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
