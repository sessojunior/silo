# Fase 1.21 — perfil de hardware/modelos Ollama

Data da captura: `2026-07-22T11:58:22.280Z` no artefato bruto.

## Resultado

Perfil bruto sanitizado:

- `docs/migration/evidence/phase-01/21-ollama-staging/ollama-profile.raw.json`

Script versionado:

- `tests/contracts/legacy/capture-ollama-staging-profile.mjs`

## Ambiente medido

Esta captura usa o serviço `ollama` do `docker-compose.yml` local, container `silo-ollama`, exposto em `127.0.0.1:11434`. Não comparar estes resultados com outro host/hardware.

Hardware host observado:

- CPU: `AMD Ryzen 7 7735HS with Radeon Graphics`, 8 cores / 16 threads lógicos.
- RAM física: `14701584384` bytes.
- GPU detectada pelo Windows: `AMD Radeon(TM) Graphics`, `2147483648` bytes de AdapterRAM.
- `nvidia-smi`: indisponível.
- Processamento observado pelo Ollama após medições: `100% CPU` para chat e embedding.

Servidor Ollama:

- Versão: `0.30.0-rc7`.
- Imagem: `ollama/ollama:0.30.0-rc7`.
- Digest da imagem/container: `sha256:cee82c012a508ca3730f3887d44cbb9cd07c90fb1dffa5cb5417e7ace0ddab55`.

Modelos presentes no volume `silo-ollama-data`:

| Uso | Modelo | Digest | Tamanho | Família | Parâmetros | Quantização |
|---|---|---|---:|---|---:|---|
| Chat | `qwen2.5:1.5b-instruct-q4_K_M` | `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b` | `986061892` | `qwen2` | `1.5B` | `Q4_K_M` |
| Embedding | `nomic-embed-text:v1.5` | `0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f` | `274302450` | `nomic-bert` | `137M` | `F16` |

Contexto:

- `qwen2.context_length` declarado por `/api/show`: `32768`.
- Contexto ativo observado após request com `num_ctx=16384`: `16384`.
- `qwen2.embedding_length`: `1536`.
- Embedding retornado por `nomic-embed-text:v1.5`: dimensão `768`.

Latência medida com prompt sintético curto, sem dados de produção:

| Medição | Resultado |
|---|---:|
| Chat cold após unload | `6209 ms` |
| Chat warm imediato | `270 ms` |
| Embedding first | `1075 ms` |
| Embedding warm imediato | `48 ms` |
| Concorrência 2 chamadas chat paralelas | `365 ms` total; chamadas individuais `293 ms` e `364 ms` |

## Comandos executados

```powershell
docker compose up -d ollama
docker compose ps ollama
node --check tests\contracts\legacy\capture-ollama-staging-profile.mjs
node tests\contracts\legacy\capture-ollama-staging-profile.mjs
docker exec silo-ollama ollama ps
```

## Observações vinculantes

- A avaliação das fases seguintes deve usar os digests acima ou registrar override explícito antes de medir.
- O modelo declara contexto `32768`, mas o cliente/plano deve continuar limitando `num_ctx=16384` até gate posterior aprovar mudança.
- O ambiente observado não usa NVIDIA/VRAM dedicada; medições são CPU-bound.
- A medição de concorrência aqui registra capacidade observada do servidor local; a política da aplicação continua limitada por `OLLAMA_MAX_CONCURRENT_REQUESTS` até configuração explícita.

