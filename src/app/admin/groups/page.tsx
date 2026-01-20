"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";
import { formatDateBR } from "@/lib/dateUtils";
import { useAdminCheck } from "@/hooks/useAdminCheck";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import GroupFormOffcanvas from "@/components/admin/groups/GroupFormOffcanvas";
import GroupDeleteDialog from "@/components/admin/groups/GroupDeleteDialog";
import GroupUsersSection, {
  GroupUsersSectionRef,
} from "@/components/admin/groups/GroupUsersSection";
import UserSelectorOffcanvas from "@/components/admin/groups/UserSelectorOffcanvas";
import { Group } from "@/lib/db/schema";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Estados para expansão dos grupos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);

  // Estados do formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Estados do modal de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  // Estados do seletor de usuários
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const groupRefs = useRef<Map<string, GroupUsersSectionRef>>(new Map());

  // Verificar se usuário é administrador
  const { isAdmin, loading: adminLoading } = useAdminCheck();

  // Carregar grupos
  useEffect(() => {
    fetchGroups();
    fetchTotalUsers();
  }, []);

  async function fetchTotalUsers() {
    try {
      const response = await fetch(config.getApiUrl("/api/admin/users"));
      const data = await response.json();

      if (data.success) {
        setTotalUsers(data.data.total);
      }
    } catch (error) {
      console.error("❌ [PAGE_GROUPS] Erro ao carregar total de usuários:", {
        error,
      });
    }
  }

  // Função para atualizar apenas um grupo específico
  function refreshGroupUsers(groupId: string) {
    const groupRef = groupRefs.current.get(groupId);
    if (groupRef) {
      groupRef.refreshUsers();
    }
  }

  // Filtrar grupos
  useEffect(() => {
    let filtered = groups;

    // Filtro de busca
    if (search) {
      filtered = filtered.filter(
        (group) =>
          group.name.toLowerCase().includes(search.toLowerCase()) ||
          (group.description &&
            group.description.toLowerCase().includes(search.toLowerCase())),
      );
    }

    // Filtro de status
    if (statusFilter === "active") {
      filtered = filtered.filter((group) => group.active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((group) => !group.active);
    }

    setFilteredGroups(filtered);
  }, [groups, search, statusFilter]);

  async function fetchGroups() {
    try {
      setLoading(true);

      const response = await fetch(config.getApiUrl("/api/admin/groups"));
      const data = await response.json();

      if (data.success) {
        setGroups(data.data.items);
      } else {
        console.error("❌ [PAGE_GROUPS] Erro ao carregar grupos:", {
          error: data.error,
        });
        toast({
          type: "error",
          title: "Erro ao carregar grupos",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("❌ [PAGE_GROUPS] Erro inesperado ao carregar grupos:", {
        error,
      });
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao carregar grupos",
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingGroup(null);
    setFormOpen(true);
  }

  function openEditForm(group: Group) {
    setEditingGroup(group);
    setFormOpen(true);
  }

  function openDeleteDialog(group: Group) {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  }

  function openUserSelector(groupId: string) {
    setSelectedGroupId(groupId);
    setUserSelectorOpen(true);
  }

  function toggleGroupExpansion(groupId: string) {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }

  return (
    <>
      {/* Header */}
      <div className="w-full p-6 border-b border-zinc-200 dark:border-zinc-700">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Grupos
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Gerencie os grupos de usuários do sistema
        </p>
      </div>
      <div className="w-full space-y-6 p-6">
        {/* Ações e Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Busca */}
            <div className="relative w-full sm:w-80">
              <Input
                type="text"
                placeholder="Buscar grupos..."
                value={search}
                setValue={setSearch}
                className="pr-10"
              />
              <span className="icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4" />
            </div>

            {/* Filtro de Status */}
            <div className="flex-1">
              <Select
                name="statusFilter"
                selected={statusFilter}
                onChange={(value) =>
                  setStatusFilter(value as "all" | "active" | "inactive")
                }
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "active", label: "Apenas ativos" },
                  { value: "inactive", label: "Apenas inativos" },
                ]}
                placeholder="Filtrar por status"
              />
            </div>
          </div>

          {/* Botão Criar - apenas para administradores */}
          {isAdmin && (
            <Button
              onClick={openCreateForm}
              className="flex items-center gap-2"
            >
              <span className="icon-[lucide--plus] size-4" />
              Novo grupo
            </Button>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--users] size-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Total de Grupos
                </p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {groups.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--shield-check] size-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Grupos Ativos
                </p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {groups.filter((g) => g.active).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--user-check] size-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Total Usuários
                </p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalUsers}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--star] size-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Grupo Padrão
                </p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {groups.find((g) => g.isDefault)?.name || "Nenhum"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Grupos */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner
                text="Carregando grupos..."
                size="md"
                variant="centered"
              />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center">
              <span className="icon-[lucide--users] size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4 block" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                {search || statusFilter !== "all"
                  ? "Nenhum grupo encontrado"
                  : "Nenhum grupo cadastrado"}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                {search || statusFilter !== "all"
                  ? "Tente ajustar os filtros para encontrar o que procura."
                  : "Comece criando o primeiro grupo do sistema."}
              </p>
              {!search && statusFilter === "all" && (
                <Button
                  onClick={openCreateForm}
                  className="flex items-center gap-2"
                >
                  <span className="icon-[lucide--plus] size-4" />
                  Criar primeiro grupo
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Grupo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Criado em
                    </th>
                    {/* Coluna Ações - apenas para administradores */}
                    {!adminLoading && isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {filteredGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.id);
                    return (
                      <React.Fragment key={group.id}>
                        {/* Linha principal do grupo */}
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td
                            className="px-4 py-4 cursor-pointer"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Ícone de expansão */}
                              <span
                                className={`icon-[lucide--chevron-right] size-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                              <div
                                className="size-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: group.color }}
                              >
                                <span
                                  className={`${group.icon} size-5 text-white`}
                                />
                              </div>
                              <div>
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {group.name}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${group.active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}
                                  >
                                    {group.active ? "🟢 Ativo" : "🔴 Inativo"}
                                  </span>
                                  {group.isDefault && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                      🌟 Padrão
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-4 py-4 cursor-pointer"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <div className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                              {group.description || "—"}
                            </div>
                          </td>
                          <td
                            className="px-4 py-4 cursor-pointer"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                              {(group as Group & { userCount?: number })
                                .userCount || 0}{" "}
                              usuários
                            </div>
                          </td>
                          <td
                            className="px-4 py-4 cursor-pointer"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {formatDateBR(
                                new Date(group.createdAt)
                                  .toISOString()
                                  .split("T")[0],
                              )}
                            </div>
                          </td>
                          {/* Célula de Ações - apenas para administradores */}
                          {!adminLoading && isAdmin && (
                            <td className="px-4 py-4">
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Botão Gerenciar Usuários */}
                                <Button
                                  onClick={() => openUserSelector(group.id)}
                                  className="size-8 p-0 rounded-md bg-transparent hover:bg-green-50 dark:hover:bg-green-900/20"
                                  title="Gerenciar Usuários"
                                >
                                  <span className="icon-[lucide--users] size-4 text-green-600 dark:text-green-400" />
                                </Button>

                                {/* Botões de Edição e Exclusão */}
                                <Button
                                  onClick={() => openEditForm(group)}
                                  className="size-8 p-0 rounded-md bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Editar Grupo"
                                >
                                  <span className="icon-[lucide--edit] size-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                                {/* Não permitir exclusão de grupos administrativos */}
                                {group.role !== "admin" && (
                                  <Button
                                    onClick={() => openDeleteDialog(group)}
                                    className="size-8 p-0 rounded-md bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Excluir Grupo"
                                  >
                                    <span className="icon-[lucide--trash] size-4 text-red-600 dark:text-red-400" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                        {/* Seção de usuários expandida */}
                        <GroupUsersSection
                          ref={(ref) => {
                            if (ref) {
                              groupRefs.current.set(group.id, ref);
                            }
                          }}
                          group={group}
                          isExpanded={isExpanded}
                        />
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulário de Grupo */}
        <GroupFormOffcanvas
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          group={editingGroup}
          onSuccess={() => {
            fetchGroups();
            setFormOpen(false);
          }}
        />

        {/* Dialog de Exclusão */}
        <GroupDeleteDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          group={groupToDelete}
          onSuccess={() => {
            fetchGroups();
            setDeleteDialogOpen(false);
          }}
        />

        {/* Seletor de Usuários */}
        {selectedGroupId && (
          <UserSelectorOffcanvas
            isOpen={userSelectorOpen}
            onClose={() => {
              setUserSelectorOpen(false);
              setSelectedGroupId(null);
            }}
            group={groups.find((g) => g.id === selectedGroupId)!}
            onSuccess={() => {
              // Atualizar apenas o grupo específico que foi alterado
              if (selectedGroupId) {
                refreshGroupUsers(selectedGroupId);
              }
              fetchTotalUsers(); // Atualizar estatísticas gerais
              setUserSelectorOpen(false);
              setSelectedGroupId(null);
            }}
          />
        )}
      </div>
    </>
  );
}
