import { db } from "@silo/database";
import { group, userGroup, chatMessage, groupPermission } from "@silo/database/schema";
import { eq, desc, ilike, and, sql, not, inArray, count } from "drizzle-orm";
import { randomUUID } from "crypto";

// Default permissions for new groups (read-only)
export const DEFAULT_GROUP_PERMISSIONS: Array<{ resource: string; action: string }> = [
  { resource: "products", action: "list" },
  { resource: "projects", action: "list" },
  { resource: "projectActivities", action: "list" },
  { resource: "projectTasks", action: "list" },
  { resource: "productActivities", action: "list" },
];

export async function listGroups(opts: { search?: string; status?: string }) {
  const { search, status } = opts;
  const conditions = [];
  if (search) conditions.push(ilike(group.name, `%${search}%`));
  if (status === "active") conditions.push(eq(group.active, true));
  else if (status === "inactive") conditions.push(eq(group.active, false));

  const groups = await db
    .select()
    .from(group)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(group.isDefault), desc(group.createdAt));

  const userCounts = await db.select({ groupId: userGroup.groupId, count: count(userGroup.userId) }).from(userGroup).groupBy(userGroup.groupId);
  const countMap = new Map(userCounts.map((uc) => [uc.groupId, Number(uc.count)]));

  return { items: groups.map((g) => ({ ...g, userCount: countMap.get(g.id) || 0 })), total: groups.length };
}

export async function createGroup(data: {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  role?: string | null;
  active?: boolean;
  isDefault?: boolean;
}) {
  if (data.role === "admin") {
    return { error: 'Não é possível criar grupos com permissões de administrador.', field: "role" };
  }

  const existing = await db.select().from(group).where(eq(group.name, data.name.trim())).limit(1);
  if (existing.length > 0) return { error: "Já existe um grupo com este nome.", field: "name" };

  if (data.isDefault) {
    await db.update(group).set({ isDefault: false, updatedAt: sql`NOW()` }).where(eq(group.isDefault, true));
  }

  const newGroup = {
    id: randomUUID(),
    name: data.name.trim(),
    description: data.description?.trim() || null,
    icon: data.icon || "icon-[lucide--users]",
    color: data.color || "#3B82F6",
    role: "user",
    active: data.active !== undefined ? data.active : true,
    isDefault: data.isDefault || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    await tx.insert(group).values(newGroup);
    if (DEFAULT_GROUP_PERMISSIONS.length > 0) {
      await tx.insert(groupPermission).values(
        DEFAULT_GROUP_PERMISSIONS.map((p) => ({ groupId: newGroup.id, resource: p.resource, action: p.action, createdAt: new Date(), updatedAt: new Date() })),
      );
    }
  });

  return newGroup;
}

export async function updateGroup(data: {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  role?: string | null;
  active?: boolean;
  isDefault?: boolean;
}) {
  const existing = await db.select().from(group).where(eq(group.id, data.id)).limit(1);
  if (existing.length === 0) return { error: "Grupo não encontrado.", status: 404 };

  const g = existing[0];

  if (g.role === "admin") {
    if (data.active === false) return { error: "Não é possível desativar o grupo de administradores.", field: "active" };
    if (data.isDefault === true) return { error: "Não é possível tornar grupos administrativos como padrão.", field: "isDefault" };
  }

  if (g.name === "Administradores" && data.name.trim() !== "Administradores") {
    return { error: "Não é possível alterar o nome do grupo Administradores.", field: "name" };
  }

  const duplicate = await db.select().from(group).where(and(eq(group.name, data.name.trim()), not(eq(group.id, data.id)))).limit(1);
  if (duplicate.length > 0) return { error: "Já existe outro grupo com este nome.", field: "name" };

  if (data.isDefault === false) {
    const currentDefaults = await db.select().from(group).where(eq(group.isDefault, true));
    if (currentDefaults.length === 1 && currentDefaults[0].id === data.id) {
      return { error: "Não é possível desmarcar o último grupo padrão.", field: "isDefault" };
    }
  }

  if (data.role === "admin") return { error: 'Não é possível alterar um grupo para ter permissões de administrador.', field: "role" };

  if (data.isDefault) {
    await db.update(group).set({ isDefault: false, updatedAt: sql`NOW()` }).where(eq(group.isDefault, true));
  }

  const updatedData = {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    icon: data.icon || g.icon,
    color: data.color || g.color,
    role: typeof data.role === "string" && data.role !== "admin" ? data.role : g.role,
    active: data.active !== undefined ? data.active : g.active,
    isDefault: data.isDefault !== undefined ? data.isDefault : g.isDefault,
    updatedAt: new Date(),
  };

  await db.update(group).set(updatedData).where(eq(group.id, data.id));
  return { id: data.id, ...updatedData };
}

export async function getGroupPermissions(groupId: string) {
  const existingGroup = await db.select({ id: group.id, role: group.role }).from(group).where(eq(group.id, groupId)).limit(1);
  if (!existingGroup.length) return { error: "Grupo não encontrado.", status: 404 };

  const rows = await db.select({ resource: groupPermission.resource, action: groupPermission.action }).from(groupPermission).where(eq(groupPermission.groupId, groupId));
  const existingSet = new Set(rows.map((r) => `${r.resource}:${r.action}`));
  const missingDefaults = DEFAULT_GROUP_PERMISSIONS.filter((p) => !existingSet.has(`${p.resource}:${p.action}`));

  if (missingDefaults.length > 0) {
    await db.insert(groupPermission).values(
      missingDefaults.map((p) => ({
        groupId,
        resource: p.resource,
        action: p.action,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  const combined = missingDefaults.length > 0 ? [...rows, ...missingDefaults] : rows;
  const permissions = combined.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.resource]) acc[row.resource] = [];
    acc[row.resource].push(row.action);
    return acc;
  }, {});

  return { permissions };
}

export async function updateGroupPermission(params: {
  groupId: string;
  resource: string;
  action: string;
  enabled: boolean;
}) {
  const { groupId, resource, action, enabled } = params;
  const existingGroup = await db.select({ id: group.id, role: group.role }).from(group).where(eq(group.id, groupId)).limit(1);
  if (!existingGroup.length) return { error: "Grupo não encontrado.", status: 404 };
  if (existingGroup[0].role === "admin") {
    return { error: "Não é possível alterar permissões do grupo administrador.", status: 400 };
  }

  const isImmutable = DEFAULT_GROUP_PERMISSIONS.some((p) => p.resource === resource && p.action === action);
  if (!enabled && isImmutable) {
    return { error: "Esta permissão é obrigatória e não pode ser desativada.", status: 400 };
  }

  if (enabled) {
    const existing = await db.select({ id: groupPermission.id }).from(groupPermission)
      .where(and(eq(groupPermission.groupId, groupId), eq(groupPermission.resource, resource), eq(groupPermission.action, action)))
      .limit(1);
    if (!existing.length) {
      await db.insert(groupPermission).values({ groupId, resource, action, createdAt: new Date(), updatedAt: new Date() });
    }
  } else {
    await db.delete(groupPermission).where(and(eq(groupPermission.groupId, groupId), eq(groupPermission.resource, resource), eq(groupPermission.action, action)));
  }

  return { ok: true, data: { groupId, resource, action, enabled }, message: "Permissão atualizada com sucesso." };
}

export async function removeUserFromGroup(userId: string, groupId: string) {
  await db.delete(userGroup).where(and(eq(userGroup.userId, userId), eq(userGroup.groupId, groupId)));
  return { ok: true };
}

export async function deleteGroup(id: string) {
  const existing = await db.select().from(group).where(eq(group.id, id)).limit(1);
  if (existing.length === 0) return { error: "Grupo não encontrado.", status: 404 };
  if (existing[0].isDefault) return { error: "Não é possível excluir o grupo padrão.", status: 400 };
  if (existing[0].role === "admin") return { error: "Não é possível excluir o grupo de administradores.", status: 400 };

  await db.transaction(async (tx) => {
    const defaultGroup = await tx.select().from(group).where(eq(group.isDefault, true)).orderBy(desc(group.updatedAt)).limit(1);
    if (defaultGroup.length === 0) throw new Error("Grupo padrão não encontrado.");

    const defaultGroupId = defaultGroup[0].id;
    const usersInGroup = await tx.select().from(userGroup).where(eq(userGroup.groupId, id));

    if (usersInGroup.length > 0) {
      const userIds = usersInGroup.map((ug) => ug.userId);
      const usersInOther = await tx.select({ userId: userGroup.userId }).from(userGroup).where(and(not(eq(userGroup.groupId, id)), inArray(userGroup.userId, userIds)));
      const inOtherSet = new Set(usersInOther.map((u) => u.userId));
      const toMove = usersInGroup.filter((ug) => !inOtherSet.has(ug.userId));
      if (toMove.length > 0) {
        await tx.insert(userGroup).values(toMove.map((ug) => ({ userId: ug.userId, groupId: defaultGroupId })));
      }
    }

    await tx.delete(userGroup).where(eq(userGroup.groupId, id));
    await tx.delete(chatMessage).where(eq(chatMessage.receiverGroupId, id));
    await tx.delete(group).where(eq(group.id, id));
  });

  return { ok: true };
}
