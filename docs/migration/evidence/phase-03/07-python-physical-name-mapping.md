# Fase 3.7 — Mapeamento de nomes Python e nomes físicos

Data: 2026-07-22

## Objetivo

Criar um contrato explícito para resolver nomes Python `snake_case` para os nomes físicos já existentes no PostgreSQL, sem renomear tabela ou coluna por convenção.

## Decisão aplicada

As 40 tabelas e 323 colunas atuais já usam nomes físicos compatíveis com `snake_case`. Portanto, nesta fase o mapeamento é intencionalmente identidade:

- `python_name == physical_name` para tabelas;
- `python_name == physical_name` para colunas;
- `Column.key` recebe o nome Python;
- `Column.name` preserva o nome físico.

Qualquer alias futuro não-identidade deve ser adicionado explicitamente ao mapeamento e testado. Não há conversão implícita de camelCase, pluralização, singularização ou renome por estilo.

## Arquivos alterados

- `apps/backend/src/silo/db/models.py`
- `apps/backend/tests/unit/test_sqlalchemy_models.py`

## Contratos adicionados

- `NameMapping`
- `TABLE_NAME_MAPPINGS`
- `COLUMN_NAME_MAPPINGS`
- `PYTHON_TABLE_TO_PHYSICAL`
- `PHYSICAL_TABLE_TO_PYTHON`
- `PYTHON_COLUMNS_TO_PHYSICAL`
- `PHYSICAL_COLUMNS_TO_PYTHON`
- `physical_table_name()`
- `python_table_name()`
- `physical_column_name()`
- `python_column_name()`

## Hashes de controle

- `apps/backend/src/silo/db/models.py`: `69293DDB1DDFC28989F053EE1987334DD977163948F45A1227A998BB2787FA72`
- `apps/backend/tests/unit/test_sqlalchemy_models.py`: `5C2FF8783F9090554243AC967530569C72D4AE26BC500A0E1E43220B5707B25E`

## Validações executadas

O primeiro `py:format:check` detectou que `apps/backend/tests/unit/test_sqlalchemy_models.py` precisava de formatação. A causa foi corrigida com `ruff format .` e o comando completo foi repetido com sucesso.

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:format:check

> py:format:check
> uv --directory apps/backend run --locked ruff format --check .

23 files already formatted
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:lint

> py:lint
> uv --directory apps/backend run --locked ruff check .

All checks passed!
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:typecheck

> py:typecheck
> uv --directory apps/backend run --locked mypy src

Success: no issues found in 11 source files
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:test

> py:test
> uv --directory apps/backend run --locked pytest -q

....................................s....................                [100%]
56 passed, 1 skipped, 1 warning in 0.94s
```

## Gate da fase

A Fase 3.7 está aprovada localmente. O teste bloqueia nomes Python fora de `snake_case`, garante bijeção entre nomes Python/físicos e confirma que o SQLAlchemy preserva `Column.name` como nome físico existente.
