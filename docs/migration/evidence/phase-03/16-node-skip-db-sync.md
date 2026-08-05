# Fase 3.16 — Node sem DDL no caminho de coexistência

Data: 2026-07-22

## Resultado

`entrypoint-api.sh` foi alterado para respeitar:

- `SKIP_DB_SYNC=1`: não executa `DROP __drizzle_migrations` nem `drizzle-kit push`;
- `SKIP_DB_SEED=1`: não executa a seed Node legada no caminho de coexistência.

O overlay `docker-compose.migration.yml` força ambos para a API Node:

```yaml
api:
  environment:
    SKIP_DB_SYNC: "1"
    SKIP_DB_SEED: "1"
```

O `docker-compose.yml` base expõe as variáveis com default seguro desativado para não mudar o comportamento fora da coexistência:

```yaml
SKIP_DB_SYNC: ${SKIP_DB_SYNC:-0}
SKIP_DB_SEED: ${SKIP_DB_SEED:-0}
```

## Validação

Comandos:

```powershell
uv --directory apps/backend run --locked pytest `
  tests/unit/test_node_coexistence_entrypoint.py `
  tests/unit/test_compose_migration_contract.py -q
```

Resultado: testes de contrato passaram.

Controle adicional: `entrypoint-api.sh` não contém mais `DROP TABLE IF EXISTS __drizzle_migrations`.

