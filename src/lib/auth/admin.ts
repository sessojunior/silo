import { db } from "@/lib/db";
import { userGroup, group } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Verifica se um usuário é administrador do sistema
 * Um usuário é admin se estiver em pelo menos um grupo com role='admin'
 * @param userId - ID do usuário a ser verificado
 * @returns Promise<boolean> - true se o usuário for administrador
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // Buscar grupos do usuário onde o grupo tem role='admin'
    const adminGroups = await db
      .select({
        groupId: userGroup.groupId,
        groupRole: group.role,
        groupName: group.name,
      })
      .from(userGroup)
      .innerJoin(group, eq(userGroup.groupId, group.id))
      .where(eq(userGroup.userId, userId));

    // Verificar se o usuário está em algum grupo com role='admin'
    const isAdmin = adminGroups.some((ug) => ug.groupRole === "admin");

    return isAdmin;
  } catch (error) {
    console.error(
      "❌ [LIB_AUTH_ADMIN] Erro ao verificar se usuário é administrador:",
      { error },
    );
    return false;
  }
}

/**
 * Middleware para verificar permissões de administrador
 * @param userId - ID do usuário a ser verificado
 * @returns Promise<{ success: boolean, error?: string }>
 */
export async function requireAdmin(
  userId: string,
): Promise<
  { success: true; error?: never } | { success: false; error: string }
> {
  try {
    const isAdmin = await isUserAdmin(userId);

    if (!isAdmin) {
      return {
        success: false,
        error: "Apenas administradores podem realizar esta ação",
      };
    }

    return { success: true };
  } catch (error) {
    console.error(
      "❌ [LIB_AUTH_ADMIN] Erro ao verificar permissões de administrador:",
      { error },
    );
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}
