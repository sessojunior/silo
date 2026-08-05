# Fase 1.2 — banco fixture isolado

Data: 2026-07-21  
Status: concluído como artefato versionado aplicável a banco descartável.

## Artefatos criados

- `tests/fixtures/legacy-db/seed-contract-users.sql`
- `tests/fixtures/legacy-db/README.md`

## Fonte técnica usada

- `packages/db/src/schema.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/drizzle.config.ts`
- `apps/api/src/middleware/permissions.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-data.ts`
- rotas em `apps/api/src/routes`

## Decisões fixadas para o fixture

1. O schema base do banco descartável deve ser aplicado por `npm --workspace @silo/database run db:push`, pois esse é o caminho efetivo registrado no plano para o legado.
2. O seed é transacional e restrito a IDs com prefixo `fixture-*`.
3. O fixture contém quatro perfis obrigatórios: admin ativo, usuário ativo com permissões parciais, usuário ativo sem permissão e usuário inativo.
4. Todos os usuários possuem conta `credential` com senha `#Contract123` e hash bcryptjs determinístico.
5. O usuário inativo pertence ao grupo parcial; assim uma falha de autenticação por `is_active=false` não se confunde com falta de permissão.
6. As sessões fixture são auxiliares; o contrato final de cookies ainda depende dos passos 1.8 e 1.9.

## Riscos cobertos

- `group.role = admin` bypassa permissões no middleware legado; por isso o grupo admin mantém `role=admin`.
- O grupo sem permissão tem membership, mas zero linhas em `group_permissions`, permitindo caracterizar 403 sem confundir com usuário sem grupo.
- O grupo parcial inclui `reports:view`, necessário para rotas de relatório e assistente, mas não inclui `manage` nem permissões administrativas.
- `user_preferences.chat_enabled=true` foi preenchido para todos para isolar falhas de chat por permissão e não por preferência.

## Observação operacional

Não apliquei o fixture contra um Postgres local nesta etapa para não alterar estado externo do usuário. A etapa entrega o banco fixture como artefato determinístico, com comandos de aplicação em banco descartável documentados no README.
