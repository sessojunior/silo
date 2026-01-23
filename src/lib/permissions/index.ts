import { db } from "@/lib/db";
import { group, groupPermission, userGroup } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api-response";
import { requireAuthUser, type AuthUser } from "@/lib/auth/server";
import { eq, inArray } from "drizzle-orm";

export type PermissionAction = string;
export type PermissionResource = string;

export type UserGroupInfo = {
  id: string;
  name: string;
  role: string;
};

export type PermissionsMap = Record<PermissionResource, Set<PermissionAction>>;
export type PermissionsSummary = Record<PermissionResource, PermissionAction[]>;

type PermissionResult =
  | {
      ok: true;
      user: AuthUser;
      groups: UserGroupInfo[];
      permissions: PermissionsMap;
      isAdmin: boolean;
    }
  | { ok: false; response: Response };

type PermissionCheckOptions = {
  scopeGroupId?: string | null;
};

export const getUserGroups = async (userId: string): Promise<UserGroupInfo[]> => {
  const groups = await db
    .select({
      id: group.id,
      name: group.name,
      role: group.role,
    })
    .from(userGroup)
    .innerJoin(group, eq(group.id, userGroup.groupId))
    .where(eq(userGroup.userId, userId));

  return groups;
};

type PermissionRow = {
  resource: PermissionResource;
  action: PermissionAction;
};

const buildPermissionsMap = (rows: PermissionRow[]): PermissionsMap => {
  const permissions: PermissionsMap = {};

  rows.forEach((row) => {
    if (!permissions[row.resource]) {
      permissions[row.resource] = new Set<PermissionAction>();
    }
    permissions[row.resource].add(row.action);
  });

  return permissions;
};

const getPermissionsByGroupIds = async (
  groupIds: string[],
): Promise<PermissionRow[]> => {
  if (groupIds.length === 0) return [];

  const rows = await db
    .select({
      resource: groupPermission.resource,
      action: groupPermission.action,
    })
    .from(groupPermission)
    .where(inArray(groupPermission.groupId, groupIds));

  return rows;
};

export const DEFAULT_GROUP_PERMISSIONS: ReadonlyArray<PermissionRow> = [
  { resource: "dashboard", action: "view" },
  { resource: "projects", action: "list" },
  { resource: "products", action: "list" },
  { resource: "help", action: "view" },
];

const ensureDefaultGroupPermissions = async (groupIds: string[]) => {
  if (groupIds.length === 0) return;

  const rows = await db
    .select({
      groupId: groupPermission.groupId,
      resource: groupPermission.resource,
      action: groupPermission.action,
    })
    .from(groupPermission)
    .where(inArray(groupPermission.groupId, groupIds));

  const permissionsByGroup = new Map<string, Set<string>>();
  groupIds.forEach((groupId) => {
    permissionsByGroup.set(groupId, new Set());
  });

  rows.forEach((row) => {
    const existing = permissionsByGroup.get(row.groupId);
    if (existing) {
      existing.add(`${row.resource}:${row.action}`);
    } else {
      permissionsByGroup.set(
        row.groupId,
        new Set([`${row.resource}:${row.action}`]),
      );
    }
  });

  const toInsert = groupIds.flatMap((groupId) => {
    const existing = permissionsByGroup.get(groupId) ?? new Set();
    return DEFAULT_GROUP_PERMISSIONS.filter(
      (permission) =>
        !existing.has(`${permission.resource}:${permission.action}`),
    ).map((permission) => ({
      groupId,
      resource: permission.resource,
      action: permission.action,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  if (toInsert.length > 0) {
    await db.insert(groupPermission).values(toInsert);
  }
};

export const ALL_GROUP_PERMISSIONS: ReadonlyArray<PermissionRow> = [
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

export const toPermissionsSummary = (
  permissions: PermissionsMap,
): PermissionsSummary => {
  const summary: PermissionsSummary = {};
  Object.entries(permissions).forEach(([resource, actions]) => {
    summary[resource] = Array.from(actions);
  });
  return summary;
};

export const hasPermission = (
  permissions: PermissionsMap,
  resource: PermissionResource,
  action: PermissionAction,
): boolean => {
  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;
  return resourcePermissions.has(action);
};

export const requirePermissionAuthUser = async (
  resource: PermissionResource,
  action: PermissionAction,
  options?: PermissionCheckOptions,
): Promise<PermissionResult> => {
  const authResult = await requireAuthUser();
  if (!authResult.ok) return authResult;

  const groups = await getUserGroups(authResult.user.id);
  const isAdmin = groups.some((item) => item.role === "admin");
  const groupIds = groups.map((item) => item.id);

  await ensureDefaultGroupPermissions(groupIds);
  const permissionRows = await getPermissionsByGroupIds(groupIds);
  const combinedRows = isAdmin
    ? [...permissionRows, ...ALL_GROUP_PERMISSIONS]
    : permissionRows;
  const permissions = buildPermissionsMap(combinedRows);

  if (!hasPermission(permissions, resource, action)) {
    return {
      ok: false,
      response: errorResponse("Permissão insuficiente.", 403),
    };
  }

  if (options?.scopeGroupId && !groupIds.includes(options.scopeGroupId)) {
    return {
      ok: false,
      response: errorResponse("Usuário não participa deste grupo.", 403),
    };
  }

  return {
    ok: true,
    user: authResult.user,
    groups,
    permissions,
    isAdmin: false,
  };
};

export const getUserPermissionsSummary = async (userId: string) => {
  const groups = await getUserGroups(userId);
  const isAdmin = groups.some((item) => item.role === "admin");
  const groupIds = groups.map((item) => item.id);
  await ensureDefaultGroupPermissions(groupIds);
  const permissionRows = await getPermissionsByGroupIds(groupIds);
  const combinedRows = isAdmin
    ? [...permissionRows, ...ALL_GROUP_PERMISSIONS]
    : permissionRows;
  const permissions = buildPermissionsMap(combinedRows);
  const summary = toPermissionsSummary(permissions);

  return { groups, isAdmin, permissions, summary };
};
