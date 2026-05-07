import { db } from "@silo/database";
import { group, groupPermission, userGroup } from "@silo/database/schema";
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
