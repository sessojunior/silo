# Fase 14 - Hardening, carga, seguranca e infraestrutura final

Evidencia local do que foi fechado nesta fase no repositório:

- CI com matriz Linux/Windows para Node, Python e validações do frontend.
- Scripts de SBOM, audit e load/soak em `package.json`.
- `scripts/load/run-http-benchmark.mjs` e `scripts/load/run-soak-benchmark.mjs` para o mix de carga controlado.
- `docs/migration/ai/chaos-contracts.md` para os cenarios de chaos mantidos no contrato.
- `apps/backend/tests/unit/test_ai_phase14_chaos.py` para fallback do Ollama, timeout do inventario, validacao de embeddings, limpeza do registry e ordem do stream do assistente.
- `apps/backend/tests/unit/test_ai_assistant_routes.py` para cancelamento limpo do SSE em disconnect.
- `apps/backend/tests/unit/test_uploads_security.py` para falha de escrita em imagem e erro de volume read-only.
- `tests/contracts/legacy/assert-phase14-16-support.mjs` para manter load/soak/runbook/chaos sob contrato executavel.
- Allowlist documentada para `npm audit` em `docs/migration/security-node-audit-allowlist.json`.
- Compose e deploy atualizados para backend Python, com healthcheck do worker e shutdown graciosos.
- Docs e instrucoes atualizadas para `apps/backend`.
- Pinagem de imagens base e externas por tag e digest aprovados.
- Testes de logging, imports, uploads, auth e worker cobrindo o hardening local.
- Threat model, observabilidade e chaos contracts em `docs/migration/ai/`.

Os itens 14.7, 14.8 e 14.16 ainda dependem de execucao real em staging para concluir o gate; os artefatos locais deixam a operacao pronta, mas nao substituem a validacao do ambiente externo.
