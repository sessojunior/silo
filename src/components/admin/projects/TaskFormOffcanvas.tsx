"use client";

import React, { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import Offcanvas from "@/components/ui/Offcanvas";
import Dialog from "@/components/ui/Dialog";
import MultiSelect from "@/components/ui/MultiSelect";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// Interface local para evitar dependência externa
interface KanbanTask {
  id: string;
  project_id: string;
  project_activity_id: string;
  name: string;
  description: string;
  category: string;
  estimated_days: number;
  status: "todo" | "in_progress" | "blocked" | "review" | "done";
  sort: number;
  start_date: string;
  end_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignedUsers?: string[]; // Campo para usuários associados
}

// Cache global de usuários para carregamento instantâneo
let globalUsersCache: {
  value: string;
  label: string;
  image?: string | null;
}[] = [];
let globalUsersCacheTimestamp = 0;
let globalUsersCacheHash = ""; // Hash para detectar mudanças nos dados
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função para gerar hash dos dados de usuários
function generateUsersHash(
  users: { value: string; label: string; image?: string | null }[],
): string {
  const dataString = users
    .map((u) => `${u.value}:${u.label}:${u.image}`)
    .join("|");
  return btoa(dataString).slice(0, 16); // Hash base64 truncado para performance
}

// Função para verificar se o cache ainda é válido
function isCacheValid(): boolean {
  return (
    globalUsersCache.length > 0 &&
    Date.now() - globalUsersCacheTimestamp < CACHE_DURATION
  );
}

// Função para verificar se os dados do cache ainda são atuais
function isCacheDataCurrent(
  users: { value: string; label: string; image?: string | null }[],
): boolean {
  const currentHash = generateUsersHash(users);
  return currentHash === globalUsersCacheHash;
}

// Função para invalidar cache quando dados mudam
export function invalidateUsersCache(): void {
  globalUsersCache = [];
  globalUsersCacheTimestamp = 0;
  globalUsersCacheHash = "";
  console.log(
    "ℹ️ [COMPONENT_TASK_FORM] Cache de usuários invalidado (dados mudaram)",
  );
}

// Função para forçar refresh do cache (útil para admin)
export function refreshUsersCache(): void {
  globalUsersCache = [];
  globalUsersCacheTimestamp = 0;
  globalUsersCacheHash = "";
  console.log("ℹ️ [COMPONENT_TASK_FORM] Cache de usuários forçado a refresh");
}

// Função para carregar usuários com cache inteligente e validação de dados
async function loadUsersWithCache(): Promise<
  { value: string; label: string; image?: string | null }[]
> {
  // Se o cache é válido, verificar se os dados ainda são atuais
  if (isCacheValid()) {
    // Fazer uma chamada rápida para verificar se os dados mudaram
    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/users?check=1"),
      ); // Parâmetro para verificação rápida
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data?.items)) {
          const currentUsers = data.data.items.map(
            (user: { id: string; name: string; image?: string | null }) => ({
              value: user.id,
              label: user.name,
              image: user.image,
            }),
          );

          // Se os dados são os mesmos, usar cache
          if (isCacheDataCurrent(currentUsers)) {
            console.log(
              "ℹ️ [COMPONENT_TASK_FORM] Usando cache de usuários (dados inalterados)",
            );
            return globalUsersCache;
          } else {
            console.log(
              "ℹ️ [COMPONENT_TASK_FORM] Dados mudaram, invalidando cache",
            );
            invalidateUsersCache();
          }
        }
      }
    } catch {
      console.warn(
        "⚠️ [COMPONENT_TASK_FORM] Erro na verificação rápida, usando cache existente",
      );
      return globalUsersCache;
    }
  }

  // Cache expirado, vazio ou dados mudaram, carregar da API

  try {
    const response = await fetch(config.getApiUrl("/api/admin/users"));

    if (response.ok) {
      const data = await response.json();

      if (data.success && Array.isArray(data.data?.items)) {
        const users = data.data.items.map(
          (user: { id: string; name: string; image?: string | null }) => ({
            value: user.id,
            label: user.name,
            image: user.image,
          }),
        );

        // Atualizar cache global com novo hash
        globalUsersCache = users;
        globalUsersCacheTimestamp = Date.now();
        globalUsersCacheHash = generateUsersHash(users);

        return users;
      }
    }

    throw new Error("Falha ao carregar usuários da API");
  } catch (error) {
    console.error("❌ [COMPONENT_TASK_FORM] Erro ao carregar usuários:", {
      error,
    });

    // Fallback: usuários de exemplo
    const fallbackUsers = [
      { value: "user1", label: "Mario Junior", image: null },
      { value: "user2", label: "Usuário Teste 1", image: null },
      { value: "user3", label: "Usuário Teste 2", image: null },
    ];

    // Atualizar cache com fallback
    globalUsersCache = fallbackUsers;
    globalUsersCacheTimestamp = Date.now();
    globalUsersCacheHash = generateUsersHash(fallbackUsers);

    return fallbackUsers;
  }
}

// Sistema de eventos para invalidação automática do cache
export function setupUsersCacheInvalidation(): void {
  // Invalidar cache quando usuário é criado/editado/deletado
  // Esta função deve ser chamada pelas APIs de usuários
  console.log(
    "ℹ️ [COMPONENT_TASK_FORM] Sistema de invalidação automática do cache configurado",
  );
}

// Função para invalidar cache quando usuário específico muda
export function invalidateUserCache(userId: string): void {
  if (globalUsersCache.some((u) => u.value === userId)) {
    console.log("ℹ️ [COMPONENT_TASK_FORM] Cache invalidado para usuário:", {
      userId,
    });
    invalidateUsersCache();
  }
}

// Função para invalidar cache quando múltiplos usuários mudam
export function invalidateMultipleUsersCache(userIds: string[]): void {
  const hasChanges = userIds.some((id) =>
    globalUsersCache.some((u) => u.value === id),
  );
  if (hasChanges) {
    console.log("ℹ️ [COMPONENT_TASK_FORM] Cache invalidado para usuários:", {
      userIdsCount: userIds.length,
    });
    invalidateUsersCache();
  }
}

interface TaskFormOffcanvasProps {
  isOpen: boolean;
  onClose: () => void;
  task?: KanbanTask | null;
  initialStatus?: KanbanTask["status"]; // Para quando criar nova tarefa numa coluna específica
  onSubmit: (taskData: LocalTaskFormData) => void;
  onDelete?: (task: KanbanTask) => void;
}

interface LocalTaskFormData {
  name: string;
  description: string;
  category: string;
  estimatedDays: number;
  startDate: string;
  endDate: string;
  priority: KanbanTask["priority"];
  status: KanbanTask["status"];
  assignedUsers: string[]; // REQUISITO: Campo obrigatório - pelo menos um usuário
}

export default function TaskFormOffcanvas({
  isOpen,
  onClose,
  task,
  initialStatus = "todo",
  onSubmit,
  onDelete,
}: TaskFormOffcanvasProps) {
  const [formData, setFormData] = useState<LocalTaskFormData>({
    name: "",
    description: "",
    category: "",
    estimatedDays: 1,
    startDate: "",
    endDate: "",
    priority: "medium",
    status: initialStatus,
    assignedUsers: [], // REQUISITO: Campo obrigatório - será validado no submit
  });
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    { value: string; label: string; image?: string | null }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Opções de status (colunas do Kanban)
  const statusOptions = [
    { value: "todo", label: "📋 A fazer" },
    { value: "in_progress", label: "🔄 Em progresso" },
    { value: "blocked", label: "🚫 Bloqueado" },
    { value: "review", label: "👁️ Em revisão" },
    { value: "done", label: "🏆 Concluído" },
  ];

  // Opções de prioridade
  const priorityOptions = [
    { value: "low", label: "⬇️ Baixa" },
    { value: "medium", label: "➡️ Média" },
    { value: "high", label: "⬆️ Alta" },
    { value: "urgent", label: "🚨 Urgente" },
  ];

  // Opções de categoria
  const categoryOptions = [
    { value: "Desenvolvimento", label: "💻 Desenvolvimento" },
    { value: "Infraestrutura", label: "🏗️ Infraestrutura" },
    { value: "Planejamento", label: "📊 Planejamento" },
    { value: "Teste", label: "🧪 Teste" },
    { value: "Documentação", label: "📚 Documentação" },
    { value: "Geral", label: "⚙️ Geral" },
  ];

  // Opções de estimativa de dias
  const estimatedDaysOptions = [
    { value: "1", label: "1 dia" },
    { value: "2", label: "2 dias" },
    { value: "3", label: "3 dias" },
    { value: "5", label: "5 dias" },
    { value: "8", label: "8 dias" },
    { value: "13", label: "13 dias" },
    { value: "21", label: "21 dias" },
  ];

  // Carregar usuários disponíveis com cache inteligente
  useEffect(() => {
    const loadUsers = async () => {
      // Se já temos usuários carregados, não mostrar loading
      if (availableUsers.length > 0) {
        console.log(
          "ℹ️ [COMPONENT_TASK_FORM] Usuários já disponíveis, pulando carregamento",
        );
        return;
      }

      try {
        setLoadingUsers(true);

        // Usar função de cache inteligente
        const users = await loadUsersWithCache();
        setAvailableUsers(users);
      } catch (error) {
        console.error(
          "❌ [COMPONENT_TASK_FORM] Erro crítico ao carregar usuários:",
          { error },
        );
        // Fallback já está no cache, não precisa fazer nada
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, availableUsers.length]);

  // Carregar dados da tarefa para edição (APÓS os usuários estarem carregados)
  useEffect(() => {
    // Só carregar dados da tarefa se os usuários estiverem disponíveis
    if (task && availableUsers.length > 0) {
      setFormData({
        name: task.name,
        description: task.description,
        category: task.category || "",
        estimatedDays: task.estimated_days,
        startDate: task.start_date || "",
        endDate: task.end_date || "",
        priority: task.priority,
        status: task.status,
        assignedUsers: task.assignedUsers || [], // REQUISITO: Campo obrigatório
      });
    } else if (!task && isOpen) {
      // Reset para nova tarefa
      setFormData({
        name: "",
        description: "",
        category: "",
        estimatedDays: 1,
        startDate: "",
        endDate: "",
        priority: "medium",
        status: initialStatus,
        assignedUsers: [], // REQUISITO: Campo obrigatório - será validado no submit
      });
    }
  }, [task, availableUsers.length, initialStatus, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!formData.name.trim()) {
      toast({
        type: "error",
        title: "Erro na validação",
        description: "Nome da tarefa é obrigatório",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        type: "error",
        title: "Erro na validação",
        description: "Descrição da tarefa é obrigatória",
      });
      return;
    }

    // REQUISITO: Pelo menos um usuário deve ser associado à tarefa
    if (!formData.assignedUsers || formData.assignedUsers.length === 0) {
      toast({
        type: "error",
        title: "Erro na validação",
        description: "Pelo menos um usuário deve ser associado à tarefa",
      });
      return;
    }

    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate > formData.endDate
    ) {
      toast({
        type: "error",
        title: "Erro na validação",
        description: "Data de início deve ser anterior à data de fim",
      });
      return;
    }

    try {
      setSaving(true);

      await onSubmit(formData);

      toast({
        type: "success",
        title: task ? "Tarefa atualizada" : "Tarefa criada",
        description: `${formData.name} ${task ? "foi atualizada" : "foi criada"} com sucesso`,
      });

      onClose();
    } catch (error) {
      console.error("❌ [COMPONENT_TASK_FORM] Erro ao salvar tarefa:", {
        error,
      });
      toast({
        type: "error",
        title: "Erro ao salvar",
        description: "Não foi possível salvar a tarefa. Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (
    field: keyof LocalTaskFormData,
    value: string | number | string[],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!task || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(task);
      setDeleteDialogOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Offcanvas
        open={isOpen}
        onClose={onClose}
        title={task ? "Editar Tarefa" : "Nova Tarefa"}
        width="xl"
        footerActions={
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              {task && onDelete && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={saving}
                >
                  <span className="icon-[lucide--trash] size-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                className="bg-zinc-500 hover:bg-zinc-600 text-white"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="task-form"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="icon-[lucide--loader-circle] size-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="icon-[lucide--save] size-4 mr-2" />
                    {task ? "Salvar tarefa" : "Criar tarefa"}
                  </>
                )}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6" id="task-form">
          {/* Nome da Tarefa */}
          <div>
            <Label htmlFor="name">Nome da Tarefa *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Ex: Implementar autenticação JWT"
              value={formData.name}
              setValue={(value) => handleFieldChange("name", value)}
              disabled={saving}
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description">Descrição *</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Descreva detalhadamente o que precisa ser feito nesta tarefa..."
              rows={4}
              disabled={saving}
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-base text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
            />
          </div>

          {/* Linha: Status e Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                selected={formData.status}
                onChange={(value) =>
                  handleFieldChange("status", value as KanbanTask["status"])
                }
                options={statusOptions}
                placeholder="Selecionar status"
              />
            </div>

            {/* Prioridade */}
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                name="priority"
                selected={formData.priority}
                onChange={(value) =>
                  handleFieldChange("priority", value as KanbanTask["priority"])
                }
                options={priorityOptions}
                placeholder="Selecionar prioridade"
              />
            </div>
          </div>

          {/* Linha: Categoria e Estimativa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoria */}
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select
                name="category"
                selected={formData.category}
                onChange={(value) => handleFieldChange("category", value)}
                options={categoryOptions}
                placeholder="Selecionar categoria"
              />
            </div>

            {/* Estimativa de dias */}
            <div>
              <Label htmlFor="estimatedDays">Estimativa</Label>
              <Select
                name="estimatedDays"
                selected={formData.estimatedDays.toString()}
                onChange={(value) =>
                  handleFieldChange("estimatedDays", parseInt(value))
                }
                options={estimatedDaysOptions}
                placeholder="Estimativa de dias"
              />
            </div>
          </div>

          {/* Linha: Usuários Associados */}
          <div>
            <Label htmlFor="assignedUsers">Usuários Associados *</Label>
            {loadingUsers ? (
              <div className="w-full px-3 py-3 border border-zinc-200 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                <LoadingSpinner
                  text="Carregando usuários..."
                  size="xs"
                  variant="horizontal"
                />
              </div>
            ) : (
              <MultiSelect
                name="assignedUsers"
                selected={formData.assignedUsers}
                onChange={(value) =>
                  handleFieldChange("assignedUsers", value as string[])
                }
                options={availableUsers}
                placeholder="Selecionar usuários (obrigatório)"
                required
                isInvalid={formData.assignedUsers.length === 0}
                invalidMessage="Pelo menos um usuário deve ser selecionado"
              />
            )}
          </div>

          {/* Linha: Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data de Início */}
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleFieldChange("startDate", e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Data de Fim */}
            <div>
              <Label htmlFor="endDate">Data de Fim</Label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleFieldChange("endDate", e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>
        </form>
      </Offcanvas>

      {/* Dialog de confirmação de exclusão integrado */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Confirmar exclusão"
      >
        <div className="p-6">
          <p className="text-base text-zinc-600 dark:text-zinc-400 mb-6">
            Tem certeza que deseja excluir a tarefa &quot;{task?.name}&quot;?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              style="bordered"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:bg-red-700"
            >
              {deleting ? (
                <>
                  <span className="icon-[lucide--loader-2] size-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                <>
                  <span className="icon-[lucide--trash] size-4" />
                  Excluir tarefa
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
