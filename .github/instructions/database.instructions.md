---
description: "Use when working with SQLAlchemy models, Alembic migrations, transactions, or any file in the Python backend database layer."
applyTo: "apps/backend/**/*.py"
---

# Banco de Dados - SQLAlchemy/Alembic (SILO)

Referência completa: [docs/04-database.md](../../docs/04-database.md)

---

## Importações

```python
from silo.db.base import Base
from silo.db.engine import async_session_factory
from silo.db.models import User, Product
```

---

## Padrões de acesso

- Use sessões assíncronas por request.
- Prefira queries explícitas e transações curtas.
- Preserve nomes físicos, defaults, nullability, índices e FKs caracterizados.
- Não execute DDL em runtime; Alembic é o único dono das migrations.

---

## Schema e migrations

- O schema canônico fica em `apps/backend/src/silo/db/models.py` e módulos correlatos.
- Migrations ficam em `apps/backend/migrations/versions/`.
- Fluxo padrão:
  1. editar models;
  2. gerar migration;
  3. revisar o SQL;
  4. aplicar com o comando do backend.

---

## Boas práticas

- Use `async with` para sessões e transações.
- Não compartilhe sessão entre coroutines concorrentes.
- Não exponha ORM cru na API pública.
- Trate tabelas reservadas e integrações com cuidado explícito.
