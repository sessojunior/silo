"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/api-response";

interface TaskHistoryEntry {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user: {
    name: string;
    image?: string | null;
  };
}

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
}

// Função para traduzir ações para português
const translateAction = (action: string): string => {
  const translations: Record<string, string> = {
    created: "Criou",
    status_change: "Moveu",
    updated: "Editou",
    deleted: "Excluiu",
  };
  return translations[action] || action;
};

const statusLabels: Record<string, string> = {
  todo: "A fazer",
  in_progress: "Em progresso",
  blocked: "Bloqueado",
  review: "Em revisão",
  done: "Concluído",
  deleted: "Excluída",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const getStatusLabel = (status?: string | null) =>
  status ? statusLabels[status] || status : "Sem status";

const getPriorityLabel = (priority?: string) =>
  priority ? priorityLabels[priority] || priority : "Não definida";

const getDetailsObject = (
  details?: Record<string, unknown> | null,
): Record<string, unknown> | null =>
  details && typeof details === "object" ? details : null;

const getStringValue = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const getNumberValue = (value: unknown) =>
  typeof value === "number" ? value : undefined;

const getArrayStringValue = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const normalizeTextValue = (value: unknown, emptyLabel: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : emptyLabel;
};

const formatEstimatedDays = (value: unknown) => {
  const days = getNumberValue(value);
  if (days === undefined) return "Sem estimativa";
  return days === 1 ? "1 dia" : `${days} dias`;
};

const formatDateValue = (value: unknown) => {
  const dateValue = getStringValue(value);
  if (!dateValue) return "Sem data";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("pt-BR");
};

const fieldLabels: Record<string, string> = {
  name: "nome",
  description: "descrição",
  category: "categoria",
  estimatedDays: "estimativa",
  startDate: "início",
  endDate: "fim",
  priority: "prioridade",
  status: "status",
};

const getEntryTitle = (entry: TaskHistoryEntry, taskName: string) => {
  if (entry.action === "status_change") {
    return `Moveu "${taskName}" de ${getStatusLabel(entry.fromStatus)} para ${getStatusLabel(entry.toStatus)}`;
  }
  if (entry.action === "created") {
    return `Criou "${taskName}" na coluna ${getStatusLabel(entry.toStatus)}`;
  }
  if (entry.action === "deleted") {
    return `Excluiu "${taskName}" da coluna ${getStatusLabel(entry.fromStatus)}`;
  }
  return `Editou "${taskName}"`;
};

const getEntryDetails = (entry: TaskHistoryEntry) => {
  const details = getDetailsObject(entry.details);
  if (entry.action === "created") {
    const initialData =
      details && typeof details.initialData === "object"
        ? (details.initialData as Record<string, unknown>)
        : null;
    const category = getStringValue(initialData?.category);
    const priority = getStringValue(initialData?.priority);
    const info: string[] = [];
    if (category) info.push(`Categoria: ${category}`);
    if (priority) info.push(`Prioridade: ${getPriorityLabel(priority)}`);
    return info;
  }
  if (entry.action === "deleted") {
    const deletedData =
      details && typeof details.deletedData === "object"
        ? (details.deletedData as Record<string, unknown>)
        : null;
    const category = getStringValue(deletedData?.category);
    const info: string[] = [];
    if (category) info.push(`Categoria: ${category}`);
    return info;
  }
  if (entry.action === "updated") {
    const changedFields = getArrayStringValue(details?.changedFields);
    const readableFields = changedFields
      .map((field) => fieldLabels[field] || field)
      .filter(Boolean);
    const oldValues =
      details && typeof details.oldValues === "object"
        ? (details.oldValues as Record<string, unknown>)
        : null;
    const newValues =
      details && typeof details.newValues === "object"
        ? (details.newValues as Record<string, unknown>)
        : null;
    const changes: string[] = [];
    const oldName = getStringValue(oldValues?.name);
    const newName = getStringValue(newValues?.name);
    if (oldName && newName && oldName !== newName) {
      changes.push(`Nome: "${oldName}" → "${newName}"`);
    }
    const oldDescription = normalizeTextValue(
      oldValues?.description,
      "Sem descrição",
    );
    const newDescription = normalizeTextValue(
      newValues?.description,
      "Sem descrição",
    );
    if (oldDescription !== newDescription) {
      changes.push(`Descrição: "${oldDescription}" → "${newDescription}"`);
    }
    const oldCategory = normalizeTextValue(
      oldValues?.category,
      "Sem categoria",
    );
    const newCategory = normalizeTextValue(
      newValues?.category,
      "Sem categoria",
    );
    if (oldCategory !== newCategory) {
      changes.push(`Categoria: "${oldCategory}" → "${newCategory}"`);
    }
    const oldStatus = getStringValue(oldValues?.status);
    const newStatus = getStringValue(newValues?.status);
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      changes.push(
        `Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      );
    }
    const oldEstimatedDays = formatEstimatedDays(oldValues?.estimatedDays);
    const newEstimatedDays = formatEstimatedDays(newValues?.estimatedDays);
    if (oldEstimatedDays !== newEstimatedDays) {
      changes.push(
        `Estimativa: ${oldEstimatedDays} → ${newEstimatedDays}`,
      );
    }
    const oldStartDate = formatDateValue(oldValues?.startDate);
    const newStartDate = formatDateValue(newValues?.startDate);
    if (oldStartDate !== newStartDate) {
      changes.push(`Início: ${oldStartDate} → ${newStartDate}`);
    }
    const oldEndDate = formatDateValue(oldValues?.endDate);
    const newEndDate = formatDateValue(newValues?.endDate);
    if (oldEndDate !== newEndDate) {
      changes.push(`Fim: ${oldEndDate} → ${newEndDate}`);
    }
    const oldPriority = getStringValue(oldValues?.priority);
    const newPriority = getStringValue(newValues?.priority);
    if (oldPriority && newPriority && oldPriority !== newPriority) {
      changes.push(
        `Prioridade: ${getPriorityLabel(oldPriority)} → ${getPriorityLabel(
          newPriority,
        )}`,
      );
    }
    if (changes.length > 0) return changes;
    if (readableFields.length > 0) {
      return [`Atualizou ${readableFields.join(", ")}`];
    }
  }
  if (entry.action === "status_change") {
    const kanbanMove = details?.kanbanMove === true;
    return kanbanMove ? ["Movimentação via kanban"] : [];
  }
  return [];
};

export default function TaskHistoryModal({
  isOpen,
  onClose,
  taskId,
  taskName,
}: TaskHistoryModalProps) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        config.getApiUrl(`/api/admin/tasks/${taskId}/history`),
      );
      const data = (await response.json()) as ApiResponse<{
        history: TaskHistoryEntry[];
      }>;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao carregar histórico");
      }

      setHistory(Array.isArray(data.data?.history) ? data.data.history : []);
    } catch (error) {
      console.error(
        "❌ [COMPONENT_TASK_HISTORY_MODAL] Erro ao carregar histórico:",
        { error },
      );
      setError(error instanceof Error ? error.message : "Erro desconhecido");
      toast({
        type: "error",
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico da tarefa.",
      });
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchHistory();
    }
  }, [isOpen, taskId, fetchHistory]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico da Tarefa"
      panelClassName="max-h-[90vh]"
      bodyClassName="flex-1 overflow-hidden"
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* Cabeçalho da tarefa */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--file-text] size-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {taskName}
              </h3>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner
                text="Carregando histórico..."
                size="sm"
                variant="horizontal"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <span className="icon-[lucide--alert-circle] size-4" />
                <span className="font-medium">Erro ao carregar histórico</span>
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1 ml-6">
                {error}
              </p>
            </div>
          )}

          {/* Timeline do histórico */}
          {!loading && !error && (
            <div className="space-y-3 px-3">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <span className="icon-[lucide--history] size-12 text-zinc-300 dark:text-zinc-600 mx-auto block mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Nenhum histórico encontrado
                  </p>
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                    Esta tarefa ainda não possui movimentações registradas
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Linha conectora vertical principal */}
                  <div className="absolute left-5 top-5 bottom-5 w-px bg-zinc-200 dark:bg-zinc-700" />

                  {/* Entradas do histórico */}
                  <div className="space-y-2">
                    {history.map((entry) => {
                      const details = getEntryDetails(entry);
                      return (
                        <div
                          key={entry.id}
                          className="relative flex items-start gap-3"
                        >
                        {/* Ícone da ação com fundo branco para sobrepor a linha */}
                        <div className="relative z-10 flex-shrink-0 size-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border-2 border-white dark:border-zinc-800">
                          <span className="icon-[lucide--history] size-4 text-blue-600 dark:text-blue-400" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {entry.user.name}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full">
                              {translateAction(entry.action)}
                            </span>
                          </div>
                          <div className="text-sm text-zinc-800 dark:text-zinc-200">
                            {getEntryTitle(entry, taskName)}
                          </div>
                          {details.length > 0 && (
                            <div className="mt-1 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                              {details.map((detail) => (
                                <div key={detail}>{detail}</div>
                              ))}
                            </div>
                          )}
                          <div className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                            {new Date(entry.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com botão */}
        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700 p-4">
          <Button
            type="button"
            onClick={onClose}
            className="bg-zinc-500 hover:bg-zinc-600 text-white px-4 py-2"
          >
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
