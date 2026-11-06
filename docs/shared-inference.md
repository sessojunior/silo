# Inferência compartilhada: Qwen

O `qwen` é um serviço de inferência independente do SILO. Ele pode atender o
SILO e outros projetos no mesmo host, mantendo um único modelo carregado na
GPU e evitando uma cópia do modelo por aplicação.

## Limite entre os projetos

```text
Compose de inferência                         Compose do SILO
qwen ──> rede shared-inference <── api/indexer
  │                                      │
  └── outros projetos consumidores       └── embeddings, banco e documentos
```

O Compose de inferência é o dono do container `qwen`, do cache do modelo e da
rede `shared-inference`. O Compose do SILO é dono de `api`, `indexer`,
`embeddings`, banco, uploads e índices vetoriais. Um projeto consumidor não deve
montar volumes do SILO nem acessar o banco para usar o modelo.

## Contrato para consumidores

Quando o consumidor também roda em Docker no mesmo host, ele deve entrar na rede
existente e usar o DNS do container:

| Item | Valor |
|---|---|
| Rede Docker | `shared-inference` |
| Host do modelo | `qwen` |
| Base URL OpenAI-compatible | `http://qwen:8000/v1` |
| Nome do modelo | `qwen` |
| Healthcheck | `http://qwen:8000/health` |

Exemplo mínimo para outro projeto:

```yaml
services:
  outro-projeto:
    image: outro-projeto:latest
    environment:
      LLM_BASE_URL: http://qwen:8000/v1
      LLM_MODEL: qwen
    networks:
      - shared-inference

networks:
  shared-inference:
    external: true
    name: shared-inference
```

O projeto consumidor deve ser iniciado depois do Compose de inferência:

```bash
docker compose -f docker-compose.inference.yml up -d
docker compose -f docker-compose.inference.yml ps
docker compose -f docker-compose.outro-projeto.yml up -d
```

O consumidor não deve declarar uma segunda rede com o mesmo nome, criar outro
container `qwen` ou executar `docker compose down` no Compose de inferência.

## Uso fora de Docker

Por padrão, o serviço publica a porta somente em `127.0.0.1:8000`. Uma aplicação
rodando diretamente no host pode usar:

```text
Base URL: http://127.0.0.1:8000/v1
Modelo: qwen
```

Para um projeto em outra máquina, não exponha a porta diretamente na internet.
Use uma interface privada ou um gateway/reverse proxy com autenticação, TLS,
limite de requisições e controle por projeto. O Compose compartilhado não
implementa quotas ou autenticação por consumidor; a rede privada é a barreira
mínima esperada.

## GPU e capacidade

No cenário padrão com duas A2, o `qwen` usa a GPU 0 e os embeddings do SILO usam
a GPU 1:

```env
QWEN_GPU_ID=0
SILO_VLLM_EMBED_GPU_ID=1
QWEN_GPU_MEMORY_UTILIZATION=0.70
SILO_VLLM_EMBED_GPU_MEM_UTIL=0.20
```

Todos os projetos compartilham a capacidade de uma única instância vLLM. Isso
reduz o uso de VRAM, mas também significa que requisições concorrentes disputam
os mesmos recursos. Se um projeto precisar de outro modelo, deve receber outra
instância vLLM, com outro nome de serviço e GPU/limite de memória reservado; não
deve substituir o `qwen` compartilhado.

## Operação

O operador do serviço compartilhado é responsável por atualizar a imagem, o
modelo, o cache e a GPU. Antes de trocar o modelo, confirme que todos os projetos
consumidores toleram a nova versão. Para acompanhar o serviço:

```bash
docker compose -f docker-compose.inference.yml logs -f qwen
docker compose -f docker-compose.inference.yml ps
curl http://127.0.0.1:8000/health
```

O `qwen` só deve ser desligado depois de confirmar que nenhum projeto consumidor
está em operação. O `docker-compose.inference.yml` é a fonte oficial da
configuração compartilhada; os Compose do SILO apenas referenciam a rede externa.
