# Fase 1.10 — Inventário por logs de acesso

Data: 2026-07-21  
Fase: `1.10`  
Status: bloqueio original; substituído por decisão compensatória posterior

> Atualização 2026-07-21: a ausência de logs passou a ser tratada como decisão documentada com controles compensatórios. A evidência final da conclusão do item 1.10 está em `docs/migration/evidence/phase-01/10-access-log-compensating-controls.md`.

## Requisito do plano

Consultar logs de acesso de staging/produção por no mínimo 7 dias para descobrir endpoints Better Auth ou externos não chamados pelo código, redigir allowlist final e registrar ausência de endpoints não listados.

## Resultado

A Fase 1.10 não pode ser concluída neste checkout porque não existe fonte local ou configurada de logs reais de staging/produção cobrindo 7 dias.

Pelo plano, não é permitido substituir esse requisito por logs locais de contrato, logs de desenvolvimento, análise estática ou suposição baseada no frontend.

## Verificações executadas

### Arquivos/configuração local

Foram inspecionados:

- `vercel.json`
- `docker-compose.yml`
- `.gitlab-ci.yml`
- `.github/workflows/ci.yml`
- `docs/11-logs.md`
- `docs/13-deploy.md`
- `docs/14-ci-cd.md`
- raiz do repositório
- `.agents`
- `.gitignore`

Resultado:

- `vercel.json` contém somente configuração de build Next.js; não contém fonte de logs.
- `docker-compose.yml` é stack local e não fornece histórico de 7 dias de staging/produção.
- `.gitlab-ci.yml` referencia deploy por SSH, mas os artefatos necessários não existem no checkout atual.
- `docs/14-ci-cd.md` referencia `docker-compose.deploy.yml` e `scripts/gitlab/deploy.sh`, mas ambos estão ausentes.
- `docs/11-logs.md` descreve convenções de logging da aplicação; não define storage, retenção, endpoint de consulta ou credenciais de acesso a logs.
- `.github/workflows/ci.yml` executa CI, não deploy/observabilidade.

### Arquivos de log encontrados

Busca sem considerar `node_modules`, `docs/migration/evidence/**` e `tests/fixtures/**` encontrou apenas:

- `apps/web/.next/dev/logs/next-development.log`

Esse arquivo é log local de desenvolvimento e não satisfaz o requisito de staging/produção por 7 dias.

### Variáveis de ambiente observadas

Não foram encontradas variáveis locais de acesso a GitLab, Vercel, Loki, Datadog, Grafana, Prometheus, deploy, staging ou production. Foram observadas apenas variáveis não aplicáveis ao requisito (`LOGONSERVER`, `RUST_LOG`).

## Comandos relevantes

```powershell
rg --files .github .agents docs -g "!docs/migration/evidence/**" | rg "deploy|log|observ|telemetry|staging|production|access|gitlab|ci"
Test-Path scripts
Test-Path docker-compose.deploy.yml
Test-Path scripts\gitlab\deploy.sh
Get-ChildItem Env: | Where-Object { $_.Name -match 'GITLAB|VERCEL|LOG|LOKI|DATADOG|GRAFANA|PROMETHEUS|DEPLOY|STAGING|PRODUCTION' } | Select-Object Name
Get-ChildItem -Path . -Recurse -File -Include docker-compose.deploy.yml,deploy.sh,*.log,*.jsonl -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\docs\\migration\\evidence\\|\\tests\\fixtures\\' } | Select-Object FullName
```

## Bloqueio

Para concluir a Fase 1.10 é necessário fornecer pelo menos uma das opções abaixo:

1. Arquivo(s) de access log sanitizados cobrindo no mínimo 7 dias de staging e/ou produção.
2. Acesso read-only ao servidor de staging/produção para executar consulta equivalente, com comando definido pelo operador.
3. Acesso read-only à ferramenta de observabilidade usada em produção, com período, filtros e formato de exportação definidos.
4. Export do proxy/load balancer/API gateway contendo método, path, status, origem/User-Agent sanitizados e timestamp.

Sem esses dados, não é possível redigir allowlist final nem declarar ausência de endpoints Better Auth externos não listados.

## Estado do plano

Item 1.10 marcado como bloqueado. Não avançar para 1.11 até resolver este bloqueio.
