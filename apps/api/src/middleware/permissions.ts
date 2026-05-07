import { db } from "@silo/database";
import { group, groupPermission, userGroup, userPreferences } from "@silo/database/schema";
import { eq, inArray } from "drizzle-orm";
import type { AuthUser } from "../auth/setup";
import type { Request, Response, NextFunction } from "express";

export type PermissionAction = string;
export type PermissionResource = string;

export type UserGroupInfo = {
  id: string;
  name: string;
  role: string;
};

export type PermissionsMap = Record<PermissionResource, Set<PermissionAction>>;

export type ChatAccessState = {
  groups: UserGroupInfo[];
  chatEnabled: boolean;
  canViewChat: boolean;
};

const CHAT_RESOURCE = "chat";
const CHAT_ACCESS_ACTIONS: PermissionAction[] = ["view_private", "view_group"];

export const getUserGroups = async (userId: string): Promise<UserGroupInfo[]> => {
  return db
    .select({ id: group.id, name: group.name, role: group.role })
    .from(userGroup)
    .innerJoin(group, eq(group.id, userGroup.groupId))
    .where(eq(userGroup.userId, userId));
};

type PermissionRow = { resource: PermissionResource; action: PermissionAction };

const buildPermissionsMap = (rows: PermissionRow[]): PermissionsMap => {
  const permissions: PermissionsMap = {};
  rows.forEach((row) => {
    if (!permissions[row.resource]) permissions[row.resource] = new Set();
    permissions[row.resource].add(row.action);
  });
  return permissions;
};

export const getPermissions = async (
  userId: string,
  groups: UserGroupInfo[],
): Promise<PermissionsMap> => {
  if (groups.length === 0) return {};
  const groupIds = groups.map((g) => g.id);
  const rows = await db
    .select({ resource: groupPermission.resource, action: groupPermission.action })
    .from(groupPermission)
    .where(inArray(groupPermission.groupId, groupIds));
  return buildPermissionsMap(rows);
};

export const isAdmin = (groups: UserGroupInfo[]): boolean =>
  groups.some((g) => g.role === "admin");

const hasChatPermission = (permissions: PermissionsMap): boolean => {
  const chatPermissions = permissions[CHAT_RESOURCE];
  if (!chatPermissions) return false;

  return CHAT_ACCESS_ACTIONS.some((action) => chatPermissions.has(action));
};

export async function getChatAccessState(userId: string): Promise<ChatAccessState> {
  const [groups, preferences] = await Promise.all([
    getUserGroups(userId),
    db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) }),
  ]);

  const chatEnabled = preferences?.chatEnabled !== false;
  if (!chatEnabled || groups.length === 0) {
    return {
      groups,
      chatEnabled,
      canViewChat: false,
    };
  }

  const permissions = await getPermissions(userId, groups);
  return {
    groups,
    chatEnabled,
    canViewChat: hasChatPermission(permissions),
  };
}

export function requireChatAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ success: false, error: "Usuário não autenticado." });
      return;
    }

    const { canViewChat } = await getChatAccessState(user.id);
    if (canViewChat) {
      next();
      return;
    }

    res.status(403).json({ success: false, error: "Permissão insuficiente." });
  };
}

export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ success: false, error: "Usuário não autenticado." });
      return;
    }
    const groups = await getUserGroups(user.id);
    if (isAdmin(groups)) {
      next();
      return;
    }
    const permissions = await getPermissions(user.id, groups);
    if (permissions[resource]?.has(action)) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: "Permissão negada." });
  };
}

export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ success: false, error: "Usuário não autenticado." });
      return;
    }
    const groups = await getUserGroups(user.id);
    if (isAdmin(groups)) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: "Acesso restrito a administradores." });
  };
}
