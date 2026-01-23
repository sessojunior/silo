import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { group, groupPermission } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { DEFAULT_GROUP_PERMISSIONS } from "@/lib/permissions";
import {
  parseRequestJson,
  parseRequestQuery,
  successResponse,
  errorResponse,
} from "@/lib/api-response";
import { z } from "zod";

const GroupPermissionQuerySchema = z.object({
  groupId: z.string().uuid(),
});

const GroupPermissionUpdateSchema = z.object({
  groupId: z.string().uuid(),
  resource: z.string().trim().min(1),
  action: z.string().trim().min(1),
  enabled: z.boolean(),
});

const isImmutablePermission = (resource: string, action: string) =>
  DEFAULT_GROUP_PERMISSIONS.some(
    (permission) =>
      permission.resource === resource && permission.action === action,
  );

const buildPermissionsSummary = (
  rows: Array<{ resource: string; action: string }>,
) =>
  rows.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.resource]) {
      acc[row.resource] = [];
    }
    acc[row.resource].push(row.action);
    return acc;
  }, {});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const parsedQuery = parseRequestQuery(request, GroupPermissionQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;
    const { groupId } = parsedQuery.data;

    const existingGroup = await db
      .select({ id: group.id, role: group.role })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (existingGroup.length === 0) {
      return errorResponse("Grupo não encontrado.", 404);
    }

    const rows = await db
      .select({
        resource: groupPermission.resource,
        action: groupPermission.action,
      })
      .from(groupPermission)
      .where(eq(groupPermission.groupId, groupId));

    const existingSet = new Set(
      rows.map((row) => `${row.resource}:${row.action}`),
    );
    const missingDefaults = DEFAULT_GROUP_PERMISSIONS.filter(
      (permission) =>
        !existingSet.has(`${permission.resource}:${permission.action}`),
    );

    if (missingDefaults.length > 0) {
      await db.insert(groupPermission).values(
        missingDefaults.map((permission) => ({
          groupId,
          resource: permission.resource,
          action: permission.action,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }

    const combinedRows =
      missingDefaults.length > 0 ? [...rows, ...missingDefaults] : rows;

    return successResponse({
      permissions: buildPermissionsSummary(combinedRows),
    });
  } catch (error) {
    console.error("❌ [API_GROUP_PERMISSIONS] Erro ao buscar permissões:", {
      error,
    });
    return errorResponse("Erro ao carregar permissões", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const parsedBody = await parseRequestJson(
      request,
      GroupPermissionUpdateSchema,
    );
    if (!parsedBody.ok) return parsedBody.response;

    const { groupId, resource, action, enabled } = parsedBody.data;

    const existingGroup = await db
      .select({ id: group.id, role: group.role })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (existingGroup.length === 0) {
      return errorResponse("Grupo não encontrado.", 404);
    }

    if (existingGroup[0].role === "admin") {
      return errorResponse(
        "Não é possível alterar permissões do grupo administrador.",
        400,
      );
    }

    if (!enabled && isImmutablePermission(resource, action)) {
      return errorResponse(
        "Esta permissão é obrigatória e não pode ser desativada.",
        400,
      );
    }

    if (enabled) {
      const existing = await db
        .select({ id: groupPermission.id })
        .from(groupPermission)
        .where(
          and(
            eq(groupPermission.groupId, groupId),
            eq(groupPermission.resource, resource),
            eq(groupPermission.action, action),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(groupPermission).values({
          groupId,
          resource,
          action,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      await db
        .delete(groupPermission)
        .where(
          and(
            eq(groupPermission.groupId, groupId),
            eq(groupPermission.resource, resource),
            eq(groupPermission.action, action),
          ),
        );
    }

    return successResponse(
      { groupId, resource, action, enabled },
      "Permissão atualizada com sucesso.",
    );
  } catch (error) {
    console.error("❌ [API_GROUP_PERMISSIONS] Erro ao atualizar permissão:", {
      error,
    });
    return errorResponse("Erro ao atualizar permissão", 500);
  }
}
