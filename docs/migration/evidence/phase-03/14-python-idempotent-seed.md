# Fase 3.14 — Seed Python idempotente

Data: 2026-07-22

## Resultado

Seed Python estrutural criada em `apps/backend/src/silo/db/seed.py`.

O comando não roda automaticamente em produção: quando `SILO_ENV=production` ou `NODE_ENV=production`, a execução é recusada sem `--allow-production`.

## Escopo portado

- grupos legados e permissões canônicas;
- usuários institucionais iniciais de desenvolvimento, contas credential, preferências, presença e vínculos com grupos;
- produtos `bam`, `smec`, `brams-ams-15km`, `wrf`;
- contatos globais e vínculos produto-contato;
- categorias de problema, incluindo `Não houve incidentes`;
- ajuda única com id `system-help`, preservando contrato usado pelo Node;
- manuais mínimos por produto e chunks sem embedding;
- fixture mínima de projeto/atividade/tarefa para telas administrativas.

## Controles

- transação única por execução;
- não sobrescreve registros existentes;
- evita bancos administrativos/template (`postgres`, `template0`, `template1`);
- hashes de senha só são gerados quando a conta não existe;
- IDs textuais/UUIDs estáveis onde a tabela não possui unique natural.

## Validação unitária

Comando:

```powershell
uv --directory apps/backend run --locked pytest tests/unit/test_db_seed.py -q
```

Resultado:

```text
5 passed
```

