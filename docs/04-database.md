# Banco de Dados e Arquitetura

Documentacao do schema do banco, relacoes e fluxo de migracao.

---

## Visao geral

O backend canonico do SILO usa PostgreSQL com SQLAlchemy e Alembic.

- Backend novo: `apps/backend/src/silo/db/`
- Migrations: `apps/backend/migrations/`
- Legacy Drizzle: `packages/db/` apenas como oraculo de migracao

---

## Regras principais

- O banco de verdade continua sendo PostgreSQL.
- Nao execute DDL no boot da aplicacao.
- Alembic e o unico dono das migrations do backend novo.
- Sessoes devem ser assíncronas e por request.
- Transacoes devem ser explıcitas e curtas.

---

## Schema canonico

Os modelos e bases principais ficam em:

- `apps/backend/src/silo/db/base.py`
- `apps/backend/src/silo/db/engine.py`
- `apps/backend/src/silo/db/models.py`

As migrations ficam em:

- `apps/backend/migrations/versions/`

---

## Legado Drizzle

O pacote `packages/db` permanece no repositório para:

- goldens de comparacao;
- contratos da migracao;
- compatibilidade temporaria com o legado Node.

Ele nao e mais a fonte canônica da nova implementacao.

---

## Boas praticas

- Preserve nomes fisicos, tipos, defaults, nullability, FKs e indices.
- Nao compartilhe a mesma sessao entre coroutines concorrentes.
- Evite SQL cru quando a operacao puder ser expressa por modelos ou queries seguras.
- Toda mudanca de schema deve ser acompanhada de migration revisada.

