import { db } from "@/lib/db";
import { group, userGroup, authUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Adiciona automaticamente um usuário ao grupo padrão do sistema
 * @param userId ID do usuário a ser adicionado ao grupo padrão
 * @returns Promise<boolean> - true se adicionado com sucesso, false caso contrário
 */
export async function addUserToDefaultGroup(userId: string): Promise<boolean> {
  try {
    // Busca o grupo padrão (isDefault: true)
    const defaultGroup = await db.query.group.findFirst({
      where: eq(group.isDefault, true),
    });

    if (!defaultGroup) {
      console.error(
        "❌ [LIB_AUTH_USER_GROUPS] Grupo padrão não encontrado no sistema",
      );
      return false;
    }

    // Verifica se o usuário já está no grupo padrão
    const existingUserGroup = await db.query.userGroup.findFirst({
      where: eq(userGroup.userId, userId),
    });

    if (existingUserGroup) {
      console.log(
        "ℹ️ [LIB_AUTH_USER_GROUPS] Usuário já está associado a um grupo",
      );
      return true;
    }

    // Adiciona o usuário ao grupo padrão
    await db.insert(userGroup).values({
      id: randomUUID(),
      userId,
      groupId: defaultGroup.id,
      joinedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error(
      "❌ [LIB_AUTH_USER_GROUPS] Erro ao adicionar usuário ao grupo padrão:",
      { error },
    );
    return false;
  }
}

/**
 * Atualiza o último acesso do usuário no sistema
 * @param userId ID do usuário
 * @returns Promise<boolean> - true se atualizado com sucesso, false caso contrário
 */
export async function updateUserLastLogin(userId: string): Promise<boolean> {
  try {
    await db
      .update(authUser)
      .set({ lastLogin: new Date() })
      .where(eq(authUser.id, userId));

    return true;
  } catch (error) {
    console.error(
      "❌ [LIB_AUTH_USER_GROUPS] Erro ao atualizar último acesso:",
      { error },
    );
    return false;
  }
}
