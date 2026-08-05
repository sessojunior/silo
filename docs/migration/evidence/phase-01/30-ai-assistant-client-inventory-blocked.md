# Fase 1.30 — inventário de clientes do assistente por logs

Data: 2026-07-22  
Fase: `1.30`  
Status: bloqueada

## Requisito do plano

Usar logs/telemetria de no mínimo 7 dias para inventariar clientes dos POSTs sync/SSE do assistente por origem e User-Agent sanitizados.

Endpoints em escopo:

- `POST /api/ai-assistant/messages`
- `POST /api/ai-assistant/messages/stream`
- via frontend/proxy: `POST /api/admin/ai-assistant/messages/stream`

O gate também exige confirmar que todos os clientes poderão enviar `X-Idempotency-Key`. Se existir cliente externo, ele precisa ter owner e plano de atualização antes da Fase 13.

## Resultado

O gate não pode ser aprovado neste checkout.

Não há logs/telemetria reais de staging/produção cobrindo 7 dias com método, path, origem/User-Agent sanitizados e timestamp. A análise estática identifica o frontend atual, mas análise estática não satisfaz a exigência da Fase 1.30 e não prova ausência de clientes externos.

## Verificações executadas

### Arquivos e telemetria locais

Busca por arquivos de log/telemetria fora de `node_modules`, `.next`, `dist`, `coverage` e `.git` encontrou apenas artefatos de testes/contratos versionados em `docs/migration/evidence/**` e fixtures. Esses arquivos não são access logs de staging/produção por 7 dias.

Comando:

```powershell
Get-ChildItem -Path . -Recurse -File -Include *.log,*.ndjson,*.jsonl,*access*,*telemetry* -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.next\\|\\dist\\|\\coverage\\|\\.git\\' } |
  Select-Object FullName,Length,LastWriteTime
```

### Docker local

`docker compose ps --format json` mostrou somente `db` e `ollama` em execução. `api`, `web` e `worker` existem como containers antigos, mas estão parados há 12 dias e representam ambiente local, não staging/produção.

Contagem sanitizada de logs Docker locais:

```text
silo-api: totalLines=109, aiAssistantLines=0, userAgentLines=0, originLines=0, requestLikeLines=5
silo-web: totalLines=17, aiAssistantLines=0, userAgentLines=0, originLines=0, requestLikeLines=0
```

Esses logs não possuem origem/User-Agent, não cobrem o requisito e não provam inventário de clientes.

### Logging da aplicação

Busca por middleware de access log ou telemetria HTTP em `apps/api/src` e `apps/web/src` não encontrou configuração que registre método, path, origem e User-Agent para os endpoints do assistente.

Comando:

```powershell
rg -n "morgan|express-winston|pino-http|requestLogger|access|logger|User-Agent|user-agent|req\\.headers|origin" apps\api\src apps\web\src
```

### Cliente web atual

Análise estática do frontend encontrou um cliente direto:

- Arquivo: `apps/web/src/app/admin/ai-assistant/page.tsx`
- Chamada: `fetch(config.getAssistantApiUrl("/api/admin/ai-assistant/messages/stream"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, ... })`
- Header de idempotência atual: ausente.

Isto prova que o frontend versionado precisa ser alterado em fase posterior para enviar `X-Idempotency-Key`, mas não prova que ele seja o único cliente.

### API Node atual

`apps/api/src/routes/ai-assistant.ts` expõe:

- `POST /messages`
- `POST /messages/stream`

As rotas atuais validam apenas body/autorização e não leem nem exigem `X-Idempotency-Key`.

## Relação com a Fase 1.10

A decisão compensatória da Fase 1.10 é limitada ao inventário de Better Auth/endpoints externos e afirma explicitamente:

> Esta decisão é limitada ao item 1.10. Ela não conclui nem relaxa o item 1.30, que ainda exige logs/telemetria de clientes dos POSTs sync/SSE do assistente.

Portanto, não é permitido reutilizar a compensação da 1.10 para aprovar este gate.

## Bloqueio

Sem logs/telemetria reais de 7 dias, não é possível:

1. inventariar clientes por origem/User-Agent;
2. confirmar ausência de cliente externo;
3. atribuir owner a todos os consumidores;
4. confirmar compatibilidade de todos os clientes com `X-Idempotency-Key`;
5. autorizar a Fase 13 a assumir idempotência obrigatória sem risco de quebrar cliente desconhecido.

## Para desbloquear

É necessário um dos seguintes caminhos:

1. fornecer export sanitizado de logs/telemetria reais de pelo menos 7 dias contendo timestamp, método, path, status, origem e User-Agent sanitizados; ou
2. conceder acesso read-only equivalente a observabilidade/proxy/API gateway para consulta controlada; ou
3. autorizar uma alteração explícita da documentação de migração para substituir este gate por controles compensatórios específicos da Fase 1.30, com aceitação formal do risco residual de clientes externos desconhecidos.

Até isso acontecer, a Fase 1.30 permanece bloqueada e nenhuma fase posterior deve ser iniciada.
