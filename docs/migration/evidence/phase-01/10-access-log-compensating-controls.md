# Fase 1.10 — Decisão de ausência de logs e controles compensatórios

Data: 2026-07-21  
Fase: `1.10`  
Status: concluído por decisão documentada autorizada pelo usuário

## Decisão

Não existem logs reais de staging/produção disponíveis para consulta por 7 dias, e o usuário informou que não consegue fornecer esses dados.

Com autorização explícita do usuário em 2026-07-21, a Fase 1.10 deixa de exigir logs históricos inexistentes e passa a ser satisfeita por:

1. inventário estático das rotas `/api/auth/*` usadas pelo frontend, matriz e goldens;
2. inventário estático dos endpoints inbound externos já expostos/caracterizados;
3. allowlist versionada;
4. teste executável que falha se frontend, rotas custom ou casos de contrato usarem `/api/auth/*` fora da allowlist;
5. registro de risco e obrigação de bloquear a migração se logs futuros mostrarem endpoint não allowlisted antes do cutover.

Esta decisão é limitada ao item 1.10. Ela não conclui nem relaxa o item 1.30, que ainda exige logs/telemetria de clientes dos POSTs sync/SSE do assistente.

## Artefatos

- `docs/migration/access-log-compensating-allowlist.json`
- validador histórico de allowlist de acesso
- `docs/migration/evidence/phase-01/10-access-log-inventory-blocked.md`

## Validação executável

Comandos:

```powershell
node --check <legacy-access-log-assertor>.mjs
node <legacy-access-log-assertor>.mjs
```

Resultado:

```text
[legacy-contract] validated access-log compensating allowlist: 14 auth endpoints, 4 external inbound endpoints
```

## Allowlist de auth resultante

| Método | Path | Fonte/owner |
|---|---|---|
| GET | `/api/auth/get-session` | custom auth + frontend SSR |
| POST | `/api/auth/login/password` | custom auth + login frontend |
| POST | `/api/auth/login-email/send-otp` | custom auth + login OTP frontend |
| POST | `/api/auth/login-email/verify-otp` | custom auth + login OTP frontend |
| POST | `/api/auth/sign-up/email` | custom auth + cadastro frontend |
| POST | `/api/auth/sign-up/email/send-otp` | custom auth + cadastro/login frontend |
| POST | `/api/auth/sign-up/email/verify-otp` | custom auth + cadastro/login frontend |
| POST | `/api/auth/forget-password` | custom auth + recuperação frontend |
| POST | `/api/auth/forget-password/verify-otp` | custom auth + recuperação frontend |
| POST | `/api/auth/setup-password` | custom auth + recuperação/setup frontend |
| GET | `/api/auth/login-google` | custom Google + login/cadastro frontend |
| GET | `/api/auth/callback/google` | Better Auth passthrough + Google OAuth |
| POST | `/api/auth/sign-in/email` | Better Auth passthrough caracterizado |
| POST | `/api/auth/sign-out` | Better Auth passthrough + logout frontend |

Qualquer outra rota Better Auth é não contratual nesta migração, salvo se descoberta por logs futuros antes do cutover. Nesse caso a migração deve parar, caracterizar o endpoint e atualizar matriz/goldens/plano.

## Allowlist inbound externa resultante

| Método | Path | Owner/fonte |
|---|---|---|
| GET | `/health` | health operacional |
| POST | `/api/warmup` | warmup do web/instrumentation e modelo |
| POST | `/api/product-flow/receive` | sync externo product-flow |
| POST | `/api/monitoring/products` | ponte frontend para Kafka REST monitoring |

Integrações Ollama, Kafka REST Proxy, SMTP e Google OAuth outbound não são novos endpoints inbound da API; seus contratos continuam cobertos nos itens específicos da Fase 1.

## Descoberta não contratual

`/api/auth/login` aparece apenas como exemplo/comentário em `apps/web/src/lib/config.ts`. Não há rota, chamada de frontend, matriz ou golden que o trate como endpoint real.

## Risco aceito

Sem access logs históricos, ainda existe risco residual de cliente externo desconhecido usando rota Better Auth passthrough não listada. O controle aceito é:

- só portar para Python a allowlist versionada;
- adicionar access logging antes de staging/cutover conforme fases posteriores;
- bloquear a migração se qualquer log futuro mostrar endpoint não allowlisted;
- não tratar ausência de evidência histórica como prova de ausência de cliente externo.

## Arquivo de bloqueio anterior

`docs/migration/evidence/phase-01/10-access-log-inventory-blocked.md` permanece como evidência da lacuna original. Este arquivo registra a decisão posterior que substitui o bloqueio para permitir seguir a Fase 1.
