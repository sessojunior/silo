# Fase 3.8 — Timestamp sem timezone e serialização compatível

Data: 2026-07-22

## Objetivo

Mapear timestamps sem timezone como `DateTime(timezone=False)` e criar serialização compatível com o contrato legado, sem reinterpretar os valores como UTC.

## Implementação

- `apps/backend/src/silo/db/models.py`: todas as colunas `timestamp` continuam usando `DateTime(timezone=False)`.
- `apps/backend/src/silo/db/serialization.py`: adiciona `serialize_legacy_timestamp()` e `serialize_legacy_date()`.

## Regra fixada

Timestamp legado é tratado como valor sem timezone armazenado no PostgreSQL. Para serialização HTTP compatível com o Node, o valor naive é materializado no timezone operacional `America/Sao_Paulo` e então serializado em ISO UTC com `Z`, como `Date#toJSON()` faria.

Datetime aware é rejeitado, para impedir mistura silenciosa com `timestamptz`.

Goldens validados:

- `2026-07-22 09:30:15.123456` → `2026-07-22T12:30:15.123Z`
- `2026-01-22 09:30:15` → `2026-01-22T12:30:15.000Z`
- `date(2026, 7, 22)` → `2026-07-22`

## Hashes de controle

- `apps/backend/src/silo/db/models.py`: `59889D6830CE3AC68597E75BDE157F070B1EA89272F4CA903E6EA291A7518A90`
- `apps/backend/src/silo/db/serialization.py`: `7C77E7A9B401A17A9DD5A8C0B8EA35FD1BAD6E1F343E1ED467DD8A84266A1FCA`
- `apps/backend/tests/unit/test_sqlalchemy_models.py`: `37381F030680CAF67616D580F34C0BCBAEAD3BB31E498181DB363951AE925499`

## Validações executadas

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:format:check
23 files already formatted
24 files already formatted
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:lint
All checks passed!
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:typecheck
Success: no issues found in 12 source files
```

```text
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"; npm run py:test
60 passed, 1 skipped, 1 warning in 0.90s
```

## Gate da fase

A Fase 3.8 está aprovada localmente. O primeiro gate de formatação e alguns testes falharam durante a implementação; as causas foram corrigidas e os comandos completos foram repetidos com sucesso.
