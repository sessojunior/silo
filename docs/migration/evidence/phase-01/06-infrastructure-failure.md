# Evidência Fase 1.6 — lote infrastructure-failure

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: falhas de infraestrutura aplicáveis e reproduzíveis sem autenticação prévia e sem side effects externos persistentes. Esta evidência não conclui a etapa 1.6.

## Critério de inclusão

Incluídas falhas em pontos onde a infraestrutura pode ser derrubada sem mascarar a rota pelo `authMiddleware`:

- `POST /api/auth/login/password` com PostgreSQL indisponível: captura o comportamento legado do rate-limit de autenticação, que falha fechado.
- `POST /api/warmup` com Ollama indisponível: captura o contrato legado público do warmup quando o runtime de IA não responde.

Portas verificadas como fechadas antes da execução:

- DB indisponível: `127.0.0.1:59999`;
- Ollama indisponível: `127.0.0.1:59998`.

## Comandos executados

```powershell
@(59997,59998,59999) | ForEach-Object { $open = Test-NetConnection -ComputerName 127.0.0.1 -Port $_ -InformationLevel Quiet -WarningAction SilentlyContinue; [pscustomobject]@{Port=$_;Open=$open} } | ConvertTo-Json
node --check tests\contracts\legacy\generate-infrastructure-failure-cases.mjs
node tests\contracts\legacy\generate-infrastructure-failure-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-infrastructure-failure.json --dry-run
```

Captura final:

```powershell
$env:SILO_CONTRACT_DATABASE_URL = 'postgresql://silo:silo@127.0.0.1:59999/silo_contract_unavailable'
$env:DRIZZLE_DATABASE_URL = $env:SILO_CONTRACT_DATABASE_URL
$env:OLLAMA_URL = 'http://127.0.0.1:59998'
$env:OLLAMA_TIMEOUT_MS = '500'
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-infrastructure-failure.json --label=06-infrastructure-failure-fixed
```

## Tentativa corrigida

A primeira captura esperava `503` para `POST /api/auth/login/password`, mas o legado retornou `429`. A causa foi confirmada em `apps/api/src/infra/rate-limit-db.ts`: em falha de infraestrutura de DB, `getRateLimitStatus()` falha fechado com `isLimited=true` e `retryAfterSeconds=60` antes do login custom tentar autenticar.

Logs da tentativa corrigida:

- tentativa inicial com expected incorreto: `docs/migration/evidence/phase-01/06-infrastructure-failure/`;
- captura final bem-sucedida: `docs/migration/evidence/phase-01/06-infrastructure-failure-fixed/`.

## Saídas relevantes

- Verificação de portas: `59997`, `59998` e `59999` fechadas.
- Gerador validado por `node --check`: exit code `0`.
- Geração: `2` casos.
- Dry-run: exit code `0`.
- Captura final contra API Node: exit code `0`.
- Goldens salvos:
  - `tests/fixtures/legacy-golden/phase1_6.infrastructure.auth.login_password_db_unavailable.json`;
  - `tests/fixtures/legacy-golden/phase1_6.infrastructure.system.warmup_ollama_unavailable.json`.

## Resumo dos status capturados

| Caso | Status | Body legado relevante |
|---|---:|---|
| DB indisponível em login custom | `429` | `{success:false,error:"Aguarde para tentar novamente.",field:"email",retryAfterSeconds:60}` |
| Ollama indisponível em warmup | `500` | `{success:false,error:"Falha ao carregar modelo de IA."}` |

## Observações de risco para o porte Python

- DB indisponível em auth não pode ser presumido como `503`: neste caminho específico o contrato legado é `429` por falha fechada do rate-limit.
- DB indisponível em rotas protegidas pode ser mascarado como `401` pelo `authMiddleware`; não usar esse resultado como contrato de erro interno da rota.
- Falha de Ollama no warmup não pode derrubar boot global da API; o erro observado é por request e com body legado simples.
- O warmup de embeddings em boot gerou warnings de `fetch failed` quando Ollama estava indisponível, mas não impediu a API de escutar nem a captura final.

## Pendências da etapa 1.6

- Capturar lotes especializados de e-mail, upload, PDF, SSE/assistente, sync externo e embedding/RAG, incluindo suas falhas de infraestrutura quando aplicáveis.
