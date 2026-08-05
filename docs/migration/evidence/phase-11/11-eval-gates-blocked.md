# Fase 11 - Gates de avaliacao bloqueados

Data: 2026-07-28

## Contexto

O codigo e os testes unitarios da fase 11 permanecem no repositorio e os testes locais relacionados passaram, mas os gates abaixo exigem corpus real no Ollama, hardware registrado e/ou rollout em staging.

## Gates nao executados neste ambiente

- 11.58 rodar corpus real com Ollama e hardware registrado
- 11.59 aprovar modo `deterministic` com baseline real
- 11.60 aprovar modo `hybrid` com 630 execucoes reais
- 11.61 registrar falha do modelo e manter `AI_AGENT_MODE=deterministic` se necessario
- 11.62 habilitar `hybrid` em staging por coortes se aprovado
- 11.63 testar rollback operacional mudando apenas `AI_AGENT_MODE`

## Observacao

Estas etapas nao foram simuladas nem marcadas como concluídas para nao mascarar a ausencia de execucao real.
