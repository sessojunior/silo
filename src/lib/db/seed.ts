import "dotenv/config";
import { randomUUID } from "crypto";
import { eq, inArray, and, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/hash";
import { createLocalDate, normalizeUploadsSrc } from "@/lib/utils";
import {
  NO_INCIDENTS_CATEGORY_ID,
  NO_INCIDENTS_CATEGORY_NAME,
} from "@/lib/constants";

// Importar dados do arquivo separado
import {
  products,
  groups,
  contacts,
  testUsers,
  dependencyStructure,
  projectsData,
  helpDocumentation,
  manualData,
  generateProblems,
  generateSolutions,
  projectActivitiesData,
} from "./seedData";

// === TIPAGENS DO SCHEMA ===
type ProductDependency = typeof schema.productDependency.$inferInsert;

// === INTERFACES AUXILIARES ===
export interface DependencyItem {
  name: string;
  icon: string | null;
  description?: string;
  children?: DependencyItem[];
}

type GroupPermissionSeed = {
  resource: string;
  action: string;
};

const defaultGroupPermissions: GroupPermissionSeed[] = [
  { resource: "dashboard", action: "view" },
  { resource: "projects", action: "list" },
  { resource: "products", action: "list" },
  { resource: "help", action: "view" },
];

const allGroupPermissions: GroupPermissionSeed[] = [
  { resource: "users", action: "list" },
  { resource: "users", action: "create" },
  { resource: "users", action: "update" },
  { resource: "users", action: "delete" },
  { resource: "groups", action: "list" },
  { resource: "groups", action: "create" },
  { resource: "groups", action: "update" },
  { resource: "groups", action: "delete" },
  { resource: "projects", action: "list" },
  { resource: "projects", action: "create" },
  { resource: "projects", action: "update" },
  { resource: "projects", action: "delete" },
  { resource: "projectActivities", action: "list" },
  { resource: "projectActivities", action: "create" },
  { resource: "projectActivities", action: "update" },
  { resource: "projectActivities", action: "delete" },
  { resource: "projectTasks", action: "list" },
  { resource: "projectTasks", action: "create" },
  { resource: "projectTasks", action: "update" },
  { resource: "projectTasks", action: "delete" },
  { resource: "projectTasks", action: "assign" },
  { resource: "projectTasks", action: "history" },
  { resource: "products", action: "list" },
  { resource: "products", action: "create" },
  { resource: "products", action: "update" },
  { resource: "products", action: "delete" },
  { resource: "productActivities", action: "list" },
  { resource: "productActivities", action: "create" },
  { resource: "productActivities", action: "update" },
  { resource: "productActivities", action: "delete" },
  { resource: "productProblems", action: "list" },
  { resource: "productProblems", action: "create" },
  { resource: "productProblems", action: "update" },
  { resource: "productProblems", action: "delete" },
  { resource: "productSolutions", action: "list" },
  { resource: "productSolutions", action: "create" },
  { resource: "productSolutions", action: "update" },
  { resource: "productSolutions", action: "delete" },
  { resource: "productDependencies", action: "list" },
  { resource: "productDependencies", action: "create" },
  { resource: "productDependencies", action: "update" },
  { resource: "productDependencies", action: "delete" },
  { resource: "productDependencies", action: "reorder" },
  { resource: "productManual", action: "view" },
  { resource: "productManual", action: "update" },
  { resource: "contacts", action: "list" },
  { resource: "contacts", action: "create" },
  { resource: "contacts", action: "update" },
  { resource: "contacts", action: "delete" },
  { resource: "incidents", action: "list" },
  { resource: "incidents", action: "create" },
  { resource: "incidents", action: "update" },
  { resource: "incidents", action: "delete" },
  { resource: "dashboard", action: "view" },
  { resource: "dashboard", action: "update" },
  { resource: "dashboard", action: "delete" },
  { resource: "reports", action: "view" },
  { resource: "help", action: "view" },
  { resource: "help", action: "update" },
  { resource: "chat", action: "view_private" },
  { resource: "chat", action: "view_group" },
  { resource: "chat", action: "send_private" },
  { resource: "chat", action: "send_group_all" },
  { resource: "chat", action: "presence" },
];

// === FUNÇÕES AUXILIARES ===
async function insertDependencies(
  productId: string,
  dependencies: DependencyItem[],
  parentId: string | null = null,
  parentPath: string = "",
  parentDepth: number = 0,
): Promise<void> {
  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i];
    const currentPath = parentPath ? `${parentPath}/${i + 1}` : `${i + 1}`;
    const currentDepth = parentDepth;
    const sortKey = parentPath
      ? `${parentPath.replace(/\//g, ".")}.${String(i + 1).padStart(3, "0")}`
      : String(i + 1).padStart(3, "0");

    const dependencyData: ProductDependency = {
      id: randomUUID(),
      productId,
      name: dependency.name,
      icon: dependency.icon,
      description: dependency.description || null,
      parentId,
      treePath: currentPath,
      treeDepth: currentDepth,
      sortKey,
    };

    const [insertedDependency] = await db
      .insert(schema.productDependency)
      .values(dependencyData)
      .returning();

    if (dependency.children && dependency.children.length > 0) {
      await insertDependencies(
        productId,
        dependency.children,
        insertedDependency.id,
        currentPath,
        currentDepth + 1,
      );
    }
  }
}

async function checkTableData(
  tableName: string,
  queryFn: () => Promise<unknown[]>,
): Promise<{ hasData: boolean; count: number }> {
  try {
    const data = await queryFn();
    return { hasData: data.length > 0, count: data.length };
  } catch (error) {
    console.error(`❌ Erro ao verificar tabela ${tableName}:`, error);
    return { hasData: false, count: 0 };
  }
}

async function normalizeUploadUrls(): Promise<void> {
  const uploadKinds = [
    "general",
    "avatars",
    "contacts",
    "problems",
    "solutions",
  ] as const;
  const likePatterns = uploadKinds.map((kind) => `%/${kind}/%`);

  const [users, contacts, problemImages, solutionImages] = await Promise.all([
    db
      .select({ id: schema.authUser.id, url: schema.authUser.image })
      .from(schema.authUser)
      .where(sql`${schema.authUser.image} IS NOT NULL`),
    db
      .select({ id: schema.contact.id, url: schema.contact.image })
      .from(schema.contact)
      .where(sql`${schema.contact.image} IS NOT NULL`),
    db
      .select({
        id: schema.productProblemImage.id,
        url: schema.productProblemImage.image,
      })
      .from(schema.productProblemImage)
      .where(sql`${schema.productProblemImage.image} IS NOT NULL`),
    db
      .select({
        id: schema.productSolutionImage.id,
        url: schema.productSolutionImage.image,
      })
      .from(schema.productSolutionImage)
      .where(sql`${schema.productSolutionImage.image} IS NOT NULL`),
  ]);

  const isUploadCandidate = (value: string): boolean =>
    likePatterns.some((pattern) => value.includes(pattern.slice(1, -1)));

  const userUpdates = users
    .map((row) => ({ id: row.id, url: row.url }))
    .filter(
      (row): row is { id: string; url: string } =>
        typeof row.url === "string" && isUploadCandidate(row.url),
    )
    .map((row) => ({
      id: row.id,
      normalized: normalizeUploadsSrc(row.url),
      original: row.url,
    }))
    .filter((row) => row.normalized !== row.original);

  const contactUpdates = contacts
    .map((row) => ({ id: row.id, url: row.url }))
    .filter(
      (row): row is { id: string; url: string } =>
        typeof row.url === "string" && isUploadCandidate(row.url),
    )
    .map((row) => ({
      id: row.id,
      normalized: normalizeUploadsSrc(row.url),
      original: row.url,
    }))
    .filter((row) => row.normalized !== row.original);

  const problemImageUpdates = problemImages
    .map((row) => ({ id: row.id, url: row.url }))
    .filter(
      (row): row is { id: string; url: string } =>
        typeof row.url === "string" && isUploadCandidate(row.url),
    )
    .map((row) => ({
      id: row.id,
      normalized: normalizeUploadsSrc(row.url),
      original: row.url,
    }))
    .filter((row) => row.normalized !== row.original);

  const solutionImageUpdates = solutionImages
    .map((row) => ({ id: row.id, url: row.url }))
    .filter(
      (row): row is { id: string; url: string } =>
        typeof row.url === "string" && isUploadCandidate(row.url),
    )
    .map((row) => ({
      id: row.id,
      normalized: normalizeUploadsSrc(row.url),
      original: row.url,
    }))
    .filter((row) => row.normalized !== row.original);

  await Promise.all([
    ...userUpdates.map((row) =>
      db
        .update(schema.authUser)
        .set({ image: row.normalized })
        .where(eq(schema.authUser.id, row.id)),
    ),
    ...contactUpdates.map((row) =>
      db
        .update(schema.contact)
        .set({ image: row.normalized })
        .where(eq(schema.contact.id, row.id)),
    ),
    ...problemImageUpdates.map((row) =>
      db
        .update(schema.productProblemImage)
        .set({ image: row.normalized })
        .where(eq(schema.productProblemImage.id, row.id)),
    ),
    ...solutionImageUpdates.map((row) =>
      db
        .update(schema.productSolutionImage)
        .set({ image: row.normalized })
        .where(eq(schema.productSolutionImage.id, row.id)),
    ),
  ]);

  const total =
    userUpdates.length +
    contactUpdates.length +
    problemImageUpdates.length +
    solutionImageUpdates.length;
  if (total === 0) return;

  console.log(`✅ URLs de upload normalizadas: ${total} registro(s)`);
}

// === FUNÇÃO PRINCIPAL ===
async function seed() {
  console.log("🔵 Iniciando seed do sistema...");
  console.log("🔵 Verificando tabelas existentes...");

  await normalizeUploadUrls();

  // === VERIFICAÇÕES INDIVIDUAIS DE TABELAS ===
  const tableChecks = await Promise.all([
    checkTableData("groups", () => db.select().from(schema.group).limit(1)),
    checkTableData("users", () => db.select().from(schema.authUser).limit(1)),
    checkTableData("products", () => db.select().from(schema.product).limit(1)),
    checkTableData("contacts", () => db.select().from(schema.contact).limit(1)),
    checkTableData("projects", () => db.select().from(schema.project).limit(1)),
    checkTableData("project_activities", () =>
      db.select().from(schema.projectActivity).limit(1),
    ),
    checkTableData("help", () => db.select().from(schema.help).limit(1)),
    checkTableData("chat_user_presence", () =>
      db.select().from(schema.chatUserPresence).limit(1),
    ),
    checkTableData("chat_messages", () =>
      db.select().from(schema.chatMessage).limit(1),
    ),
  ]);

  const [
    groupsCheck,
    usersCheck,
    productsCheck,
    contactsCheck,
    projectsCheck,
    activitiesCheck,
    helpCheck,
    presenceCheck,
    messagesCheck,
  ] = tableChecks;

  console.log(`📊 Status das tabelas:`);
  console.log(
    `   - Grupos: ${groupsCheck.hasData ? `✅ COM DADOS (${groupsCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Usuários: ${usersCheck.hasData ? `✅ COM DADOS (${usersCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Produtos: ${productsCheck.hasData ? `✅ COM DADOS (${productsCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Contatos: ${contactsCheck.hasData ? `✅ COM DADOS (${contactsCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Projetos: ${projectsCheck.hasData ? `✅ COM DADOS (${projectsCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Atividades: ${activitiesCheck.hasData ? `✅ COM DADOS (${activitiesCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Ajuda: ${helpCheck.hasData ? `✅ COM DADOS (${helpCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Chat Presença: ${presenceCheck.hasData ? `✅ COM DADOS (${presenceCheck.count})` : "🔄 VAZIA"}`,
  );
  console.log(
    `   - Mensagens Chat: ${messagesCheck.hasData ? `✅ COM DADOS (${messagesCheck.count})` : "🔄 VAZIA"}`,
  );

  // Variáveis para controle de fluxo
  let insertedGroups: (typeof schema.group.$inferSelect)[] = [];
  let defaultGroup: typeof schema.group.$inferSelect | null = null;
  let userId = "";
  const productMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();
  let insertedContacts: (typeof schema.contact.$inferSelect)[] = [];

  try {
    // === 1. CRIAR GRUPOS ===
    if (!groupsCheck.hasData) {
      console.log("🔵 Criando grupos do sistema...");
      insertedGroups = await db
        .insert(schema.group)
        .values(
          groups.map((group) => ({
            id: randomUUID(),
            ...group,
          })),
        )
        .returning();

      defaultGroup = insertedGroups.find((g) => g.isDefault) || null;
      if (!defaultGroup) {
        throw new Error("Grupo padrão não encontrado!");
      }

      console.log(`✅ ${insertedGroups.length} grupos criados com sucesso!`);
      console.log(`✅ Grupo padrão: ${defaultGroup.name}`);
    } else {
      console.log("⚠️ Grupos já existem, pulando...");
      insertedGroups = await db.select().from(schema.group);
      defaultGroup = insertedGroups.find((g) => g.isDefault) || null;
    }

    for (const groupItem of insertedGroups) {
      const targetPermissions =
        groupItem.role === "admin"
          ? allGroupPermissions
          : defaultGroupPermissions;

      const existingPermissions = await db
        .select({
          resource: schema.groupPermission.resource,
          action: schema.groupPermission.action,
        })
        .from(schema.groupPermission)
        .where(eq(schema.groupPermission.groupId, groupItem.id));

      const existingSet = new Set(
        existingPermissions.map(
          (permission) => `${permission.resource}:${permission.action}`,
        ),
      );

      const missingPermissions = targetPermissions.filter(
        (permission) =>
          !existingSet.has(`${permission.resource}:${permission.action}`),
      );

      if (missingPermissions.length > 0) {
        await db.insert(schema.groupPermission).values(
          missingPermissions.map((permission) => ({
            groupId: groupItem.id,
            resource: permission.resource,
            action: permission.action,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    }

    // === 2. CRIAR USUÁRIO PRINCIPAL ===
    if (!usersCheck.hasData) {
      console.log("🔵 Criando usuário principal: Mario Junior...");
      userId = randomUUID();
      const hashedPassword = await hashPassword("#Admin123");

      await db.insert(schema.authUser).values({
        id: userId,
        name: "Mario Junior",
        email: "teste@inpe.br",
        emailVerified: true,
        isActive: true,
        lastLogin: null,
      });

      await db.insert(schema.authAccount).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword, // Senha: #Admin123
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Adicionar aos grupos específicos conforme especificação
      console.log(
        "🔵 Adicionando Mario Junior aos grupos Administradores e Suporte...",
      );
      const adminGroup = insertedGroups.find(
        (g) => g.name === "Administradores",
      );
      const supportGroup = insertedGroups.find((g) => g.name === "Suporte");

      if (adminGroup) {
        await db.insert(schema.userGroup).values({
          userId: userId,
          groupId: adminGroup.id,
        });
      }

      if (supportGroup) {
        await db.insert(schema.userGroup).values({
          userId: userId,
          groupId: supportGroup.id,
        });
      }
      console.log(
        "✅ Mario Junior adicionado aos grupos Administradores e Suporte!",
      );

      // Criar perfil
      await db.insert(schema.userProfile).values({
        id: randomUUID(),
        userId: userId,
        genre: "Masculino",
        phone: "+55 11 99999-9999",
        role: "Administrador",
        team: "CPTEC",
        company: "INPE",
        location: "São José dos Campos, SP",
      });

      // Criar preferências
      await db.insert(schema.userPreferences).values({
        id: randomUUID(),
        userId: userId,
        chatEnabled: false, // Chat desativado conforme especificação
      });

      console.log("✅ Usuário Mario Junior criado com sucesso!");
    } else {
      console.log(
        "⚠️ Usuários já existem, pulando criação do usuário principal...",
      );
      const existingUser = await db
        .select()
        .from(schema.authUser)
        .where(eq(schema.authUser.email, "teste@inpe.br"))
        .limit(1);
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      }
    }

    // === 3. CRIAR USUÁRIOS DE TESTE PARA CHAT ===
    const existingTestEmails = await db
      .select({ email: schema.authUser.email })
      .from(schema.authUser)
      .where(
        inArray(
          schema.authUser.email,
          testUsers.map((u) => u.email),
        ),
      );

    const existingEmailSet = new Set(existingTestEmails.map((u) => u.email));
    const usersToCreate = testUsers.filter(
      (u) => !existingEmailSet.has(u.email),
    );

    if (usersToCreate.length > 0) {
      console.log("🔵 Criando usuários de teste para chat...");
      const createdUserIds: string[] = [];

      // Gerar hash da senha padrão para todos os usuários de teste
      const hashedPassword = await hashPassword("#User123");

      for (const user of usersToCreate) {
        const newUserId = randomUUID();

        await db.insert(schema.authUser).values({
          id: newUserId,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
        });

        await db.insert(schema.authAccount).values({
          id: randomUUID(),
          accountId: newUserId,
          providerId: "credential",
          userId: newUserId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Criar preferências padrão para o usuário
        await db.insert(schema.userPreferences).values({
          id: randomUUID(),
          userId: newUserId,
          chatEnabled: true, // Chat ativado por padrão
        });

        createdUserIds.push(newUserId);
      }

      // Associar usuários aos grupos específicos conforme especificação
      console.log("🔵 Associando usuários aos grupos específicos...");

      for (let i = 0; i < usersToCreate.length; i++) {
        const user = usersToCreate[i];
        const newUserId = createdUserIds[i];

        // Encontrar o grupo baseado no groupName do usuário
        const targetGroup = insertedGroups.find(
          (g) => g.name === user.groupName,
        );

        if (targetGroup) {
          await db.insert(schema.userGroup).values({
            userId: newUserId,
            groupId: targetGroup.id,
          });
          console.log(`✅ ${user.name} associado ao grupo ${user.groupName}`);
        }
      }

      console.log(
        `✅ ${usersToCreate.length} usuários de teste criados e associados aos grupos específicos!`,
      );
    } else {
      console.log("⚠️ Usuários de teste já existem, pulando...");
    }

    // === VERIFICAÇÃO DE ASSOCIAÇÕES USUÁRIO-GRUPO ===
    console.log(
      "✅ Associações usuário-grupo configuradas conforme especificação",
    );

    // === 4. CRIAR PRODUTOS ===
    if (!productsCheck.hasData) {
      console.log("🔵 Criando produtos...");
      const insertedProducts = await db
        .insert(schema.product)
        .values(
          products.map((p) => ({ id: randomUUID(), ...p, available: true })),
        )
        .returning();

      insertedProducts.forEach((p) => productMap.set(p.slug, p.id));
      console.log(`✅ ${insertedProducts.length} produtos criados!`);
    } else {
      console.log("⚠️ Produtos já existem, pulando...");
      // Buscar produtos existentes
      const existingProducts = await db.select().from(schema.product);
      existingProducts.forEach((p) => productMap.set(p.slug, p.id));
    }

    // === 4.1 GARANTIR CATEGORIAS DE PROBLEMA ANTES DE CRIAR product_activity ===
    if (categoryMap.size === 0) {
      const existingCats = await db
        .select()
        .from(schema.productProblemCategory);
      if (existingCats.length === 0) {
        console.log(
          "🔵 Categorias de problema ainda não existem – criando antes do product_activity...",
        );
        const problemCategories = [
          {
            id: NO_INCIDENTS_CATEGORY_ID, // ID fixo para "Não houve incidentes"
            name: NO_INCIDENTS_CATEGORY_NAME,
            color: "#10B981",
            isSystem: true, // Não pode ser excluída
            sortOrder: 0, // Sempre primeiro
          },
          {
            id: randomUUID(),
            name: "Dados indisponíveis",
            color: "#7C3AED", // violeta
            isSystem: false,
            sortOrder: 1,
          },
          {
            id: randomUUID(),
            name: "Rede externa",
            color: "#DC2626", // vermelho
            isSystem: false,
            sortOrder: 2,
          },
          {
            id: randomUUID(),
            name: "Rede interna",
            color: "#EC4899", // rosa
            isSystem: false,
            sortOrder: 3,
          },
          {
            id: randomUUID(),
            name: "Erro no modelo",
            color: "#F59E0B", // laranja
            isSystem: false,
            sortOrder: 4,
          },
          {
            id: randomUUID(),
            name: "Falha humana",
            color: "#92400E", // marrom
            isSystem: false,
            sortOrder: 5,
          },
        ];

        const insertedCats = await db
          .insert(schema.productProblemCategory)
          .values(problemCategories)
          .returning();
        insertedCats.forEach((c) => categoryMap.set(c.name, c.id));
      } else {
        existingCats.forEach((c) => categoryMap.set(c.name, c.id));
      }
    }

    // === 4.2 VERIFICAR SE EXISTEM ATIVIDADES DE PRODUTO ===
    const activityExisting = await db
      .select()
      .from(schema.productActivity)
      .limit(1);
    if (activityExisting.length === 0) {
      console.log(
        "⚠️ Nenhuma atividade de produto encontrada - sistema iniciado sem histórico fake",
      );
    } else {
      console.log(
        "⚠️ Atividades de produto já existem - mantendo dados existentes",
      );
    }

    // === 4.3 CRIAR HISTÓRICO DE ATIVIDADES APENAS PARA BAM (DATA ATUAL) ===
    console.log(
      "🔵 Criando histórico de atividades apenas para BAM (data atual)...",
    );

    // Buscar o produto BAM
    const bamProduct = await db
      .select()
      .from(schema.product)
      .where(eq(schema.product.slug, "bam"))
      .limit(1);
    console.log("🔍 Produto BAM encontrado:", bamProduct.length > 0);
    if (bamProduct.length > 0) {
      console.log("🔍 ID do produto BAM:", bamProduct[0].id);

      // Remover histórico antigo do BAM
      const oldActivities = await db
        .select({ id: schema.productActivity.id })
        .from(schema.productActivity)
        .where(eq(schema.productActivity.productId, bamProduct[0].id));
      if (oldActivities.length > 0) {
        const oldActivityIds = oldActivities.map((a) => a.id);
        await db
          .delete(schema.productActivityHistory)
          .where(
            inArray(
              schema.productActivityHistory.productActivityId,
              oldActivityIds,
            ),
          );
        console.log("✅ Histórico antigo do BAM removido");
      }

      // Buscar atividades do BAM para a data atual
      const today = new Date().toISOString().slice(0, 10);
      const todayActivities = await db
        .select()
        .from(schema.productActivity)
        .where(
          and(
            eq(schema.productActivity.productId, bamProduct[0].id),
            eq(schema.productActivity.date, today as unknown as string),
          ),
        )
        .orderBy(schema.productActivity.turn);

      console.log(
        `🔍 Encontradas ${todayActivities.length} atividades do BAM para hoje (${today})`,
      );

      // 3 descrições longas para demonstração
      const longDescriptions = [
        `**PROBLEMA CRÍTICO DETECTADO - TURNO 0H**

O modelo BAM apresentou falhas durante a execução do turno 0h. Os principais problemas identificados foram:

- **Falha de conexão**: Não foi possível conectar com o servidor de dados meteorológicos
- **Timeout**: Processamento excedeu o tempo limite de 45 minutos
- **Dados corrompidos**: Arquivo de entrada apresentou inconsistências nos dados de temperatura

**AÇÕES TOMADAS:**
1. Reinicialização do serviço de dados meteorológicos
2. Verificação da integridade dos arquivos de entrada
3. Reprocessamento manual agendado para 06:30h

**PRÓXIMOS PASSOS:**
- Monitorar execução do próximo turno
- Investigar causa raiz do problema de conectividade
- Implementar melhorias no sistema de retry automático`,

        `**RELATÓRIO DETALHADO DE EXECUÇÃO - TURNO 12H**

## Status: CONCLUÍDO COM SUCESSO

### Resumo da Execução
O modelo BAM foi executado com sucesso no turno 12h, processando todos os dados meteorológicos sem interrupções.

### Métricas de Performance
- **Tempo de execução**: 22 minutos 15 segundos
- **Dados processados**: 3.2GB de dados meteorológicos
- **Taxa de sucesso**: 100%
- **Recursos utilizados**: CPU 92%, Memória 16GB

### Validações Realizadas
1. ✅ Verificação de integridade dos dados de entrada
2. ✅ Validação dos parâmetros de configuração do modelo
3. ✅ Teste de conectividade com serviços externos
4. ✅ Verificação de permissões de acesso aos dados
5. ✅ Validação dos dados de saída e qualidade

### Observações
- Performance superior à média histórica (15% mais rápido)
- Nenhum warning ou erro detectado nos logs
- Dados de saída validados e aprovados pela equipe técnica
- Modelo executou com parâmetros otimizados

### Recomendações
- Manter configurações atuais do modelo
- Continuar monitoramento regular da performance
- Próxima execução agendada para 18h conforme cronograma`,

        `**INCIDENTE DE INFRAESTRUTURA - TURNO 18H**

## Severidade: ALTA

### Descrição do Problema
Falha crítica no sistema de armazenamento durante a execução do turno 18h do modelo BAM, resultando em perda parcial de dados e interrupção do processamento.

### Impacto Detalhado
- **Produtos afetados**: BAM (100% dos turnos)
- **Dados perdidos**: ~25% do processamento do turno
- **Tempo de inatividade**: 3 horas 45 minutos
- **Usuários impactados**: 8 operadores do centro meteorológico
- **Serviços dependentes**: 3 sistemas downstream afetados

### Causa Raiz
Investigação inicial aponta para falha no sistema RAID do servidor principal de dados. O disco 3 do array apresentou falha física completa, causando degradação crítica do sistema de armazenamento.

### Ações Corretivas Implementadas
1. **Imediatas (0-30 min)**:
   - Ativação automática do servidor de backup
   - Migração dos dados críticos para storage secundário
   - Notificação imediata da equipe de infraestrutura
   - Isolamento do servidor afetado

2. **A curto prazo (30 min - 2h)**:
   - Substituição emergencial do disco falho
   - Início da reconstrução do array RAID
   - Testes de integridade dos dados migrados
   - Validação dos backups automáticos

3. **A médio prazo (2h - 24h)**:
   - Implementação de redundância adicional no storage
   - Revisão completa dos procedimentos de backup
   - Treinamento da equipe em procedimentos de emergência
   - Implementação de monitoramento proativo

### Status Atual
- ✅ Sistema restaurado e operacional
- ✅ Dados recuperados com 98% de integridade
- ✅ Monitoramento intensivo ativo 24/7
- ✅ Próxima verificação completa em 2 horas
- ⚠️ Performance reduzida temporariamente (10-15%)

### Lições Aprendidas
- Necessidade de redundância adicional no storage
- Importância de backups mais frequentes
- Melhoria nos alertas de monitoramento
- Treinamento da equipe em procedimentos de emergência`,
      ];

      // Gerar histórico apenas para as atividades de hoje (máximo 3)
      for (let i = 0; i < Math.min(todayActivities.length, 3); i++) {
        const activity = todayActivities[i];

        // Criar data base para o histórico (mais recente que a atividade)
        const baseHistoryDate = new Date();

        // Criar múltiplas entradas de histórico para simular evolução
        const historyEntries = [
          {
            status: "pending",
            description: "Execução aguardando liberação de recursos",
            createdAt: new Date(baseHistoryDate.getTime() - 3600000), // 1 hora antes
          },
          {
            status: "in_progress",
            description: "Processamento iniciado com sucesso",
            createdAt: new Date(baseHistoryDate.getTime() - 1800000), // 30 min antes
          },
          {
            status: activity.status,
            description: longDescriptions[i] || "Execução finalizada",
            createdAt: baseHistoryDate, // Data mais recente
          },
        ];

        // Inserir histórico
        for (const entry of historyEntries) {
          await db.insert(schema.productActivityHistory).values({
            productActivityId: activity.id,
            userId: activity.userId,
            status: entry.status,
            description: entry.description,
            createdAt: entry.createdAt,
          });
        }

        // Atualizar o updatedAt da atividade para ser mais recente que o histórico
        const finalActivityDate = new Date(baseHistoryDate.getTime() + 1000); // +1 segundo
        await db
          .update(schema.productActivity)
          .set({ updatedAt: finalActivityDate })
          .where(eq(schema.productActivity.id, activity.id));
        console.log(
          `✅ Histórico criado para atividade do turno ${activity.turn}h`,
        );
      }
    }
    console.log(
      "✅ product_activity_history gerado apenas para BAM (data atual)!",
    );

    // === 5. CRIAR CONTATOS ===
    if (!contactsCheck.hasData) {
      console.log("🔵 Criando contatos globais...");
      insertedContacts = await db
        .insert(schema.contact)
        .values(contacts.map((contact) => ({ id: randomUUID(), ...contact })))
        .returning();

      console.log(`✅ ${insertedContacts.length} contatos criados!`);
    } else {
      console.log("⚠️ Contatos já existem, pulando...");
      insertedContacts = await db.select().from(schema.contact);
    }

    // === 6. CRIAR DADOS DOS PRODUTOS (dependências, manuais, problemas) ===
    const existingDependencies = await db
      .select()
      .from(schema.productDependency)
      .limit(1);
    if (existingDependencies.length === 0) {
      console.log("🔵 Criando dados dos produtos...");
      for (const product of products) {
        const productId = productMap.get(product.slug);
        if (!productId) continue;

        console.log(`🔵 Processando produto: ${product.name}`);

        // Dependências
        await insertDependencies(productId, dependencyStructure);

        // Associações contatos
        const activeContacts = insertedContacts
          .filter((c) => c.active)
          .slice(0, 3);
        if (activeContacts.length > 0) {
          await db.insert(schema.productContact).values(
            activeContacts.map((contact) => ({
              id: randomUUID(),
              productId,
              contactId: contact.id,
            })),
          );
        }

        // Manual
        const manual = manualData.find((m) => m.productSlug === product.slug);
        if (manual) {
          await db.insert(schema.productManual).values({
            id: randomUUID(),
            productId,
            description: manual.description,
          });
        }

        // Problemas e soluções
        if (userId) {
          const problems = generateProblems();
          const categoryIds: string[] = Array.from(categoryMap.values());
          const problemRows = problems.map((p) => ({
            id: randomUUID(),
            productId,
            userId: userId,
            problemCategoryId:
              categoryIds[Math.floor(Math.random() * categoryIds.length)],
            title: p.title,
            description: p.description,
          }));

          const insertedProblems = await db
            .insert(schema.productProblem)
            .values(problemRows)
            .returning();

          for (const problem of insertedProblems) {
            const solutions = generateSolutions().slice(
              0,
              Math.floor(Math.random() * 5) + 2,
            );
            const solutionRows = solutions.map((s) => ({
              id: randomUUID(),
              userId: userId,
              productProblemId: problem.id,
              description: s.description,
              replyId: null,
            }));

            const insertedSolutions = await db
              .insert(schema.productSolution)
              .values(solutionRows)
              .returning();

            // Marcar primeira solução como verificada
            if (insertedSolutions.length > 0) {
              await db.insert(schema.productSolutionChecked).values({
                id: randomUUID(),
                userId: userId,
                productSolutionId: insertedSolutions[0].id,
              });
            }

            // Imagens de problemas agora são adicionadas via servidor local na interface
          }
        }
      }
      console.log("✅ Dados dos produtos criados com sucesso!");
    } else {
      console.log("⚠️ Dados dos produtos já existem, pulando...");
    }

    // === 7. CRIAR PROJETOS ===
    let insertedProjects: (typeof schema.project.$inferSelect)[] = [];
    if (!projectsCheck.hasData) {
      console.log("🔵 Criando projetos...");
      insertedProjects = await db
        .insert(schema.project)
        .values(
          projectsData.map((project) => ({
            id: randomUUID(),
            name: project.name,
            shortDescription: project.shortDescription,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            priority: project.priority,
            status: project.status,
          })),
        )
        .returning();
      console.log(`✅ ${projectsData.length} projetos criados!`);
    } else {
      console.log("⚠️ Projetos já existem, pulando...");
      insertedProjects = await db.select().from(schema.project);
    }

    // === 8. CRIAR ATIVIDADES DOS PROJETOS ===
    if (!activitiesCheck.hasData && insertedProjects.length > 0) {
      console.log("🔵 Criando atividades dos projetos...");

      // Mapeamento de projetos para seus respectivos grupos de atividades
      const projectActivityMapping = [
        { projectIndex: 0, activities: projectActivitiesData.meteorologia }, // Sistema de Monitoramento Meteorológico
      ];

      let totalActivitiesCreated = 0;

      for (const mapping of projectActivityMapping) {
        if (
          mapping.projectIndex < insertedProjects.length &&
          mapping.activities.length > 0
        ) {
          const project = insertedProjects[mapping.projectIndex];

          const activitiesToCreate = mapping.activities.map((activity) => ({
            id: randomUUID(),
            projectId: project.id,
            name: activity.name,
            description: activity.description,
            category: activity.category,
            estimatedDays: activity.estimatedDays,
            startDate: activity.startDate,
            endDate: activity.endDate,
            priority: activity.priority,
            status: activity.status,
          }));

          await db.insert(schema.projectActivity).values(activitiesToCreate);
          totalActivitiesCreated += activitiesToCreate.length;

          console.log(
            `   ✅ ${activitiesToCreate.length} atividades criadas para "${project.name}"`,
          );
        } else if (
          mapping.projectIndex < insertedProjects.length &&
          mapping.activities.length === 0
        ) {
          const project = insertedProjects[mapping.projectIndex];
          console.log(
            `   ⚪ Projeto "${project.name}" sem atividades (conforme solicitado)`,
          );
        }
      }

      console.log(
        `✅ Total de ${totalActivitiesCreated} atividades criadas em ${insertedProjects.length} projetos!`,
      );
    } else {
      console.log(
        "⚠️ Atividades dos projetos já existem ou projetos não foram criados, pulando...",
      );
    }

    // === 9. CRIAR DOCUMENTAÇÃO DE AJUDA ===
    if (!helpCheck.hasData) {
      console.log("🔵 Criando documentação de ajuda...");
      await db.insert(schema.help).values({
        id: "system-help",
        description: helpDocumentation,
      });
      console.log("✅ Documentação de ajuda criada!");
    } else {
      console.log("⚠️ Documentação de ajuda já existe, pulando...");
    }

    // === 10. CRIAR SISTEMA DE CHAT ULTRA SIMPLIFICADO ===
    // Verificar se já existem dados de chat
    const presenceCheck = await checkTableData("chat_user_presence", () =>
      db.select().from(schema.chatUserPresence).limit(1),
    );

    if (!presenceCheck.hasData && insertedGroups.length > 0) {
      console.log("🔵 Criando sistema de chat ultra simplificado...");

      // Buscar todos usuários ativos
      const allUsers = await db
        .select()
        .from(schema.authUser)
        .where(eq(schema.authUser.isActive, true));

      // Criar status de presença para todos usuários
      const userPresenceData = allUsers.map((user) => ({
        userId: user.id,
        status: "invisible" as const,
        lastActivity: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
        ),
      }));

      await db.insert(schema.chatUserPresence).values(userPresenceData);
      console.log(
        `✅ Status de presença criado para ${allUsers.length} usuários!`,
      );
      console.log(
        "⚠️ Sistema iniciado sem mensagens fake - chat será usado conforme necessidade real",
      );
    } else {
      console.log("⚠️ Sistema de chat já existe, pulando...");
    }

    // === 12. CRIAR DADOS DAS TAREFAS DOS PROJETOS (ARQUITETURA SIMPLIFICADA) ===
    // FORÇAR RECRIAÇÃO para corrigir as datas das tarefas
    console.log("🔵 Recriando dados das tarefas com datas corretas...");

    // Remover tarefas existentes para recriar com datas corretas
    await db.delete(schema.projectTask);
    console.log("✅ Tarefas antigas removidas para recriação");

    // Buscar atividades existentes
    const allActivities = await db.select().from(schema.projectActivity);

    if (allActivities.length > 0) {
      let totalTasksCreated = 0;

      for (const project of insertedProjects.slice(0, 1)) {
        // Apenas o primeiro projeto (único projeto)
        const projectActivities = allActivities.filter(
          (a) => a.projectId === project.id,
        );

        if (projectActivities.length > 0) {
          console.log(
            `   🔵 Criando tarefas para projeto "${project.name}" (${projectActivities.length} atividades)...`,
          );

          // Para cada atividade, criar exatamente 8 tarefas
          for (const activity of projectActivities) {
            console.log(
              `     🔵 Criando tarefas para atividade "${activity.name}"...`,
            );

            // Criar exatamente 8 tarefas para esta atividade
            const tasksToCreate = [];

            // Templates de tarefas com distribuição por status (8 tarefas)
            const taskTemplates = [
              {
                name: "Configurar ambiente de desenvolvimento",
                status: "todo",
                category: "Infraestrutura",
                priority: "high",
              },
              {
                name: "Implementar funcionalidade principal",
                status: "todo",
                category: "Desenvolvimento",
                priority: "urgent",
              },
              {
                name: "Configurar rede interna e externa",
                status: "in_progress",
                category: "Infraestrutura",
                priority: "medium",
              },
              {
                name: "Desenvolver interface do usuário",
                status: "in_progress",
                category: "Desenvolvimento",
                priority: "high",
              },
              {
                name: "Testes de integração",
                status: "review",
                category: "Testes",
                priority: "medium",
              },
              {
                name: "Documentação técnica",
                status: "blocked",
                category: "Documentação",
                priority: "low",
              },
              {
                name: "Deploy em ambiente de produção",
                status: "done",
                category: "Deploy",
                priority: "high",
              },
              {
                name: "Configuração de monitoramento",
                status: "done",
                category: "DevOps",
                priority: "medium",
              },
            ];

            // Distribuir tarefas por status com sort sequencial
            const tasksByStatus: Record<string, number> = {
              todo: 0,
              in_progress: 0,
              blocked: 0,
              review: 0,
              done: 0,
            };

            // Calcular datas específicas para cada tarefa baseadas na atividade
            const activityStartDate = new Date(
              activity.startDate || new Date(),
            );
            const currentTaskDate = new Date(activityStartDate);

            for (let i = 0; i < taskTemplates.length; i++) {
              const template = taskTemplates[i];
              const taskId = randomUUID();

              // Incrementar contador para este status
              tasksByStatus[template.status]++;

              // Calcular datas específicas da tarefa
              const taskEstimatedDays = Math.floor(Math.random() * 15) + 1; // 1-15 dias
              const taskStartDate = new Date(currentTaskDate);
              const taskEndDate = new Date(currentTaskDate);
              taskEndDate.setDate(
                taskEndDate.getDate() + taskEstimatedDays - 1,
              ); // -1 porque o dia inicial conta

              // Avançar para a próxima tarefa (com pequeno gap)
              currentTaskDate.setDate(
                currentTaskDate.getDate() +
                  taskEstimatedDays +
                  Math.floor(Math.random() * 3) +
                  1,
              );

              // CORREÇÃO: Usar fuso horário local de São Paulo (UTC-3)
              // Criar datas no fuso horário local para evitar problemas de UTC
              const localStartDate = createLocalDate(
                taskStartDate.getFullYear(),
                taskStartDate.getMonth(),
                taskStartDate.getDate(),
              );
              const localEndDate = createLocalDate(
                taskEndDate.getFullYear(),
                taskEndDate.getMonth(),
                taskEndDate.getDate(),
              );

              tasksToCreate.push({
                id: taskId,
                projectId: project.id,
                projectActivityId: activity.id,
                name: `${template.name} - ${activity.name}`,
                description: `Tarefa de ${template.category.toLowerCase()} para atividade: ${activity.description}`,
                category: template.category,
                estimatedDays: taskEstimatedDays,
                status: template.status,
                sort: tasksByStatus[template.status] - 1, // Sort sequencial por status (0, 1, 2...)
                startDate: localStartDate.toISOString().split("T")[0], // Data no fuso local como string
                endDate: localEndDate.toISOString().split("T")[0], // Data no fuso local como string
                priority: template.priority,
              });
            }

            // Inserir tarefas desta atividade
            if (tasksToCreate.length > 0) {
              await db.insert(schema.projectTask).values(tasksToCreate);
              totalTasksCreated += tasksToCreate.length;
              console.log(
                `     ✅ ${tasksToCreate.length} tarefas criadas para "${activity.name}"`,
              );
            }
          }

          console.log(
            `   ✅ Projeto "${project.name}" finalizado com ${projectActivities.length} atividades`,
          );
        }
      }

      console.log(
        `✅ Sistema de tarefas criado: ${totalTasksCreated} tarefas distribuídas!`,
      );
    } else {
      console.log("⚠️ Nenhuma atividade encontrada para criar tarefas");
    }

    // === 13. CRIAR ASSOCIAÇÕES TAREFA-USUÁRIO ===
    // REQUISITO: TODA tarefa deve estar associada a pelo menos um usuário
    console.log(
      "🔵 Criando associações tarefa-usuário (REQUISITO: toda tarefa deve ter pelo menos um usuário)...",
    );

    // Remover associações existentes
    await db.delete(schema.projectTaskUser);
    console.log("✅ Associações antigas removidas");

    // Buscar tarefas e usuários existentes
    const allTasks = await db.select().from(schema.projectTask);
    const allUsers = await db
      .select()
      .from(schema.authUser)
      .where(eq(schema.authUser.isActive, true));

    if (allTasks.length > 0 && allUsers.length > 0) {
      const taskUsersToCreate = [];

      // REQUISITO: Para CADA tarefa, associar pelo menos 1 usuário
      for (const task of allTasks) {
        // Garantir que cada tarefa tenha pelo menos 1 usuário
        const numUsers = Math.floor(Math.random() * 3) + 1; // 1-3 usuários por tarefa
        const selectedUsers = allUsers
          .sort(() => 0.5 - Math.random())
          .slice(0, numUsers);

        for (const user of selectedUsers) {
          const role = Math.random() > 0.7 ? "reviewer" : "assignee"; // 70% assignee, 30% reviewer

          taskUsersToCreate.push({
            id: randomUUID(),
            taskId: task.id,
            userId: user.id,
            role,
            assignedAt: new Date(),
          });
        }
      }

      if (taskUsersToCreate.length > 0) {
        await db.insert(schema.projectTaskUser).values(taskUsersToCreate);
        console.log(
          `✅ ${taskUsersToCreate.length} associações tarefa-usuário criadas!`,
        );
        console.log(
          `✅ Todas as ${allTasks.length} tarefas têm pelo menos um usuário associado`,
        );
      }
    } else {
      console.log(
        "⚠️ Nenhuma tarefa ou usuário encontrado para criar associações",
      );
    }

    // 🆕 HISTÓRICO DE TAREFAS (project_task_history)
    console.log("🔄 Criando histórico simulado para tarefas existentes...");

    // Remover histórico existente
    await db.delete(schema.projectTaskHistory);
    console.log("✅ Histórico antigo removido");

    // Buscar todas as tarefas existentes
    const existingTasks = await db.select().from(schema.projectTask);
    const activeUsers = await db
      .select()
      .from(schema.authUser)
      .where(eq(schema.authUser.isActive, true));

    if (existingTasks.length > 0 && activeUsers.length > 0) {
      const historyEntries = [];

      // Para cada tarefa, criar histórico simulado
      for (const task of existingTasks) {
        const randomUser =
          activeUsers[Math.floor(Math.random() * activeUsers.length)];

        // Entrada de criação (sempre existe)
        const createdAt = new Date(task.createdAt);
        historyEntries.push({
          taskId: task.id,
          userId: randomUser.id,
          action: "created",
          fromStatus: null,
          toStatus: "todo",
          fromSort: null,
          toSort: 0,
          details: { initialStatus: "todo", initialSort: 0 },
          createdAt: createdAt,
        });

        // Simular algumas movimentações baseadas no status atual
        if (task.status !== "todo") {
          // Movimentação de 'todo' para 'in_progress'
          const progressDate = new Date(
            createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000,
          ); // +0-24h
          historyEntries.push({
            taskId: task.id,
            userId:
              activeUsers[Math.floor(Math.random() * activeUsers.length)].id,
            action: "status_change",
            fromStatus: "todo",
            toStatus: "in_progress",
            fromSort: 0,
            toSort: 0,
            details: { reason: "Drag and drop", column: "Em progresso" },
            createdAt: progressDate,
          });

          if (task.status === "done" || task.status === "review") {
            // Movimentação para status final
            const finalDate = new Date(
              progressDate.getTime() + Math.random() * 48 * 60 * 60 * 1000,
            ); // +0-48h
            historyEntries.push({
              taskId: task.id,
              userId:
                activeUsers[Math.floor(Math.random() * activeUsers.length)].id,
              action: "status_change",
              fromStatus: "in_progress",
              toStatus: task.status,
              fromSort: 0,
              toSort: task.sort,
              details: {
                reason: "Drag and drop",
                column: task.status === "done" ? "Concluído" : "Em revisão",
              },
              createdAt: finalDate,
            });
          }

          if (task.status === "blocked") {
            // Simular bloqueio
            const blockedDate = new Date(
              progressDate.getTime() + Math.random() * 12 * 60 * 60 * 1000,
            ); // +0-12h
            historyEntries.push({
              taskId: task.id,
              userId:
                activeUsers[Math.floor(Math.random() * activeUsers.length)].id,
              action: "status_change",
              fromStatus: "in_progress",
              toStatus: "blocked",
              fromSort: 0,
              toSort: task.sort,
              details: {
                reason: "Drag and drop",
                column: "Bloqueado",
                note: "Aguardando dependência externa",
              },
              createdAt: blockedDate,
            });
          }
        }
      }

      // Inserir histórico no banco
      if (historyEntries.length > 0) {
        await db.insert(schema.projectTaskHistory).values(historyEntries);
        console.log(
          `✅ ${historyEntries.length} entradas de histórico criadas!`,
        );
        console.log(
          `✅ Todas as ${existingTasks.length} tarefas têm histórico de movimentação`,
        );
      }
    } else {
      console.log("⚠️ Nenhuma tarefa encontrada para criar histórico");
    }

    console.log("✅ Seed finalizado com sucesso!");
    console.log("📊 Resumo do seed:");
    console.log(`   - Sistema completamente configurado`);
    console.log(`   - Dados de teste inseridos onde necessário`);
    console.log(
      `   - Sistema de tarefas com arquitetura simplificada implementado`,
    );
    console.log(`   - Nenhuma duplicação de dados`);
  } catch (error) {
    console.error("❌ Erro durante o seed:", error);
    throw error;
  }
}

// Executar seed
seed().catch((err) => {
  console.error("❌ Erro fatal no seed:", err);
  process.exit(1);
});
