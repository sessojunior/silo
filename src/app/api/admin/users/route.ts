import { NextRequest } from "next/server";
import {
  parseRequestJson,
  parseRequestQuery,
  successResponse,
  errorResponse,
} from "@/lib/api-response";
import { db } from "@/lib/db";
import { authUser, group, userGroup, authAccount } from "@/lib/db/schema";
import { eq, desc, ilike, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { isValidEmail, isValidDomain } from "@/lib/auth/validate";
import { auth } from "@/lib/auth/server";
import { z } from "zod";

const ListUsersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "active", "inactive"]).optional(),
  groupId: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().uuid().optional()),
});

const UserGroupInputSchema = z.object({
  groupId: z.string().uuid(),
});

const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório e deve ter pelo menos 2 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine(isValidEmail, "Email inválido.")
    .refine(isValidDomain, "Apenas e-mails do domínio @inpe.br são permitidos."),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres.").max(120).optional(),
  groups: z.array(UserGroupInputSchema).optional(),
  groupId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// Interface para grupos de usuário
interface UserGroupInput {
  groupId: string;
}

// GET - Listar usuários com busca e filtros
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const parsedQuery = parseRequestQuery(request, ListUsersQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;

    const search = parsedQuery.data.search ?? "";
    const status = parsedQuery.data.status ?? "all";
    const groupId = parsedQuery.data.groupId ?? "";

    // Construir condições de filtro
    const conditions = [];

    if (search) {
      conditions.push(ilike(authUser.name, `%${search}%`));
    }

    if (status === "active") {
      conditions.push(eq(authUser.isActive, true));
    } else if (status === "inactive") {
      conditions.push(eq(authUser.isActive, false));
    }

    // Se filtro por grupo específico, buscar apenas usuários desse grupo
    let userIdsInGroup: string[] = [];
    if (groupId) {
      const usersInGroup = await db
        .select({ userId: userGroup.userId })
        .from(userGroup)
        .where(eq(userGroup.groupId, groupId));

      userIdsInGroup = usersInGroup.map((u) => u.userId);

      if (userIdsInGroup.length > 0) {
        conditions.push(inArray(authUser.id, userIdsInGroup));
      } else {
        // Se grupo não tem usuários, retornar array vazio
        return successResponse({
          items: [],
          total: 0,
        });
      }
    }

    // Buscar usuários
    const users = await db
      .select({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        image: authUser.image,
        emailVerified: authUser.emailVerified,
        isActive: authUser.isActive,
        lastLogin: authUser.lastLogin,
        createdAt: authUser.createdAt,
      })
      .from(authUser)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(authUser.createdAt));

    // Buscar grupos para cada usuário
    const usersWithGroups = [];
    for (const user of users) {
      const userGroups = await db
        .select({
          groupId: group.id,
          groupName: group.name,
          groupIcon: group.icon,
          groupColor: group.color,
        })
        .from(userGroup)
        .innerJoin(group, eq(group.id, userGroup.groupId))
        .where(eq(userGroup.userId, user.id));

      // Para compatibilidade com a interface existente, vamos usar o primeiro grupo como groupId
      const primaryGroup = userGroups[0];

      // Verificar se tem senha (account credentials)
      const account = await db
        .select()
        .from(authAccount)
        .where(
          and(
            eq(authAccount.userId, user.id),
            eq(authAccount.providerId, "credential"),
          ),
        )
        .limit(1);
      const hasPassword = account.length > 0 && !!account[0].password;

      usersWithGroups.push({
        ...user,
        groupId: primaryGroup?.groupId || null,
        groupName: primaryGroup?.groupName || null,
        groupIcon: primaryGroup?.groupIcon || null,
        groupColor: primaryGroup?.groupColor || null,
        groups: userGroups, // Lista completa de grupos
        needsPasswordSetup: !hasPassword, // Flag para indicar se precisa definir senha
      });
    }

    return successResponse({
      items: usersWithGroups,
      total: usersWithGroups.length,
    });
  } catch (error) {
    console.error("❌ [API_USERS] Erro ao buscar usuários:", { error });
    return errorResponse("Erro ao carregar usuários", 500);
  }
}

// POST - Criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const parsedBody = await parseRequestJson(request, CreateUserSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { name, email, password, groups, groupId, isActive } = parsedBody.data;

    // Determinar grupos usando novo formato ou legado
    const userGroups: UserGroupInput[] =
      groups || (groupId ? [{ groupId }] : []);

    // 🆕 Senha é OPCIONAL na criação - se não fornecida, usuário precisa definir via OTP (Link)
    let hashedPassword: string | null = null;
    let needsPasswordSetup = false;

    if (password) {
      // Se senha foi fornecida e é válida, usar ela
      hashedPassword = await bcrypt.hash(password, 10);
    } else if (!password) {
      // Se senha não foi fornecida, marcar para setup via Link
      needsPasswordSetup = true;
    }

    if (!userGroups || userGroups.length === 0) {
      return errorResponse("Pelo menos um grupo é obrigatório.", 400, {
        field: "groups",
      });
    }

    // Verificar se email já existe
    const existingUser = await db
      .select()
      .from(authUser)
      .where(eq(authUser.email, email.trim().toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return errorResponse("Já existe um usuário com este email.", 400, {
        field: "email",
      });
    }

    // Verificar se todos os grupos existem
    const groupIds = userGroups.map((ug: UserGroupInput) => ug.groupId);
    const existingGroups = await db
      .select()
      .from(group)
      .where(inArray(group.id, groupIds));

    if (existingGroups.length !== groupIds.length) {
      const foundGroupIds = existingGroups.map((g) => g.id);
      const missingGroups = groupIds.filter(
        (id: string) => !foundGroupIds.includes(id),
      );

      return errorResponse(
        `Grupos não encontrados: ${missingGroups.join(", ")}`,
        400,
        { field: "groups" },
      );
    }

    // Criar usuário (sem senha no objeto user)
    const userId = randomUUID();
    const newUser = {
      id: userId,
      name: name.trim(),
      email,
      // 🆕 Sempre false para novos usuários - será verificado quando definir senha
      emailVerified: false,
      image: null,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(authUser).values(newUser);

    // Criar conta com senha se fornecida
    if (hashedPassword) {
      await db.insert(authAccount).values({
        id: randomUUID(),
        userId: userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Adicionar usuário aos grupos via tabela user_group
    const newUserGroupEntries = userGroups.map((ug: UserGroupInput) => ({
      userId: userId,
      groupId: ug.groupId,
    }));

    await db.insert(userGroup).values(newUserGroupEntries);

    // 🆕 Se precisa definir senha, enviar email de recuperação
    if (needsPasswordSetup) {
      // Usar Better Auth para enviar email de recuperação/definição de senha
      try {
        // @ts-expect-error - better-auth types are tricky with plugins
        await auth.api.forgetPassword({
          body: { email: newUser.email },
          headers: request.headers,
        });
      } catch (error) {
        console.error(
          "❌ [API_USERS] Erro ao enviar email de setup de senha:",
          error,
        );
        // Não falha a criação
      }
    }

    return successResponse(
      { user: newUser },
      "Usuário criado com sucesso.",
      201,
    );
  } catch (error) {
    console.error("❌ [API_USERS] Erro ao criar usuário:", { error });
    return errorResponse("Erro ao criar usuário", 500);
  }
}
