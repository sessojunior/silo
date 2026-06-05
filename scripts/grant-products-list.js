#!/usr/bin/env node
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

async function main() {
  const email = process.argv[2] || 'teste@inpe.br';
  const connectionString = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
  if (!connectionString) {
    console.error('ERRO: não há string de conexão com o banco. Defina `DATABASE_URL_DEV` ou `DATABASE_URL`.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      const resUser = await client.query('SELECT id, email, name FROM "user" WHERE email = $1 LIMIT 1', [email]);
      if (resUser.rowCount === 0) {
        console.error(`Usuário não encontrado: ${email}`);
        return;
      }
      const user = resUser.rows[0];
      console.log('Usuário encontrado:', user);

      const resGroups = await client.query('SELECT g.id, g.name, g.role FROM "group" g JOIN user_group ug ON ug.group_id = g.id WHERE ug.user_id = $1', [user.id]);

      if (resGroups.rowCount === 0) {
        console.log('Usuário não pertence a nenhum grupo. Tentando adicionar ao grupo padrão...');
        const defaultGroupRes = await client.query('SELECT id, name FROM "group" WHERE is_default = true LIMIT 1');
        if (defaultGroupRes.rowCount === 0) {
          console.error('Nenhum grupo padrão encontrado. Crie um grupo ou adicione manualmente.');
          return;
        }
        const defaultGroup = defaultGroupRes.rows[0];
        await client.query('INSERT INTO user_group (id, user_id, group_id, joined_at, created_at) VALUES ($1,$2,$3, now(), now())', [randomUUID(), user.id, defaultGroup.id]);
        console.log('Usuário adicionado ao grupo padrão:', defaultGroup.name);
        // reload groups
        const r = await client.query('SELECT g.id, g.name, g.role FROM "group" g JOIN user_group ug ON ug.group_id = g.id WHERE ug.user_id = $1', [user.id]);
        resGroups.rows = r.rows;
      }

      // Verificar permissão existente
      let hasPermission = false;
      for (const group of resGroups.rows) {
        const resPerm = await client.query('SELECT id FROM group_permissions WHERE group_id = $1 AND (COALESCE(resource_v2, resource) = $2) AND (COALESCE(action_v2, action) = $3) LIMIT 1', [group.id, 'products', 'view']);
        if (resPerm.rowCount > 0) {
          console.log(`Grupo ${group.name} já possui products:view`);
          hasPermission = true;
          break;
        }
      }

      if (hasPermission) {
        console.log('Permissão `products:view` já presente via grupo. Nada a fazer.');
        return;
      }

      // Escolher grupo alvo (preferir admin)
      let targetGroup = resGroups.rows.find((g) => g.role === 'admin') || resGroups.rows[0];
      if (!targetGroup) {
        const defaultGroupRes2 = await client.query('SELECT id, name FROM "group" WHERE is_default = true LIMIT 1');
        if (defaultGroupRes2.rowCount === 0) {
          console.error('Nenhum grupo disponível para adicionar permissão.');
          return;
        }
        targetGroup = defaultGroupRes2.rows[0];
        await client.query('INSERT INTO user_group (id, user_id, group_id, joined_at, created_at) VALUES ($1,$2,$3, now(), now())', [randomUUID(), user.id, targetGroup.id]);
        console.log('Usuário adicionado ao grupo', targetGroup.name);
      }

      const permissionId = randomUUID();
      await client.query('INSERT INTO group_permissions (id, group_id, resource, action, resource_v2, action_v2, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6, now(), now())', [permissionId, targetGroup.id, 'products', 'view', 'products', 'view']);
      console.log(`Permissão 'products:view' concedida ao grupo ${targetGroup.name} (id=${targetGroup.id}).`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erro durante operações no banco:', err);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
