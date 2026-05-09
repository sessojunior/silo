"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "@silo/engine/format/toast";
import { config } from "@/lib/config";
import { readApiResponse } from "@silo/engine/contracts/api-response";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";
import MultiSelect, {
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import Offcanvas from "@/components/ui/offcanvas";
import Select, { type SelectOption } from "@/components/ui/select";

const USERS_CACHE_TTL_MS = 5 * 60 * 1000;

const TASK_STATUS_OPTIONS: SelectOption[] = [
  { value: "todo", label: "A fazer" },
  { value: "in_progress", label: "Em progresso" },
  { value: "blocked", label: "Bloqueado" },
  { value: "review", label: "Em revisão" },
  { value: "done", label: "Concluído" },
];

const TASK_PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const TASK_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Desenvolvimento", label: "Desenvolvimento" },
  { value: "Infraestrutura", label: "Infraestrutura" },
  { value: "Planejamento", label: "Planejamento" },
  { value: "Teste", label: "Teste" },
  { value: "Documentação", label: "Documentação" },
  { value: "Geral", label: "Geral" },
];

const ESTIMATED_DAYS_OPTIONS: SelectOption[] = [
  { value: "1", label: "1 dia" },
  { value: "2", label: "2 dias" },
  { value: "3", label: "3 dias" },
  { value: "5", label: "5 dias" },
  { value: "8", label: "8 dias" },
  { value: "13", label: "13 dias" },
  { value: "21", label: "21 dias" },
];

let cachedUsers: MultiSelectOption[] = [];
let cachedUsersTimestamp = 0;

type TaskStatus = "todo" | "in_progress" | "blocked" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

type TaskFormData = {
  name: string;
  description: string;
  category: string;
  estimatedDays: number;
  startDate: string;
  endDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedUsers: string[];
};

interface KanbanTaskLike {
  id: string;
  project_id: string;
  project_activity_id: string;
  name: string;
  description: string;
  category: string;
  estimated_days: number;
  start_date: string;
  end_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  sort: number;
  assignedUsers?: string[];
  assignedUsersDetails?: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    image: string | null;
  }>;
}

interface UserRecord {
  id: string;
  name: string;
  image?: string | null;
}

interface TaskFormOffcanvasProps {
  isOpen: boolean;
  onClose: () => void;
  task?: KanbanTaskLike | null;
  initialStatus?: TaskStatus;
  onSubmit: (taskData: TaskFormData) => Promise<void> | void;
  onDelete?: (task: KanbanTaskLike) => Promise<void> | void;
}

const createEmptyTaskForm = (status: TaskStatus): TaskFormData => ({
  name: "",
  description: "",
  category: "",
  estimatedDays: 1,
  startDate: "",
  endDate: "",
  priority: "medium",
  status,
  assignedUsers: [],
});

const buildFormDataFromTask = (
  task: KanbanTaskLike,
  initialStatus: TaskStatus,
): TaskFormData => ({
  name: task.name,
  description: task.description,
  category: task.category || "",
  estimatedDays: task.estimated_days || 1,
  startDate: task.start_date || "",
  endDate: task.end_date || "",
  priority: task.priority,
  status: task.status || initialStatus,
  assignedUsers:
    task.assignedUsers ?? task.assignedUsersDetails?.map((user) => user.id) ?? [],
});

const isUsersCacheFresh = (): boolean =>
  cachedUsers.length > 0 && Date.now() - cachedUsersTimestamp < USERS_CACHE_TTL_MS;

const isUserRecord = (value: unknown): value is UserRecord => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { id?: unknown; name?: unknown; image?: unknown };
  return typeof candidate.id === "string" && typeof candidate.name === "string";
};

const hasUserItemsPayload = (
  value: unknown,
): value is { items: UserRecord[] } => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items) && candidate.items.every(isUserRecord);
};

const mapUsersToOptions = (items: UserRecord[]): MultiSelectOption[] =>
  items
    .map((user) => ({
      value: user.id,
      label: user.name,
      image: user.image ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

export function invalidateUsersCache(): void {
  cachedUsers = [];
  cachedUsersTimestamp = 0;
}

export function refreshUsersCache(): void {
  invalidateUsersCache();
}

export function setupUsersCacheInvalidation(): void {
  return;
}

export function invalidateUserCache(userId: string): void {
  if (cachedUsers.some((user) => user.value === userId)) {
    invalidateUsersCache();
  }
}

export function invalidateMultipleUsersCache(userIds: string[]): void {
  if (userIds.some((userId) => cachedUsers.some((user) => user.value === userId))) {
    invalidateUsersCache();
  }
}

export async function loadUsersWithCache(): Promise<MultiSelectOption[]> {
  if (isUsersCacheFresh()) {
    return [...cachedUsers];
  }

  try {
    const response = await fetch(
      config.getApiUrl("/api/admin/users?check=1"),
      { cache: "no-store" },
    );
    const payload = await readApiResponse(response);

    if (!response.ok || !payload.success || !hasUserItemsPayload(payload.data)) {
      throw new Error(payload.error || payload.message || "Falha ao carregar usuários");
    }

    const users = mapUsersToOptions(payload.data.items);
    cachedUsers = users;
    cachedUsersTimestamp = Date.now();
    return [...users];
  } catch (error) {
    console.error("❌ [COMPONENT_TASK_FORM] Erro ao carregar usuários:", {
      error,
    });

    if (cachedUsers.length > 0) {
      return [...cachedUsers];
    }

    throw error instanceof Error ? error : new Error("Falha ao carregar usuários");
  }
}

export default function TaskFormOffcanvas({
  isOpen,
  onClose,
  task,
  initialStatus = "todo",
  onSubmit,
  onDelete,
}: TaskFormOffcanvasProps) {
  const [formData, setFormData] = useState<TaskFormData>(() =>
    createEmptyTaskForm(initialStatus),
  );
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<MultiSelectOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDeleteDialogOpen(false);
      setSaving(false);
      setDeleting(false);
      return;
    }

    setDeleteDialogOpen(false);

    if (task) {
      setFormData(buildFormDataFromTask(task, initialStatus));
    } else {
      setFormData(createEmptyTaskForm(initialStatus));
    }
  }, [isOpen, task, initialStatus]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const loadUsers = async () => {
      if (isUsersCacheFresh()) {
        if (active) {
          setAvailableUsers([...cachedUsers]);
        }
        return;
      }

      try {
        setLoadingUsers(true);
        const users = await loadUsersWithCache();

        if (active) {
          setAvailableUsers(users);
        }
      } catch (error) {
        if (active) {
          toast({
            type: "error",
            title: "Erro ao carregar usuários",
            description: "Não foi possível carregar a lista de usuários.",
          });
        }
        console.error("❌ [COMPONENT_TASK_FORM] Falha ao preparar usuários:", {
          error,
        });
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    };

    void loadUsers();

    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleFieldChange = (
    field: keyof TaskFormData,
    value: string | number | string[],
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

    if (formData.assignedUsers.length === 0) {
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

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!task || !onDelete) return;

    try {
      setDeleting(true);
      await onDelete(task);
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      console.error("❌ [COMPONENT_TASK_FORM] Erro ao excluir tarefa:", {
        error,
      });
      toast({
        type: "error",
        title: "Erro ao excluir",
        description: "Não foi possível excluir a tarefa. Tente novamente.",
      });
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
              {task && onDelete ? (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                  loading={deleting}
                  disabled={saving}
                >
                  Excluir
                </Button>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                style="bordered"
                disabled={saving || deleting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="task-form"
                loading={saving}
                disabled={deleting}
              >
                {task ? "Salvar tarefa" : "Criar tarefa"}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6" id="task-form">
          <div>
            <Label htmlFor="name">Nome da Tarefa *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Ex: Implementar autenticação JWT"
              value={formData.name}
              setValue={(value) => handleFieldChange("name", value)}
              disabled={saving || deleting}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição *</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(event) =>
                handleFieldChange("description", event.target.value)
              }
              placeholder="Descreva detalhadamente o que precisa ser feito nesta tarefa..."
              rows={4}
              disabled={saving || deleting}
              required
              className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                selected={formData.status}
                onChange={(value) =>
                  handleFieldChange("status", value as TaskStatus)
                }
                options={TASK_STATUS_OPTIONS}
                placeholder="Selecionar status"
              />
            </div>

            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                id="priority"
                name="priority"
                selected={formData.priority}
                onChange={(value) =>
                  handleFieldChange("priority", value as TaskPriority)
                }
                options={TASK_PRIORITY_OPTIONS}
                placeholder="Selecionar prioridade"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select
                id="category"
                name="category"
                selected={formData.category || null}
                onChange={(value) => handleFieldChange("category", value)}
                options={TASK_CATEGORY_OPTIONS}
                placeholder="Selecionar categoria"
              />
            </div>

            <div>
              <Label htmlFor="estimatedDays">Estimativa</Label>
              <Select
                id="estimatedDays"
                name="estimatedDays"
                selected={String(formData.estimatedDays)}
                onChange={(value) =>
                  handleFieldChange("estimatedDays", Number(value) || 1)
                }
                options={ESTIMATED_DAYS_OPTIONS}
                placeholder="Estimativa de dias"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="assignedUsers">Usuários Associados *</Label>
            {loadingUsers ? (
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <LoadingSpinner
                  text="Carregando usuários..."
                  size="xs"
                  variant="horizontal"
                />
              </div>
            ) : (
              <MultiSelect
                id="assignedUsers"
                name="assignedUsers"
                selected={formData.assignedUsers}
                onChange={(value) =>
                  handleFieldChange("assignedUsers", value)
                }
                options={availableUsers}
                placeholder="Selecionar usuários (obrigatório)"
                required
                isInvalid={formData.assignedUsers.length === 0}
                invalidMessage="Pelo menos um usuário deve ser selecionado"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(event) =>
                  handleFieldChange("startDate", event.target.value)
                }
                disabled={saving || deleting}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <Label htmlFor="endDate">Data de Fim</Label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(event) =>
                  handleFieldChange("endDate", event.target.value)
                }
                disabled={saving || deleting}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </form>
      </Offcanvas>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Confirmar exclusão"
        size="md"
      >
        <div className="p-6">
          <p className="mb-6 text-base text-zinc-600 dark:text-zinc-400">
            Tem certeza que deseja excluir a tarefa &quot;{task?.name}&quot;? Esta ação
            não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
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
              loading={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir tarefa
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
