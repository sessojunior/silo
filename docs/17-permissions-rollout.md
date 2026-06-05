# Rollout & Migração: Simplificação do Sistema de Permissões

Este documento descreve os passos recomendados para aplicar a migração compatível (`0005_simplify_permissions.sql`) em um ambiente com PostgreSQL (staging/produção), validar o resultado e reverter caso necessário.

Resumo da estratégia
- Deployar o backend com leitura compatível (COALESCE(resource_v2, resource)) primeiro.
- Rodar a migration/backfill que adiciona `resource_v2`/`action_v2`, popula-os a partir dos valores legados, deduplica e insere entradas `manage` para grupos `admin`.
- Verificar resultados e realizar testes de aceitação.
- Deployar front-end (versão que usa `hasPermission`/`hasAnyPermission`) após verificação.

Pré-requisitos
- Acesso à DB de staging (variável `DATABASE_URL` configurada). Pode ser `postgres://user:pass@host:port/dbname`.
- `psql` disponível (ou outra ferramenta SQL) no host onde você executará a migration.
- Backup completo do banco antes de aplicar a migration.
- Janela de manutenção (recomendada) caso haja riscos durante backfill/dedupe.

Passos detalhados

1) Backup

Execute um dump do banco antes de qualquer alteração:

```bash
# Cria um backup custom (recomendo guardar com timestamp)
export DUMP_FILE="backup_permissions_before_$(date +%Y%m%d%H%M).dump"
pg_dump "$DATABASE_URL" -Fc -f "$DUMP_FILE"
# Alternativamente (texto SQL):
# pg_dump "$DATABASE_URL" -f backup_permissions_before.sql
```

2) Deploy do backend (read-compat)

Garanta que a versão do backend que contém a leitura compatível (`COALESCE(resource_v2, resource)` / canonicalização) esteja deployada em staging antes de rodar a migration. Isso permite que a aplicação leia permissões antigas enquanto a coluna v2 é populada.

Exemplo (git):

```bash
git checkout my/permission-compat-branch
# build e deploy conforme seu fluxo (CI/CD)
# exemplo local (dev):
npm run build --workspace=@silo/api
# start staging process / redeploy container
```

3) Aplicar a migration (executar SQL)

Execute o arquivo SQL gerado em `packages/db/drizzle/0005_simplify_permissions.sql` contra a DB de staging.

```bash
# Conectando e executando o script
psql "$DATABASE_URL" -f packages/db/drizzle/0005_simplify_permissions.sql
```

Se você não tiver `psql`, pode usar o cliente da sua escolha ou a ferramenta de migrations do projeto (ex.: drizzle-cli). Exemplo usando drizzle-kit (se aplicável):

```bash
# (opcional) se o projeto usa drizzle-kit configurado
cd packages/db
npx drizzle-kit migrate:latest --connection "$DATABASE_URL" --migrations ./drizzle
```

4) Verificações pós-migração

Execute consultas para validar que os campos v2 foram populados e que não há entradas nulas ou duplicadas indesejadas:

```bash
# Quantas linhas sem resource_v2?
psql "$DATABASE_URL" -c "select count(*) from group_permissions where resource_v2 is null;"

# Distribuição por resource_v2/action_v2
psql "$DATABASE_URL" -c "select resource_v2, action_v2, count(*) from group_permissions group by 1,2 order by 3 desc;"

# Verificar se grupos admin receberam 'manage'
psql "$DATABASE_URL" -c "select g.id, g.name, gp.resource_v2, gp.action_v2 from group_permissions gp join \"group\" g on gp.group_id = g.id where g.role = 'admin' order by g.id limit 100;"
```

5) Testes de aceitação

- Autentique-se como um usuário admin (`isAdmin:true`) e verifique menus e páginas críticas (produtos, projetos, grupos, relatórios, chat).
- Teste um usuário de grupo não-admin com permissões específicas.
- Tente atualizar permissões via API (PUT `/api/admin/groups/permissions`) em um grupo não-admin (staging) e observe resposta HTTP 200.

6) Deploy do frontend

Depois da validação, deploye a versão do front-end que consome a API e usa `hasPermission`/`hasAnyPermission`.

7) Monitoramento e rollback

- Caso haja erros graves, restaure o backup:

```bash
# Restaurar backup custom (pg_restore)
pg_restore --clean --no-owner --dbname="$DATABASE_URL" "$DUMP_FILE"
```

- Monitore logs da API e front-end por 30-60 minutos após o rollout.

Notas e considerações

- A migração é desenhada para ser compatível em leitura; o deploy do backend contendo as mudanças de leitura deve preceder a migração.
- Se você preferir zero-downtime absoluto, coordene deployments e migration em janelas e desative jobs que escrevem permissões durante o backfill.
- Se o `psql` não estiver disponível no ambiente CI, crie um job no CI que execute o SQL no host com conexão ao DB.

Se quiser, eu posso gerar um script pequeno para executar as verificações pós-migração e/ou um `Makefile`/`npm script` para centralizar os passos acima.
