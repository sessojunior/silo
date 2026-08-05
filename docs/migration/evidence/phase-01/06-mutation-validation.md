# Evidência Fase 1.6 — lote mutation-validation

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas autenticadas e públicas de validação inválida para POST/PUT/PATCH/DELETE REST em que corpo, query ou parâmetro inválido bloqueiam antes de side effects. Esta evidência não conclui a etapa 1.6.

## Critério de inclusão

Cada caso deste lote atende simultaneamente aos critérios abaixo:

1. a rota é POST/PUT/PATCH/DELETE;
2. o payload `{}` ou parâmetro malformado deve produzir `400`;
3. a rejeição acontece antes de escrita em banco, arquivo, e-mail, Kafka, SSE ou WebSocket;
4. a rota não pertence a um lote especializado já definido no plano.

Rotas cujo `{}` pode criar, atualizar, enviar e-mail, iniciar streaming, gerar PDF ou executar comportamento técnico especializado foram excluídas deste lote e registradas abaixo.

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-validation-cases.mjs
node tests\contracts\legacy\generate-mutation-validation-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-validation.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-validation.json --label=06-mutation-validation
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `92` casos a partir de `92` rotas.
- Dry-run: exit code `0`.
- Captura contra API Node: exit code `0`.
- Todos os casos usaram `expectedStatus: [400]`; qualquer resposta diferente teria interrompido o runner.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-validation/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_validation.*.json`.

## Resumo dos status capturados

| Status | Quantidade | Interpretação |
|---:|---:|---|
| `400` | 92 | Validação inválida bloqueada antes de side effects esperados |

## Distribuição por domínio

| Domínio | Quantidade |
|---|---:|
| Auth custom público | 9 |
| AI assistant REST | 1 |
| Chat REST | 7 |
| Contacts | 3 |
| Groups | 5 |
| Help | 1 |
| Incidents | 5 |
| Monitoring | 10 |
| Products | 30 |
| Projects | 10 |
| Tasks | 1 |
| Users | 10 |

## Rotas excluídas deste lote

Exclusões intencionais, com destino de caracterização:

- passthrough Better Auth não pertencente ao `auth-custom`: fases 1.8, 1.9 e inventário de logs da 1.10;
- `GET` com query inválida: já coberto no lote read-probe;
- `POST /api/ai-assistant/threads`: `{}` cria thread;
- `POST /api/ai-assistant/messages/stream`: SSE precisa caracterização byte a byte;
- `DELETE /api/ai-assistant/*`: parâmetros não ficam vazios via matching do Express; not found pertence a lote próprio;
- `PUT /api/help`: `{}` atualmente persiste conteúdo vazio;
- `POST /api/monitoring/seed-radars`: sucesso sem validação de corpo;
- `POST /api/monitoring/products`: `{}` vira lista vazia de produtos e segue para fonte Kafka;
- `POST /api/reports/*/pdf`: PDF/idempotência pertence a lote de artefatos;
- `POST /api/upload/:kind` e `POST /api/users/profile-image`: multipart/upload pertence a lote próprio;
- `DELETE /api/upload/serve/:kind/:filename`: segurança de path/arquivo pertence a lote de upload;
- `POST /api/product-flow/receive`: endpoint público de sync precisa lote próprio;
- `POST /api/users/:id/resend-password-setup`: com id válido pode enviar OTP/e-mail;
- `PATCH /api/chat/presence`: atualiza heartbeat sem validação de corpo.

## Verificações de ausência de efeito colateral de domínio

Após o lote:

| Tabela/fixture | Count |
|---|---:|
| `product` com `fixture-product` | 1 |
| `project` com `10000000-0000-4000-8000-000000000101` | 1 |
| `project_activity` com `10000000-0000-4000-8000-000000000102` | 1 |
| `project_task` com `10000000-0000-4000-8000-000000000103` | 1 |
| `session` | 1 |

O runner cria sessão Better Auth temporária para casos protegidos. Esse é efeito técnico esperado do harness e não mutação de domínio.

## Pendências da etapa 1.6

- Capturar sucesso de POST/PUT/PATCH/DELETE com snapshots DB/arquivo/e-mail/realtime por caso.
- Capturar not found e conflito aplicáveis.
- Capturar falha de infraestrutura aplicável.
- Tratar upload, PDF, SSE, WebSocket, Better Auth passthrough e sync externo em lotes especializados, sem misturar contratos.
