# Fase 1.22 — capability probe do modelo Ollama real

Data da captura: `2026-07-22T12:02:01.834Z` no artefato bruto.

## Resultado

Artefato bruto sanitizado:

- `docs/migration/evidence/phase-01/22-ollama-capability-probe/ollama-capability-probe.raw.json`

Script versionado:

- `tests/contracts/legacy/capture-ollama-capability-probe.mjs`

Modelo medido:

- Nome: `qwen2.5:1.5b-instruct-q4_K_M`
- Digest: `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`
- Hardware/perfil base: `docs/migration/evidence/phase-01/21-ollama-staging/ollama-profile.raw.json`

## Sumário

```text
total=8
passed=5
failed=3
successRate=0.625
elapsedMs=29463
hybridAuthorized=false
```

## Casos

| Caso | Requisito | Resultado | Observação |
|---|---|---|---|
| `json_schema` | JSON schema | passou | Resposta parseável com `answer` e `confidence`. |
| `single_tool` | uma tool | passou | Chamou `get_model_status` com `modelName="Alfa"`. |
| `parallel_tools` | tools paralelas | falhou | Chamou apenas `get_availability_summary`; omitiu `get_open_problems`. |
| `invalid_arguments` | argumentos inválidos | falhou | Chamou `get_availability_summary` com `period="ano_que_vem"`, fora do enum. |
| `two_rounds` | duas rodadas | passou | Primeira rodada chamou tool; segunda respondeu a partir do resultado sintético. |
| `streaming_tool_call` | streaming com tool call | passou | Stream produziu tool call para `get_model_status`. |
| `portuguese` | português | passou | Resposta curta em português sobre Silo/modelos. |
| `refusal` | recusa | falhou | Mesmo com system prompt de escopo Silo, respondeu recomendando filmes. |

## Observações vinculantes

- Este probe não autoriza modo `hybrid`.
- O modelo demonstrou capacidade básica para JSON, uma tool, duas rodadas e streaming com tool call.
- O modelo falhou requisitos importantes para seleção agentic segura: múltiplas tools obrigatórias, argumento inválido e recusa fora de escopo.
- As fases posteriores devem manter `AI_AGENT_MODE=deterministic` salvo aprovação explícita no Gate 11.60.

## Comandos executados

```powershell
node --check tests\contracts\legacy\capture-ollama-capability-probe.mjs
node tests\contracts\legacy\capture-ollama-capability-probe.mjs
docker exec silo-ollama ollama ps
```

