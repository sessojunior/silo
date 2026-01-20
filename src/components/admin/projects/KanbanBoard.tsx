"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateBR, formatFullDateBR } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// Types
interface Task {
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
  assignedUsers?: string[]; // IDs dos usuários associados
  assignedUsersDetails?: {
    id: string;
    name: string;
    role: string;
    email: string;
    image: string | null;
  }[]; // Detalhes completos dos usuários
}

interface Column {
  id: "todo" | "in_progress" | "blocked" | "review" | "done";
  title: string;
  icon: string;
  iconClass: string;
  bg: string;
  border: string;
  header: string;
  headerHover: string;
  countBg: string;
  countText: string;
  button: string;
}

interface KanbanBoardProps {
  tasks?: Task[];
  onTasksReorder?: (tasksBeforeMove: Task[], tasksAfterMove: Task[]) => void;
  isDragBlocked?: boolean;
  onCreateTask?: (status: Task["status"]) => void;
  onEditTask?: (task: Task) => void;
}

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

// NOVO MAPA DE CORES E ÍCONES POR COLUNA
const columnTheme = {
  todo: {
    icon: "icon-[lucide--list-todo]",
    iconClass: "size-6 text-stone-500 dark:text-stone-400",
    bg: "bg-stone-50 dark:bg-stone-900",
    border: "border-stone-100 dark:border-stone-700",
    header: "bg-stone-100 dark:bg-stone-800",
    headerHover: "hover:bg-stone-200 dark:hover:bg-stone-700",
    countBg: "bg-stone-200 dark:bg-stone-700",
    countText: "text-stone-600 dark:text-stone-300",
    button: "text-stone-600 dark:text-stone-300",
  },
  in_progress: {
    icon: "icon-[lucide--refresh-cw]",
    iconClass: "size-6 text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-100 dark:border-blue-800",
    header: "bg-blue-100 dark:bg-blue-900",
    headerHover: "hover:bg-blue-200 dark:hover:bg-blue-800",
    countBg: "bg-blue-200 dark:bg-blue-800",
    countText: "text-blue-600 dark:text-blue-300",
    button: "text-blue-600 dark:text-blue-300",
  },
  blocked: {
    icon: "icon-[lucide--ban]",
    iconClass: "size-6 text-red-500 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-100 dark:border-red-800",
    header: "bg-red-100 dark:bg-red-900",
    headerHover: "hover:bg-red-200 dark:hover:bg-red-800",
    countBg: "bg-red-200 dark:bg-red-800",
    countText: "text-red-600 dark:text-red-300",
    button: "text-red-600 dark:text-red-300",
  },
  review: {
    icon: "icon-[lucide--eye]",
    iconClass: "size-6 text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-100 dark:border-amber-800",
    header: "bg-amber-100 dark:bg-amber-900",
    headerHover: "hover:bg-amber-200 dark:hover:bg-amber-800",
    countBg: "bg-amber-200 dark:bg-amber-800",
    countText: "text-amber-600 dark:text-amber-300",
    button: "text-amber-600 dark:text-amber-300",
  },
  done: {
    icon: "icon-[lucide--trophy]",
    iconClass: "size-6 text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-100 dark:border-emerald-800",
    header: "bg-emerald-100 dark:bg-emerald-900",
    headerHover: "hover:bg-emerald-200 dark:hover:bg-emerald-800",
    countBg: "bg-emerald-200 dark:bg-emerald-800",
    countText: "text-emerald-600 dark:text-emerald-300",
    button: "text-emerald-600 dark:text-emerald-300",
  },
};

// NOVA DEFINIÇÃO DE COLUNAS
const columns: Column[] = [
  { id: "todo", title: "A fazer", ...columnTheme.todo },
  { id: "in_progress", title: "Em progresso", ...columnTheme.in_progress },
  { id: "blocked", title: "Bloqueado", ...columnTheme.blocked },
  { id: "review", title: "Em revisão", ...columnTheme.review },
  { id: "done", title: "Concluído", ...columnTheme.done },
];

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const categoryColors: Record<string, string> = {
  Desenvolvimento:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  Infraestrutura:
    "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  Planejamento: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
};

// Componente base reutilizável para conteúdo do card
function TaskCardContent({
  task,
  showEditButton = true,
  onEditTask,
  onViewHistory,
}: {
  task: Task;
  showEditButton?: boolean;
  onEditTask?: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
}) {
  // Usar funções utilitárias para formatação consistente de datas
  const formatDate = (dateString: string): string => {
    return formatDateBR(dateString);
  };

  // Função para formatação de datas completas nos tooltips
  const formatFullDate = (dateString: string): string => {
    return formatFullDateBR(dateString);
  };

  return (
    <div className="select-none">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${priorityColors[task.priority]}`}
          />
          <span
            className={`text-xs px-2 py-1 rounded-full ${categoryColors[task.category] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"}`}
          >
            {task.category}
          </span>
        </div>
        {showEditButton && (
          <div className="flex gap-1">
            {/* Botão de histórico */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory?.(task);
              }}
              className="flex items-center justify-center size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
              title="Ver histórico"
              type="button"
            >
              <span className="icon-[lucide--history] size-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
            </button>

            {/* Botão de editar */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask?.(task);
              }}
              className="flex items-center justify-center size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
              title="Editar tarefa"
              type="button"
            >
              <span className="icon-[lucide--pencil] size-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
            </button>
          </div>
        )}
      </div>

      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
        {task.name}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-4">
        {task.description}
      </p>

      {/* Informações de tempo e data */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
          {/* Data de início */}
          <span
            className="flex items-center justify-center gap-2 cursor-help"
            title={`Data de início: ${task.start_date ? formatFullDate(task.start_date) : "Não definida"}`}
          >
            <span className="icon-[lucide--calendar] size-4" />{" "}
            {task.start_date ? formatDate(task.start_date) : "N/A"}
          </span>
          <span className="icon-[lucide--arrow-right] size-4" />
          {/* Data de fim */}
          {task.end_date && (
            <span
              className="cursor-help"
              title={`Data de término: ${formatFullDate(task.end_date)}`}
            >
              {formatDate(task.end_date)}
            </span>
          )}
          <span
            className="cursor-help"
            title={`Estimativa: ${task.estimated_days} dia${task.estimated_days !== 1 ? "s" : ""} de trabalho`}
          ></span>
        </div>
      </div>

      {/* Usuários associados */}
      {task.assignedUsers && task.assignedUsers.length > 0 && (
        <div className="flex items-center justify-end">
          <div className="flex -space-x-2">
            {task.assignedUsers.slice(0, 3).map((userId, index) => {
              // Buscar o nome real do usuário dos detalhes
              const userDetails = task.assignedUsersDetails?.find(
                (u) => u.id === userId,
              );
              const userName = userDetails?.name || `Usuário ${index + 1}`; // Fallback se não encontrar nome
              const userRole = userDetails?.role || "assignee";

              return (
                <div
                  key={userId}
                  className="cursor-help"
                  title={`${userName} (${userRole})`}
                >
                  <Avatar
                    src={userDetails?.image}
                    name={userName}
                    size="sm"
                    className="border-2 border-white dark:border-zinc-800"
                  />
                </div>
              );
            })}
            {task.assignedUsers.length > 3 && (
              <div
                className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help"
                title={`+${task.assignedUsers.length - 3} usuários adicionais`}
              >
                +{task.assignedUsers.length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTaskCard({
  task,
  activeTask,
  onEditTask,
  onViewHistory,
}: {
  task: Task;
  activeTask: Task | null;
  onEditTask?: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: task.id,
      data: {
        type: "Task",
        task: task,
      },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isBeingDragged = activeTask?.id === task.id;
  const theme = columnTheme[task.status];

  if (isBeingDragged) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white dark:bg-zinc-800 rounded-xl border-2 ${theme.border} p-4 opacity-50`}
      >
        <TaskCardContent
          task={task}
          onEditTask={onEditTask}
          onViewHistory={onViewHistory}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white dark:bg-zinc-800 rounded-xl border-2 ${theme.border} p-4 cursor-move transition-shadow hover:shadow-md dark:hover:shadow-zinc-900/50`}
    >
      <TaskCardContent
        task={task}
        onEditTask={onEditTask}
        onViewHistory={onViewHistory}
      />
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 p-4 rotate-3 transform">
      <TaskCardContent task={task} showEditButton={false} />
    </div>
  );
}

function DroppableColumn({
  column,
  tasks,
  activeTask,
  onCreateTask,
  onEditTask,
  onViewHistory,
}: {
  column: Column;
  tasks: Task[];
  activeTask: Task | null;
  onCreateTask?: (status: Task["status"]) => void;
  onEditTask?: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const taskIds = tasks.map((task: Task) => task.id);
  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex flex-col rounded-xl border-2 ${column.border} shadow-md ${column.bg}`}
    >
      {/* Cabeçalho da coluna */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${column.header}`}
      >
        <div className="flex items-center gap-2">
          <span className={`${column.icon} ${column.iconClass}`} />
          <span className={`font-semibold text-base ${column.button}`}>
            {column.title}
          </span>
          <span
            className={`flex items-center justify-center text-xs size-6 rounded-full ${column.countBg} ${column.countText}`}
          >
            {tasks.length}
          </span>
        </div>
        <button
          className={`flex items-center justify-center size-8 rounded-full transition group ${column.headerHover}`}
          title="Adicionar tarefa"
          onClick={() => {
            if (onCreateTask) onCreateTask(column.id);
          }}
          type="button"
        >
          <span className={`icon-[lucide--plus] size-5 ${column.button}`} />
        </button>
      </div>
      {/* Lista de cards com scroll */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
          {tasks.map((task: Task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              activeTask={activeTask}
              onEditTask={onEditTask}
              onViewHistory={onViewHistory}
            />
          ))}
          {tasks.length === 0 && (
            <div className="h-24 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg flex items-center justify-center bg-zinc-50 dark:bg-zinc-800">
              <span className="text-gray-500 dark:text-zinc-400 text-sm">
                Arraste e solte aqui
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function KanbanBoard({
  tasks: externalTasks = [],
  onTasksReorder,
  isDragBlocked = false,
  onCreateTask,
  onEditTask,
  onViewHistory,
}: KanbanBoardProps & { onViewHistory?: (task: Task) => void }) {
  const [tasks, setTasks] = useState<Task[]>(externalTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [tasksBeforeMove, setTasksBeforeMove] = useState<Task[] | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    before: Task[];
    after: Task[];
  } | null>(null);
  const isPatchingRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setTasks(externalTasks);
  }, [externalTasks]);

  // Detectar mudanças no estado tasks e processar movimento pendente
  useEffect(() => {
    if (
      pendingMove &&
      pendingMove.before.length > 0 &&
      !isPatchingRef.current &&
      onTasksReorder
    ) {
      const before = pendingMove.before;
      const after = tasks.map((t) => ({ ...t })); // Estado atual das tasks

      // Verificar se houve mudança real
      const houveMudanca =
        before &&
        after.some((t, idx) => {
          const b = before[idx];
          return (
            !b || b.id !== t.id || b.status !== t.status || b.sort !== t.sort
          );
        });

      if (houveMudanca) {
        // Toast de feedback imediato
        // toast({
        // 	type: 'info',
        // 	title: '⏳ Salvando...',
        // 	description: 'Movimentação sendo salva no servidor...',
        // })

        // Enviar para backend
        onTasksReorder(before, after);
      }

      // Limpar movimento pendente
      setPendingMove(null);
    }
  }, [tasks, pendingMove, onTasksReorder]); // Dependência em tasks detecta mudanças automaticamente

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const getTasksByStatus = (status: TaskStatus) =>
    tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.sort - b.sort);

  const calculateNewPosition = (activeId: string, overId: string) => {
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return null;

    const isColumn = columns.some((col) => col.id === overId);
    const overTask = tasks.find((t) => t.id === overId);

    if (isColumn) {
      const newStatus = overId as TaskStatus;
      const targetTasks = tasks.filter(
        (t) => t.status === newStatus && t.id !== activeId,
      );
      return { newStatus, targetIndex: targetTasks.length };
    }

    if (overTask) {
      const newStatus = overTask.status;
      let targetTasks = tasks
        .filter((t) => t.status === newStatus && t.id !== activeId)
        .sort((a, b) => a.sort - b.sort);
      if (activeTask.status === newStatus) {
        targetTasks = tasks
          .filter((t) => t.status === newStatus)
          .sort((a, b) => a.sort - b.sort);
      }
      let targetIndex = targetTasks.findIndex((t) => t.id === overId);
      if (targetIndex === -1) {
        targetIndex = targetTasks.length;
      }
      return { newStatus, targetIndex };
    }
    return null;
  };

  const applyPositionChange = (
    activeId: string,
    newStatus: TaskStatus,
    targetIndex: number,
  ) => {
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const originalStatus = activeTask.status;
    setTasks((prevTasks) => {
      let updatedTasks = [...prevTasks];
      updatedTasks = updatedTasks.map((task) =>
        task.id === activeId ? { ...task, status: newStatus } : task,
      );
      const destinationTasks = updatedTasks
        .filter((t) => t.status === newStatus)
        .sort((a, b) => a.sort - b.sort);
      const taskToMove = destinationTasks.find((t) => t.id === activeId)!;
      const otherTasks = destinationTasks.filter((t) => t.id !== activeId);
      const finalOrder = [...otherTasks];
      finalOrder.splice(targetIndex, 0, taskToMove);
      updatedTasks = updatedTasks.map((task) => {
        if (task.status === newStatus) {
          const newIndex = finalOrder.findIndex((t) => t.id === task.id);
          return { ...task, sort: newIndex };
        }
        return task;
      });
      if (originalStatus !== newStatus) {
        const originTasks = updatedTasks
          .filter((t) => t.status === originalStatus)
          .sort((a, b) => a.sort - b.sort);
        updatedTasks = updatedTasks.map((task) => {
          if (task.status === originalStatus) {
            const newIndex = originTasks.findIndex((t) => t.id === task.id);
            return { ...task, sort: newIndex >= 0 ? newIndex : 0 };
          }
          return task;
        });
      }
      return updatedTasks;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
    setTasksBeforeMove(tasks.map((t) => ({ ...t })));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const isOverATask = over.data.current?.type === "Task";
    const isOverAColumn = columns.some((col) => col.id === overId);
    let newStatus: TaskStatus | undefined = undefined;
    if (isOverAColumn) {
      newStatus = overId as TaskStatus;
    } else if (isOverATask) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }
    if (newStatus && activeTask.status !== newStatus) {
      setTasks((prevTasks) => {
        const activeIndex = prevTasks.findIndex((t) => t.id === activeId);
        if (activeIndex !== -1) {
          prevTasks[activeIndex].status = newStatus!;
          return [...prevTasks];
        }
        return prevTasks;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isPatchingRef.current) return;
    isPatchingRef.current = true;
    setActiveTask(null);
    const { active, over } = event;
    if (!over) {
      setTasksBeforeMove(null);
      isPatchingRef.current = false;
      return;
    }
    const activeId = active.id as string;
    const overId = over.id as string;
    const position = calculateNewPosition(activeId, overId);
    if (!position) {
      setTasksBeforeMove(null);
      isPatchingRef.current = false;
      return;
    }
    // Capturar o estado ANTES das mudanças
    const before = tasksBeforeMove;

    // Aplicar mudanças
    applyPositionChange(activeId, position.newStatus, position.targetIndex);

    // Agendar movimento pendente - useEffect detectará mudança no estado tasks
    if (before) {
      setPendingMove({ before, after: [] }); // after será preenchido pelo useEffect
    }

    setTasksBeforeMove(null);
    isPatchingRef.current = false;
  };

  if (!isClient) {
    return (
      <div className="flex h-[calc(100vh-131px)] w-full items-center justify-center">
        <LoadingSpinner
          text="Carregando Kanban..."
          size="lg"
          variant="centered"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-zinc-900">
      <div
        className={`min-w-max h-full p-6 relative ${isDragBlocked ? "pointer-events-none select-none" : ""}`}
      >
        {(() => {
          if (isDragBlocked) {
            return (
              <div className="flex gap-6 items-start overflow-x-auto">
                {columns.map((column) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    tasks={getTasksByStatus(column.id)}
                    activeTask={null}
                    onCreateTask={onCreateTask}
                    onEditTask={onEditTask}
                    onViewHistory={onViewHistory}
                  />
                ))}
              </div>
            );
          } else {
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-6 items-start overflow-x-auto">
                  {columns.map((column) => (
                    <DroppableColumn
                      key={column.id}
                      column={column}
                      tasks={getTasksByStatus(column.id)}
                      activeTask={activeTask}
                      onCreateTask={onCreateTask}
                      onEditTask={onEditTask}
                      onViewHistory={onViewHistory}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask ? <TaskCard task={activeTask} /> : null}
                </DragOverlay>
              </DndContext>
            );
          }
        })()}
      </div>
    </div>
  );
}
