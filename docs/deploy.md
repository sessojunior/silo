# Deploy, Docker e CI/CD

---

## Docker

O SILO usa um Compose da aplicação e um Compose independente para o Qwen:

| Arquivo | Uso | Build |
|---|---|---|
| `docker-compose.inference.yml` | Qwen compartilhado | Perfil CPU padrão |
| `docker-compose.inference.gpu.yml` | Override do Qwen | Imagem CUDA e GPU NVIDIA |
| `docker-compose.yml` | Desenvolvimento local | Constrói imagens (`build:`) |
| `docker-compose.deploy.yml` | Produção | Usa imagem pronta (`image:`) |

### Serviços (desenvolvimento)

| Serviço | Imagem | Porta |
|---|---|---|
| `db` | `pgvector/pgvector:pg17` | 5432 |
| `embeddings` (`silo-embeddings`) | `vllm/vllm-openai-cpu:v0.29.0-x86_64` | 8001 (CPU) |
| `migrate` (`silo-migrate`) | `silo-api` (one-shot) | — |
| `indexer` (`silo-indexer`) | `silo-api` | — |
| `api` (`silo-api`) | `silo-api` | 4000 |
| `worker` | `silo-worker` | — |
| `web` | `silo-web` | 80 |

O serviço `qwen` não aparece nessa tabela porque pertence ao Compose compartilhado
`docker-compose.inference.yml`. Ele fica na rede externa `shared-inference` e é
consumido pela API e pelo indexador do SILO.

### Serviços (produção)

| Serviço | Imagem | Nota |
|---|---|---|
| `embeddings` (`silo-embeddings`) | `${SILO_VLLM_GPU_IMAGE}` | GPU NVIDIA, embeddings |
| `migrate` (`silo-migrate`) | `${SILO_IMAGE}` (one-shot) | Imagem publicada |
| `indexer` (`silo-indexer`) | `${SILO_IMAGE}` | Reconcilia embeddings ausentes ou obsoletos |
| `api` (`silo-api`) | `${SILO_IMAGE}` | Imagem publicada |
| `worker` (`silo-worker`) | `${SILO_IMAGE}` | Imagem publicada |

Para integrar outro projeto ao mesmo modelo, siga o contrato em
[`shared-inference.md`](shared-inference.md). O projeto deve apenas entrar na
rede externa `shared-inference` e chamar `http://qwen:8000/v1`.

O `qwen` é iniciado separadamente pelo `docker-compose.inference.yml`; não há uma
segunda instância de vLLM dentro do Compose do SILO.

O banco de dados e o frontend em produção são gerenciados externamente (PostgreSQL gerenciado, Nginx/CDN).

O container `silo-migrate` é one-shot: depois de concluir com código 0, ele pode
permanecer como `exited (0)` ou ser removido. Isso não afeta os serviços ativos;
uma nova execução com `docker compose -f docker-compose.deploy.yml run --rm
migrate` recria o container.

### Comandos

```bash
# Qwen compartilhado em CPU (desenvolvimento/local)
docker compose -f docker-compose.inference.yml up -d

# Qwen compartilhado em GPU (produção com NVIDIA Container Toolkit)
docker compose -f docker-compose.inference.yml -f docker-compose.inference.gpu.yml up -d

# Desenvolvimento do SILO
docker compose up -d --build        # Subir stack
docker compose down                 # Parar
docker compose -f docker-compose.inference.yml logs -f qwen
docker compose logs -f embeddings api indexer     # Logs do SILO

# Verificação do assistente após atualizar a API
docker compose ps
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready

# Produção
docker compose -f docker-compose.inference.yml -f docker-compose.inference.gpu.yml up -d
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml down
docker compose -f docker-compose.deploy.yml logs -f
```

### Limpeza segura

Remova somente containers one-shot concluídos ou redes comprovadamente vazias.
Não execute o `down` do Compose de inferência enquanto outro projeto ainda usar o
Qwen compartilhado.
Não remova os volumes `silo-vllm-cache`, `silo-vllm-compile-cache`,
`silo-postgres-data` ou `silo-storage-data`, pois eles contêm modelos, banco e
uploads. Evite `docker system prune -a` no servidor sem uma auditoria prévia.

Depois de um deploy, valide também o fluxo do assistente conforme
[`ai-assistant.md`](ai-assistant.md): login, envio sem `threadId`, eventos SSE
`delta`/`scope`/`result`, ausência de erro e limpeza da thread temporária. O
healthcheck da API confirma disponibilidade de configuração e banco, mas não
substitui o smoke test do modelo vLLM.

### GPU (produção)

O Compose de inferência reserva a GPU NVIDIA 0 para o Qwen compartilhado. O
Compose do SILO reserva a GPU 1 para embeddings quando
`SILO_VLLM_EMBED_GPU_ID=1` está definido. O Qwen usa
`QWEN_GPU_MEMORY_UTILIZATION=0.70` e os embeddings usam
`SILO_VLLM_EMBED_GPU_MEM_UTIL=0.20` como padrão.

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ["${QWEN_GPU_ID:-0}"]
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

# Qwen compartilhado (vLLM)
QWEN_MODEL=Qwen/Qwen2.5-0.5B-Instruct
QWEN_SERVED_MODEL=qwen
QWEN_BIND_ADDRESS=127.0.0.1
QWEN_GPU_ID=0
QWEN_GPU_MEMORY_UTILIZATION=0.70
SILO_VLLM_EMBED_GPU_MEM_UTIL=0.20
SILO_VLLM_EMBED_GPU_ID=1
HF_TOKEN=              # Para modelos restritos

# Deploy
SILO_IMAGE=ghcr.io/... # Imagem publicada
SILO_ENV=production
```

O vLLM não usa autenticação por chave. O Qwen fica na rede privada
`shared-inference` e, por padrão, publica a porta somente em `127.0.0.1`; os
embeddings do SILO ficam na rede privada `inference`. Não exponha essas portas em
uma interface pública. Se um proxy estiver em outra máquina, configure
`QWEN_BIND_ADDRESS`/`SILO_BIND_ADDRESS` para interfaces privadas e restrinja o
firewall ao proxy; containers autorizados nas redes correspondentes podem chamar o
vLLM sem credencial.

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
