import { db } from "@silo/database";
import { group, groupPermission, userGroup, userPreferences } from "@silo/database/schema";
import { eq, inArray, sql } from "drizzle-orm";
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

const CHAT_RESOURCE_LOCAL = CHAT_RESOURCE;

const canonicalizeAction = (resource: string, action: string): string => {
  // Keep chat-specific actions intact
  if (resource === CHAT_RESOURCE_LOCAL) return action;
  const a = action?.toLowerCase?.() ?? action;
  if (a === "view" || a === "manage") return a;
  if (["list", "read"].includes(a) || a.includes("view")) return "view";
  // anything that looks like create/update/edit/delete/assign -> manage
  if (
    ["create", "update", "edit", "delete", "assign", "reorder", "approve"].some((x) => a.includes(x))
  )
    return "manage";
  // default to manage for unknown actions (safer)
  return "manage";
};

const buildPermissionsMap = (rows: PermissionRow[]): PermissionsMap => {
  const permissions: PermissionsMap = {};
  rows.forEach((row) => {
    const resource = row.resource;
    const action = canonicalizeAction(resource, row.action);
    if (!permissions[resource]) permissions[resource] = new Set();
    permissions[resource].add(action);
  });
  return permissions;
};

export const getPermissions = async (
  userId: string,
  groups: UserGroupInfo[],
): Promise<PermissionsMap> => {
  if (groups.length === 0) return {};
  const groupIds = groups.map((g) => g.id);
  // Read compatibly from new v2 columns if present (resource_v2/action_v2) falling back to legacy cols
  const rows = await db
    .select({
      resource: sql<string>`COALESCE(${groupPermission.resourceV2}, ${groupPermission.resource})`,
      action: sql<string>`COALESCE(${groupPermission.actionV2}, ${groupPermission.action})`,
    })
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

  // Admins always have chat access
  if (isAdmin(groups)) {
    return { groups, chatEnabled, canViewChat: true };
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

    // Normalize requested action to canonical (view/manage) for comparison, while keeping chat actions intact
    const normalizeRequested = (resrc: string, act: string) => {
      if (resrc === CHAT_RESOURCE_LOCAL) return act;
      const a = act?.toLowerCase?.() ?? act;
      if (["list", "view", "read"].includes(a) || a.includes("view")) return "view";
      return "manage";
    };

    const reqAction = normalizeRequested(resource, action);

    // Direct match (permissions map already canonicalizes actions)
    if (permissions[resource]?.has(reqAction)) {
      next();
      return;
    }
    // manage implies view
    if (reqAction === "view" && permissions[resource]?.has("manage")) {
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
