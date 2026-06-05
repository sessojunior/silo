"use client";

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { toast } from "@silo/engine/format/toast";
import type { AuthUser } from "@/lib/auth/server";
import type { GroupDto as Group } from "@silo/engine/contracts/dto/groups";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { config } from "@/lib/config";
import Switch from "@/components/ui/switch";
import Offcanvas from "@/components/ui/offcanvas";
import Button from "@/components/ui/button";

// Simplified permission catalog: resources with only view/manage actions
const PERMISSION_CATALOG = [
  { resource: "products", label: "Produtos", actions: [{ action: "view", label: "Visualizar" }, { action: "manage", label: "Gerenciar" }] },
  { resource: "projects", label: "Projetos", actions: [{ action: "view", label: "Visualizar" }, { action: "manage", label: "Gerenciar" }] },
  { resource: "groups", label: "Grupos e Usuários", actions: [{ action: "view", label: "Visualizar" }, { action: "manage", label: "Gerenciar" }] },
  { resource: "reports", label: "Relatórios/Dashboard", actions: [{ action: "view", label: "Visualizar" }, { action: "manage", label: "Gerenciar" }] },
  { resource: "chat", label: "Chat", actions: [{ action: "view", label: "Visualizar" }, { action: "manage", label: "Gerenciar" }] },
];

const ALWAYS_ON_PERMISSIONS = new Set([
  "projects:view",
  "products:view",
]);

const buildAllPermissions = () =>
  PERMISSION_CATALOG.reduce<Record<string, string[]>>((acc, section) => {
    acc[section.resource] = section.actions.map((item) => item.action);
    return acc;
  }, {});

// Helpers to canonicalize group permissions returned by the API into the simplified model
const mapResourceToV2 = (resource: string) => {
  if (!resource) return resource;
  const r = resource.toLowerCase();
  if (r.startsWith("product") || r.startsWith("picture") || r.startsWith("radar")) return "products";
  if (r.startsWith("project")) return "projects";
  if (r === "groups" || r === "users" || r.startsWith("group")) return "groups";
  if (r === "reports" || r === "dashboard" || r.includes("report")) return "reports";
  if (r === "chat" || r.includes("chat")) return "chat";
  return resource;
};

const mapActionToV2 = (_resource: string, action: string) => {
  if (!action) return "manage";
  const a = action.toLowerCase();
  if (["list", "view", "read"].includes(a) || a.includes("view")) return "view";
  if (["create", "update", "edit", "delete", "assign", "reorder", "approve", "send"].some((x) => a.includes(x))) return "manage";
  return "manage";
};

const canonicalizeGroupPermissions = (raw: Record<string, string[]> | undefined) => {
  const out: Record<string, string[]> = {};
  if (!raw) return out;
  Object.entries(raw).forEach(([resource, actions]) => {
    const r2 = mapResourceToV2(resource);
    const set = new Set<string>();
    (actions || []).forEach((a) => set.add(mapActionToV2(resource, a)));
    if (set.has("manage")) set.add("view");
    out[r2] = Array.from(set);
  });
  return out;
};

interface GroupUsersSectionProps {
  group: Group;
  isExpanded: boolean;
  isAdmin: boolean;
}

export interface GroupUsersSectionRef {
  refreshUsers: () => void;
  openPermissions: () => void;
}

const GroupUsersSection = forwardRef<
  GroupUsersSectionRef,
  GroupUsersSectionProps
>(({ group, isExpanded, isAdmin }, ref) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [savingPermission, setSavingPermission] = useState<string | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setPermissionsLoading(true);
      const response = await fetch(
        config.getApiUrl(`/api/admin/groups/permissions?groupId=${group.id}`),
      );
      const data = await response.json();

      if (data.success) {
        setPermissions(canonicalizeGroupPermissions(data.data.permissions || {}));
      } else {
        console.error(
          "❌ [COMPONENT_GROUP_USERS_SECTION] Erro ao carregar permissões do grupo:",
          { error: data.error },
        );
        toast({
          type: "error",
          title: "Erro ao carregar permissões",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error(
        "❌ [COMPONENT_GROUP_USERS_SECTION] Erro inesperado ao carregar permissões:",
        { error },
      );
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao carregar permissões do grupo",
      });
    } finally {
      setPermissionsLoading(false);
    }
  }, [group.id, isAdmin]);

  const hasPermission = (resource: string, action: string) =>
    permissions[resource]?.includes(action) ?? false;

  const updatePermissionState = (
    resource: string,
    action: string,
    enabled: boolean,
  ): Record<string, string[]> =>
    ({
      ...permissions,
      [resource]: enabled
        ? Array.from(new Set([...(permissions[resource] || []), action]))
        : (permissions[resource] || []).filter((item) => item !== action),
    });

  const handlePermissionToggle = async (
    resource: string,
    action: string,
    enabled: boolean,
  ) => {
    if (!isAdmin || group.role === "admin") return;
    const key = `${resource}:${action}`;
    const previous = permissions;
    setSavingPermission(key);
    setPermissions(updatePermissionState(resource, action, enabled));

    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/groups/permissions"),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            resource,
            action,
            enabled,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setPermissions(previous);
        toast({
          type: "error",
          title: "Erro ao atualizar permissão",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      setPermissions(previous);
      console.error(
        "❌ [COMPONENT_GROUP_USERS_SECTION] Erro ao atualizar permissão:",
        { error },
      );
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao atualizar permissão do grupo",
      });
    } finally {
      setSavingPermission(null);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(
        config.getApiUrl(`/api/admin/users?groupId=${group.id}`),
      );
      const data = await response.json();

      if (data.success) {
        setUsers(data.data.items);
      } else {
        console.error(
          "❌ [COMPONENT_GROUP_USERS_SECTION] Erro ao carregar usuários do grupo:",
          { error: data.error },
        );
        toast({
          type: "error",
          title: "Erro ao carregar usuários",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error(
        "❌ [COMPONENT_GROUP_USERS_SECTION] Erro inesperado ao carregar usuários:",
        { error },
      );
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao carregar usuários do grupo",
      });
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  // Expor função de refresh para o componente pai
  useImperativeHandle(
    ref,
    () => ({
      refreshUsers: fetchUsers,
      openPermissions: () => setPermissionsOpen(true),
    }),
    [fetchUsers],
  );

  // Carregar usuários quando expandido
  useEffect(() => {
    if (isExpanded && group.id) {
      fetchUsers();
    }
  }, [isExpanded, group.id, fetchUsers]);

  useEffect(() => {
    if (!permissionsOpen || !group.id) return;
    if (group.role === "admin") {
      setPermissions(buildAllPermissions());
      return;
    }
    fetchPermissions();
  }, [permissionsOpen, group.id, group.role, fetchPermissions]);

  return (
    <>
      <Offcanvas
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <span className="icon-[lucide--shield-check] size-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">Permissões do grupo</h2>
              <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {group.name}
              </p>
            </div>
          </div>
        }
        width="lg"
        footerActions={
          <>
            <Button
              style="bordered"
              type="button"
              onClick={() => setPermissionsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => setPermissionsOpen(false)}
              disabled={permissionsLoading || savingPermission !== null}
              className="flex items-center gap-2"
            >
              {permissionsLoading || savingPermission !== null ? (
                <>
                  <span className="icon-[lucide--loader-circle] size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <span className="icon-[lucide--save] size-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6 h-full">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="icon-[lucide--flask-conical] size-5 mt-0.5 text-amber-700 dark:text-amber-300" />
            <div>
              <div className="text-base font-semibold">
                Funcionalidade experimental
              </div>
              <div className="text-sm">
                As permissões estão em testes. Qualquer irregularidade ou mau
                funcionamento deve ser comunicada para correção.
              </div>
            </div>
          </div>
          {group.role === "admin" && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Grupo administrador possui todas as permissões do sistema.
            </div>
          )}

          {permissionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner
                text="Carregando permissões..."
                size="sm"
                variant="horizontal"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 pb-6">
              {PERMISSION_CATALOG.map((section) => (
                <div
                  key={section.resource}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                    {section.label}
                  </div>
                  <div className="space-y-3">
                    {section.actions.map((item) => {
                      const key = `${section.resource}:${item.action}`;
                      const isImmutable = ALWAYS_ON_PERMISSIONS.has(key);
                      const checked =
                        group.role === "admin" ||
                        isImmutable ||
                        hasPermission(section.resource, item.action);
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {item.label}
                          </span>
                          <Switch
                            id={`perm-${group.id}-${section.resource}-${item.action}`}
                            name={`perm-${section.resource}-${item.action}`}
                            size="xs"
                            checked={checked}
                            disabled={
                              !isAdmin ||
                              group.role === "admin" ||
                              savingPermission === key ||
                              isImmutable
                            }
                            onChange={(value) =>
                              handlePermissionToggle(
                                section.resource,
                                item.action,
                                value,
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Offcanvas>

      {!isExpanded ? null : (
        <tr>
          <td colSpan={isAdmin ? 5 : 4}>
            {/* Header da seção de usuários */}
            <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="icon-[lucide--users] size-4 text-zinc-600 dark:text-zinc-400" />
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Usuários do grupo {group.name}
                </h4>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  ({users.length} {users.length === 1 ? "usuário" : "usuários"})
                </span>
              </div>
            </div>

            {/* Conteúdo dos usuários */}
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner
                    text="Carregando usuários..."
                    size="sm"
                    variant="horizontal"
                  />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-6">
                  <span className="icon-[lucide--user-x] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 block" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Nenhum usuário neste grupo ainda.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar placeholder */}
                        <div className="size-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="icon-[lucide--user] size-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                            {user.name}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status do usuário */}
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}
                        >
                          {user.isActive ? "🟢 Ativo" : "🔴 Inativo"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

GroupUsersSection.displayName = "GroupUsersSection";

export default GroupUsersSection;
