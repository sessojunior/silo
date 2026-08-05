# Fase 3.4 — Scripts somente leitura para captura futura de schema

Data: 2026-07-22

## Objetivo

Preparar scripts somente leitura para captura futura de staging/produção, cobrindo extensões, tabelas, colunas, tipos, defaults, sequences, constraints, FKs, índices, triggers, views, grants, row counts e checksums sanitizados via `pg_catalog`/`information_schema`.

Esta etapa não executou DDL, seed, `stamp`, backup, restore, `drizzle-kit push`, migration ou consulta em staging/produção.

## Implementação

Arquivos adicionados/alterados:

- `apps/backend/src/silo/db/schema_capture.py`
- `apps/backend/src/silo/db/url.py`
- `apps/backend/src/silo/db/health.py`
- `apps/backend/tests/unit/test_schema_capture.py`
- `apps/backend/scripts/run-python-module.mjs`
- `package.json`

Comando operacional:

```powershell
npm run py:capture-schema -- --database-url <postgres-url> --pretty --output <arquivo-json-fora-do-git-ou-sanitizado>
```

Também é possível executar o módulo diretamente quando `PYTHONPATH` aponta para `apps/backend/src`:

```powershell
uv --directory apps/backend run --locked python -m silo.db.schema_capture --database-url <postgres-url>
```

O script npm usa `apps/backend/scripts/run-python-module.mjs` apenas para injetar `apps/backend/src` em `PYTHONPATH` no processo filho. Isso evita alterar o empacotamento Python nesta fase.

## Garantias de somente leitura

O capturador:

- abre transação com `SET TRANSACTION READ ONLY`;
- executa apenas queries iniciadas por `SELECT`;
- consulta apenas `pg_catalog` e `information_schema`;
- não executa `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `INSERT`, `UPDATE`, `DELETE`, `GRANT`, `REVOKE` ou `VACUUM`;
- não emite `DATABASE_URL` nem DSN normalizado no JSON;
- calcula checksums sanitizados por tabela a partir de metadados, não de conteúdo de linhas;
- marca cada checksum com `includesRowData: false`.

## Seções capturadas

O JSON emitido contém:

- `extensions`;
- `schemas`;
- `tables`;
- `columns`;
- `types`;
- `sequences`;
- `constraints`;
- `foreign_keys`;
- `indexes`;
- `triggers`;
- `views`;
- `grants`;
- `row_counts`;
- `sanitizedTableChecksums`;
- `fingerprintSha256`.

Observação: `row_counts` usa contagens aproximadas de `pg_stat_user_tables`, adequadas para inventário e comparação de drift sem exportar dados de negócio.

## Validação local contra banco Compose

Execução local resumida:

```text
FingerprintSha256   : 6eab380e8bab1357f2271c8d3dfa65aeb19347d98c9f698c9e4bab1e85fe7ef8
TableCount          : 40
ChecksumCount       : 40
ReadOnly            : True
ContainsDatabaseUrl : False
```

Esse fingerprint é diferente do fingerprint da Fase 3.2 porque a Fase 3.4 usa um payload mais amplo: schemas, grants, constraints renderizadas, FKs, triggers, views, tipos, row counts aproximados e checksums sanitizados por tabela. O fingerprint da Fase 3.2 permanece evidência do snapshot local anterior; o da Fase 3.4 é o fingerprint do novo capturador reutilizável.

## Testes adicionados

`apps/backend/tests/unit/test_schema_capture.py` cobre:

- normalização de URL PostgreSQL para driver `psycopg`;
- presença das seções obrigatórias;
- bloqueio de palavras DDL/DML nas queries catalogadas;
- garantia de que checksums sanitizados não declaram conter dados de linhas;
- execução real opt-in contra DB local via `SILO_SCHEMA_CAPTURE_TEST_DATABASE_URL`.

O teste de integração local foi executado com:

```powershell
$env:SILO_SCHEMA_CAPTURE_TEST_DATABASE_URL='postgresql://silo:silo@localhost:5432/silo'
uv --directory apps/backend run --locked pytest -q tests/unit/test_schema_capture.py::test_schema_capture_runs_against_local_database_when_configured
```

Resultado:

```text
1 passed
```

## Validações executadas

```text
npm run py:sync
npm run py:format:check
npm run py:lint
npm run py:typecheck
npm run py:test
uv --directory apps/backend run --locked pytest -q tests/unit/test_schema_capture.py::test_schema_capture_runs_against_local_database_when_configured
npm run py:capture-schema -- --database-url postgresql://silo:silo@localhost:5432/silo
```

Resultados:

- `py:sync`: aprovado;
- `py:format:check`: aprovado, 21 arquivos formatados;
- `py:lint`: aprovado;
- `py:typecheck`: aprovado, 10 arquivos checados;
- `py:test`: aprovado, 52 passed, 1 skipped, 1 warning `StarletteDeprecationWarning`;
- integração local do capturador: aprovado, 1 passed;
- CLI real contra Compose local: aprovado, 40 tabelas, 40 checksums sanitizados e payload sem DSN.

## Resultado

Fase 3.4 concluída para avanço local. Os scripts estão prontos para captura futura de staging/produção quando houver acesso real. A ausência de captura real externa continua pendente para Subgate 3B e não bloqueia as fases locais seguintes.
