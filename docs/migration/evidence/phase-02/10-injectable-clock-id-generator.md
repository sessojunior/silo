# Fase 2.10 — Clock e gerador de IDs injetáveis

Data: 2026-07-22

## Objetivo

Implementar clock injetável e gerador de IDs injetável para testes determinísticos.

## Arquivos criados

- `backend/src/silo/clock.py`
- `backend/tests/unit/test_clock.py`

## Implementação

`backend/src/silo/clock.py` define:

- `Clock` protocol
- `IdGenerator` protocol
- `SystemClock`
- `FrozenClock`
- `Uuid4IdGenerator`
- `SequenceIdGenerator`
- `utc_now(clock=SYSTEM_CLOCK)`
- `new_id(generator=UUID4_ID_GENERATOR)`
- `ensure_utc(value)`
- `parse_uuid(value)`

## Regras

Clock:

- `SystemClock.now()` sempre retorna `datetime` timezone-aware em UTC.
- `FrozenClock` exige `datetime` timezone-aware.
- `FrozenClock.advance(delta)` permite testes determinísticos de passagem de tempo.
- `ensure_utc(value)` rejeita `datetime` naive.

IDs:

- `Uuid4IdGenerator` usa UUID v4 e suporta prefixo opcional.
- `SequenceIdGenerator` é determinístico e destinado a testes.
- `SequenceIdGenerator` rejeita `start < 0`.

## Validações executadas

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q
```

Resultado:

- `ruff format --check .`: aprovado; `9 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 4 source files`.
- `pytest -q`: aprovado; `28 passed`.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu apenas avisos de conversão CRLF/LF nos arquivos TypeScript previamente sujos e fora do escopo:
  - `apps/api/src/scripts/backfill-embeddings.ts`
  - `apps/api/src/services/embedding-write-service.ts`

## Status

Aprovada.
