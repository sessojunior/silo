"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { useParams, useSearchParams } from "next/navigation";

import Dialog from "@/components/ui/Dialog";
import { ProductStatus, getStatusLabel } from "@/lib/productStatus";
import groupedPipelineDataJson from "./pipeline-data.json";

type NodeType = "task" | "product";

interface GroupedTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string[];
  status: ProductStatus;
  type: NodeType;
}

interface TaskGroup {
  id: string;
  name: string;
  tasks: GroupedTask[];
}

interface GroupedPipelineData {
  model: string;
  date: string;
  turn: string;
  status: ProductStatus;
  groups: TaskGroup[];
}

interface GroupedPipelineDataFile {
  pipelines: GroupedPipelineData[];
}

interface DetailNode {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  status: ProductStatus;
  dependencies: string[];
  type: NodeType | "group";
  groupId?: string;
}

interface TaskListHeaderProps {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}

interface TaskListTableProps {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}

const STATUS_COLOR: Record<ProductStatus, string> = {
  pending: "#9ca3af",
  in_progress: "#2563eb",
  completed: "#16a34a",
  with_problems: "#dc2626",
  run_again: "#ea580c",
  not_run: "#4b5563",
  under_support: "#7c3aed",
  suspended: "#111827",
};

const STATUS_BAR_STYLE: Record<
  ProductStatus,
  {
    track: string;
    fill: string;
    selectedTrack: string;
    selectedFill: string;
  }
> = {
  pending: {
    track: "#e5e7eb",
    fill: "#9ca3af",
    selectedTrack: "#d1d5db",
    selectedFill: "#6b7280",
  },
  in_progress: {
    track: "#bfdbfe",
    fill: "#2563eb",
    selectedTrack: "#93c5fd",
    selectedFill: "#1d4ed8",
  },
  completed: {
    track: "#bbf7d0",
    fill: "#16a34a",
    selectedTrack: "#86efac",
    selectedFill: "#15803d",
  },
  with_problems: {
    track: "#fecaca",
    fill: "#dc2626",
    selectedTrack: "#fca5a5",
    selectedFill: "#b91c1c",
  },
  run_again: {
    track: "#fed7aa",
    fill: "#ea580c",
    selectedTrack: "#fdba74",
    selectedFill: "#c2410c",
  },
  not_run: {
    track: "#d1d5db",
    fill: "#4b5563",
    selectedTrack: "#9ca3af",
    selectedFill: "#374151",
  },
  under_support: {
    track: "#ddd6fe",
    fill: "#7c3aed",
    selectedTrack: "#c4b5fd",
    selectedFill: "#6d28d9",
  },
  suspended: {
    track: "#9ca3af",
    fill: "#111827",
    selectedTrack: "#6b7280",
    selectedFill: "#030712",
  },
};

const GROUPED_PIPELINE_DATA = groupedPipelineDataJson as GroupedPipelineDataFile;

const DATE_TIME_BRIEF_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const TASK_LIST_WIDTH = {
  name: 340,
  from: 110,
  to: 110,
};

const TASK_LIST_TOTAL_WIDTH =
  TASK_LIST_WIDTH.name + TASK_LIST_WIDTH.from + TASK_LIST_WIDTH.to;

const LIST_CELL_WIDTH = `${Math.ceil(TASK_LIST_TOTAL_WIDTH / 3)}px`;
const MIN_GANTT_HEIGHT = 220;
const GANTT_HEADER_HEIGHT = 50;
const GANTT_HORIZONTAL_SCROLLBAR_SPACE = 20;
const GANTT_BOTTOM_SAFETY_SPACE = 4;

function formatDateTimeBrief(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return DATE_TIME_BRIEF_FORMATTER.format(date).replace(",", "");
}

function TaskListHeaderPtBr({
  headerHeight,
  fontFamily,
  fontSize,
}: TaskListHeaderProps) {
  return (
    <div
      className="data-flow-tasklist-header border-b border-zinc-200 dark:border-zinc-700"
      style={{
        fontFamily,
        fontSize,
        height: headerHeight,
        minWidth: TASK_LIST_TOTAL_WIDTH,
      }}
    >
      <div style={{ width: TASK_LIST_WIDTH.name, textAlign: "center" }}>Nome</div>
      <div style={{ width: TASK_LIST_WIDTH.from, textAlign: "center" }}>Inicio</div>
      <div style={{ width: TASK_LIST_WIDTH.to, textAlign: "center" }}>Fim</div>
    </div>
  );
}

function TaskListTablePtBr({
  rowHeight,
  tasks,
  fontFamily,
  fontSize,
  selectedTaskId,
  setSelectedTask,
  onExpanderClick,
}: TaskListTableProps) {
  return (
    <div style={{ fontFamily, fontSize, minWidth: TASK_LIST_TOTAL_WIDTH }}>
      {tasks.map((task) => {
        const expanderIconClass =
          task.hideChildren === false
            ? "icon-[lucide--chevron-down]"
            : task.hideChildren === true
              ? "icon-[lucide--chevron-right]"
              : "";
        const isGroup = typeof task.hideChildren === "boolean";
        const isSelected = selectedTaskId === task.id;

        return (
          <div
            key={`${task.id}-row`}
            className="data-flow-tasklist-row border-b border-zinc-100 dark:border-zinc-800"
            style={{
              height: rowHeight,
              minWidth: TASK_LIST_TOTAL_WIDTH,
              backgroundColor: isSelected ? "rgb(241 245 249 / 0.8)" : "transparent",
            }}
          >
            <button
              type="button"
              className="data-flow-tasklist-cell data-flow-tasklist-name"
              style={{ width: TASK_LIST_WIDTH.name }}
              onClick={() => {
                if (isGroup) {
                  onExpanderClick(task);
                }
                setSelectedTask(task.id);
              }}
              title={task.name}
            >
              {expanderIconClass ? (
                <span
                  className="data-flow-tasklist-expander"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExpanderClick(task);
                  }}
                >
                  <span className={`${expanderIconClass} size-4`} aria-hidden="true" />
                </span>
              ) : (
                <span className="data-flow-tasklist-expander-empty" />
              )}
              <span className={isGroup ? "font-semibold" : ""}>{task.name}</span>
            </button>

            <button
              type="button"
              className="data-flow-tasklist-cell"
              style={{ width: TASK_LIST_WIDTH.from, justifyContent: "center", textAlign: "center" }}
              onClick={() => setSelectedTask(task.id)}
              title={formatDateTimeBrief(task.start)}
            >
              {formatDateTimeBrief(task.start)}
            </button>

            <button
              type="button"
              className="data-flow-tasklist-cell"
              style={{ width: TASK_LIST_WIDTH.to, justifyContent: "center", textAlign: "center" }}
              onClick={() => setSelectedTask(task.id)}
              title={formatDateTimeBrief(task.end)}
            >
              {formatDateTimeBrief(task.end)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatDateTimeBR(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGroupStatus(tasks: GroupedTask[]): ProductStatus {
  const statuses = tasks.map((task) => task.status);

  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("with_problems")) return "with_problems";
  if (statuses.includes("under_support")) return "under_support";
  if (statuses.includes("run_again")) return "run_again";
  if (statuses.includes("not_run")) return "not_run";
  if (statuses.includes("suspended")) return "suspended";
  if (statuses.every((status) => status === "completed")) return "completed";
  return "pending";
}

export default function ProductDataFlowPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const modelSlug = String(params?.slug ?? "").trim();
  const selectedDate = searchParams.get("date");
  const selectedTurn = searchParams.get("turn");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const ganttShellRef = useRef<HTMLDivElement | null>(null);
  const [ganttHeight, setGanttHeight] = useState(300);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const modelSnapshots = useMemo(() => {
    const exactMatch = GROUPED_PIPELINE_DATA.pipelines.filter(
      (snapshot) => snapshot.model === modelSlug,
    );

    if (exactMatch.length > 0) return exactMatch;

    // Keep fake data usable for any product slug while preserving model/date/turn shape.
    return GROUPED_PIPELINE_DATA.pipelines.map((snapshot) => ({
      ...snapshot,
      model: modelSlug || snapshot.model,
    }));
  }, [modelSlug]);

  const activeSnapshot = useMemo(() => {
    if (modelSnapshots.length === 0) return null;

    if (selectedDate && selectedTurn) {
      const exact = modelSnapshots.find(
        (snapshot) => snapshot.date === selectedDate && snapshot.turn === selectedTurn,
      );
      if (exact) return exact;
    }

    const sorted = [...modelSnapshots].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return Number(b.turn) - Number(a.turn);
    });

    return sorted[0] ?? null;
  }, [modelSnapshots, selectedDate, selectedTurn]);

  const groups = useMemo(() => activeSnapshot?.groups ?? [], [activeSnapshot]);

  useEffect(() => {
    setCollapsedGroups((previous) => {
      const next: Record<string, boolean> = {};
      for (const group of groups) {
        next[group.id] = previous[group.id] ?? false;
      }
      return next;
    });
  }, [groups]);

  const detailById = useMemo(() => {
    const map = new Map<string, DetailNode>();

    for (const group of groups) {
      const starts = group.tasks.map((task) => new Date(task.start).getTime());
      const ends = group.tasks.map((task) => new Date(task.end).getTime());
      const groupStatus = getGroupStatus(group.tasks);
      const groupProgress = Math.round(
        group.tasks.reduce((acc, task) => acc + task.progress, 0) /
          group.tasks.length,
      );

      map.set(group.id, {
        id: group.id,
        name: group.name,
        start: new Date(Math.min(...starts)).toISOString(),
        end: new Date(Math.max(...ends)).toISOString(),
        progress: groupProgress,
        status: groupStatus,
        dependencies: [],
        type: "group",
      });

      for (const task of group.tasks) {
        map.set(task.id, {
          ...task,
          groupId: group.id,
        });
      }
    }

    return map;
  }, [groups]);

  const ganttTasks = useMemo<Task[]>(() => {
    const tasks: Task[] = [];

    for (const group of groups) {
      const starts = group.tasks.map((task) => new Date(task.start).getTime());
      const ends = group.tasks.map((task) => new Date(task.end).getTime());
      const groupStatus = getGroupStatus(group.tasks);
      const groupProgress = Math.round(
        group.tasks.reduce((acc, task) => acc + task.progress, 0) /
          group.tasks.length,
      );

      tasks.push({
        id: group.id,
        name: `${group.name} (${groupProgress}%)`,
        start: new Date(Math.min(...starts)),
        end: new Date(Math.max(...ends)),
        progress: groupProgress,
        type: "project",
        hideChildren: collapsedGroups[group.id] ?? false,
        styles: {
          backgroundColor: STATUS_BAR_STYLE[groupStatus].track,
          backgroundSelectedColor: STATUS_BAR_STYLE[groupStatus].selectedTrack,
          progressColor: STATUS_BAR_STYLE[groupStatus].fill,
          progressSelectedColor: STATUS_BAR_STYLE[groupStatus].selectedFill,
        },
      });

      for (const task of group.tasks) {
        const inProgressLabel = task.status === "in_progress" ? " em andamento" : "";
        tasks.push({
          id: task.id,
          name: `${task.name} (${task.progress}%${inProgressLabel})`,
          start: new Date(task.start),
          end: new Date(task.end),
          progress: task.progress,
          dependencies: task.dependencies,
          type: "task",
          project: group.id,
          styles: {
            backgroundColor: STATUS_BAR_STYLE[task.status].track,
            backgroundSelectedColor: STATUS_BAR_STYLE[task.status].selectedTrack,
            progressColor: STATUS_BAR_STYLE[task.status].fill,
            progressSelectedColor: STATUS_BAR_STYLE[task.status].selectedFill,
          },
        });
      }
    }

    return tasks;
  }, [collapsedGroups, groups]);

  const blockedTaskIds = useMemo(() => {
    const failing = new Set<string>();
    const blocked = new Set<string>();

    for (const group of groups) {
      for (const task of group.tasks) {
        if (
          ["with_problems", "run_again", "not_run", "under_support", "suspended"].includes(
            task.status,
          )
        ) {
          failing.add(task.id);
        }
      }
    }

    for (const group of groups) {
      for (const task of group.tasks) {
        if (task.dependencies.some((dep) => failing.has(dep))) {
          blocked.add(task.id);
        }
      }
    }

    return blocked;
  }, [groups]);

  const selectedTask = selectedTaskId ? detailById.get(selectedTaskId) : null;

  useEffect(() => {
    const shell = ganttShellRef.current;
    if (!shell) return;

    const toHourMinute = (raw: string): string => {
      const value = raw.trim();

      if (/^\d{1,2}:\d{2}$/.test(value)) {
        const [hour, minute] = value.split(":");
        return `${hour.padStart(2, "0")}:${minute}`;
      }

      if (/^\d{1,2}$/.test(value)) {
        return `${value.padStart(2, "0")}:00`;
      }

      const amPmMatch = value.match(/^(\d{1,2})\s*(AM|PM)$/i);
      if (amPmMatch) {
        const hour = Number(amPmMatch[1]);
        const period = amPmMatch[2].toUpperCase();
        const normalizedHour =
          period === "PM" ? (hour % 12) + 12 : hour === 12 ? 0 : hour;
        return `${String(normalizedHour).padStart(2, "0")}:00`;
      }

      return value;
    };

    const normalizeSlotLabels = () => {
      const labels = shell.querySelectorAll<SVGTextElement>('text[class*="_9w8d5"]');
      labels.forEach((label) => {
        const current = label.textContent ?? "";
        const next = toHourMinute(current);
        if (next !== current) {
          label.textContent = next;
        }
      });
    };

    normalizeSlotLabels();

    const observer = new MutationObserver(() => {
      normalizeSlotLabels();
    });

    observer.observe(shell, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [ganttTasks]);

  useEffect(() => {
    const root = pageRootRef.current;
    if (!root) return;

    const updateHeightFromContainer = () => {
      const shellHeight = root.clientHeight;
      const available =
        shellHeight - GANTT_HEADER_HEIGHT - GANTT_HORIZONTAL_SCROLLBAR_SPACE - GANTT_BOTTOM_SAFETY_SPACE;
      const nextHeight = Math.max(MIN_GANTT_HEIGHT, Math.floor(available));
      setGanttHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateHeightFromContainer();

    const observer = new ResizeObserver(() => {
      updateHeightFromContainer();
    });

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = pageRootRef.current;
    if (!root) return;

    // Keep the route-level shell fixed; scrolling should happen inside gantt internals.
    let scrollHost: HTMLElement | null = root.parentElement;
    while (scrollHost) {
      const { overflowY } = window.getComputedStyle(scrollHost);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollHost = scrollHost.parentElement;
    }

    if (!scrollHost) return;

    const previousOverflowY = scrollHost.style.overflowY;
    const previousOverscrollBehavior = scrollHost.style.overscrollBehavior;

    scrollHost.style.overflowY = "hidden";
    scrollHost.style.overscrollBehavior = "contain";

    return () => {
      scrollHost.style.overflowY = previousOverflowY;
      scrollHost.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  if (!activeSnapshot) {
    return (
      <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        Nenhum fluxo fake encontrado para este modelo.
      </div>
    );
  }

  return (
    <div
      ref={pageRootRef}
      className="flex h-[calc(100dvh-140px)] w-full min-h-0 flex-col overflow-hidden"
    >
      <div
        ref={ganttShellRef}
        className="data-flow-gantt-shell w-full h-full flex-1 min-h-0 overflow-hidden dark:bg-zinc-800"
      >
        <Gantt
          tasks={ganttTasks}
          viewMode={ViewMode.Hour}
          locale="pt-BR"
          TaskListHeader={TaskListHeaderPtBr}
          TaskListTable={TaskListTablePtBr}
          listCellWidth={LIST_CELL_WIDTH}
          columnWidth={140}
          rowHeight={44}
          ganttHeight={ganttHeight}
          barFill={80}
          barCornerRadius={4}
          fontSize="1rem"
          TooltipContent={() => null}
          preStepsCount={1}
          onClick={(task) => setSelectedTaskId(task.id)}
          onExpanderClick={(task) => {
            if (task.type !== "project") return;
            setCollapsedGroups((prev) => ({
              ...prev,
              [task.id]: !prev[task.id],
            }));
          }}
        />
      </div>

      <Dialog
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        title={selectedTask?.name}
        size="md"
      >
        {selectedTask && (
          <div className="space-y-3 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">ID</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{selectedTask.id}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Tipo</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedTask.type === "group"
                    ? "Grupo"
                    : selectedTask.type === "product"
                      ? "Produto"
                      : "Task"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Status</p>
                <p
                  className="font-medium"
                  style={{ color: STATUS_COLOR[selectedTask.status] }}
                >
                  {getStatusLabel(selectedTask.status)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Progresso</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedTask.progress}%
                  {selectedTask.status === "in_progress" ? " (em andamento)" : ""}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Inicio</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateTimeBR(selectedTask.start)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Fim</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateTimeBR(selectedTask.end)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Dependencias</p>
              {selectedTask.dependencies.length > 0 ? (
                <ul className="mt-2 space-y-1 text-zinc-900 dark:text-zinc-100">
                  {selectedTask.dependencies.map((depId) => {
                    const depTask = detailById.get(depId);
                    return (
                      <li
                        key={depId}
                        className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                      >
                        {depTask ? `${depTask.name} (${depId})` : depId}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">Sem dependencias.</p>
              )}
            </div>

            {selectedTask.type !== "group" && (
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Estado de bloqueio</p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {blockedTaskIds.has(selectedTask.id)
                    ? "Bloqueada por dependencia com falha"
                    : "Sem bloqueio por dependencia"}
                </p>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <style jsx global>{`
        .data-flow-gantt-shell,
        .data-flow-gantt-shell div,
        .data-flow-gantt-shell button,
        .data-flow-gantt-shell span {
          font-size: 1rem !important;
          color: rgb(82 82 91) !important;
        }

        .dark .data-flow-gantt-shell,
        .dark .data-flow-gantt-shell div,
        .dark .data-flow-gantt-shell button,
        .dark .data-flow-gantt-shell span {
          color: rgb(228 228 231) !important;
        }

        .data-flow-gantt-shell text {
          font-size: 1rem !important;
          fill: rgb(82 82 91) !important;
        }

        .dark .data-flow-gantt-shell text {
          fill: rgb(228 228 231) !important;
        }

        .data-flow-tasklist-header,
        .data-flow-tasklist-row {
          display: flex;
          align-items: center;
          color: rgb(82 82 91);
        }

        .dark .data-flow-tasklist-header,
        .dark .data-flow-tasklist-row {
          color: rgb(228 228 231);
        }

        .data-flow-tasklist-header {
          font-weight: 600;
          font-size: 1rem;
          white-space: nowrap;
        }

        .data-flow-tasklist-cell {
          display: inline-flex;
          align-items: center;
          min-width: 0;
          padding: 0 6px;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 0;
          background: transparent;
          text-align: left;
          color: inherit;
          height: 100%;
        }

        .data-flow-tasklist-name {
          gap: 4px;
        }

        .data-flow-tasklist-expander,
        .data-flow-tasklist-expander-empty {
          width: 12px;
          flex: 0 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .data-flow-tasklist-expander {
          font-size: 1rem;
        }

        .data-flow-gantt-shell g[class*="_KxSXS"],
        .data-flow-gantt-shell g[class*="_1KJ6x"],
        .data-flow-gantt-shell g[class*="_RRr13"] {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 0.15s ease;
        }

        .data-flow-gantt-shell g[class*="_KxSXS"] > g:first-child rect,
        .data-flow-gantt-shell g[class*="_1KJ6x"] rect,
        .data-flow-gantt-shell g[class*="_RRr13"] rect {
          transition: opacity 0.15s ease;
        }

        .data-flow-gantt-shell g[class*="_KxSXS"]:hover,
        .data-flow-gantt-shell g[class*="_1KJ6x"]:hover,
        .data-flow-gantt-shell g[class*="_RRr13"]:hover {
          transform: scale(1.02);
        }

        .data-flow-gantt-shell g[class*="_KxSXS"]:hover > g:first-child rect,
        .data-flow-gantt-shell g[class*="_1KJ6x"]:hover rect,
        .data-flow-gantt-shell g[class*="_RRr13"]:hover rect {
          opacity: 0.82 !important;
        }

        .data-flow-gantt-shell rect[class*="_2pZMF"],
        .data-flow-gantt-shell polygon[class*="_2pZMF"] {
          display: none !important;
        }

        .data-flow-gantt-shell * {
          scrollbar-width: auto;
          scrollbar-color: #d4d4d8 #f4f4f5;
        }

        .dark .data-flow-gantt-shell * {
          scrollbar-color: #71717a #3f3f46;
        }

        .data-flow-gantt-shell *::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }

        .data-flow-gantt-shell *::-webkit-scrollbar-thumb {
          background: #d4d4d8;
          border-radius: 999px;
        }

        .dark .data-flow-gantt-shell *::-webkit-scrollbar-thumb {
          background: #71717a;
        }

        .data-flow-gantt-shell *::-webkit-scrollbar-track {
          background: #f4f4f5;
          border-radius: 999px;
        }

        .dark .data-flow-gantt-shell *::-webkit-scrollbar-track {
          background: #3f3f46;
        }

        .data-flow-gantt-shell *::-webkit-scrollbar-thumb:hover {
          background: #a1a1aa;
        }

        .dark .data-flow-gantt-shell *::-webkit-scrollbar-thumb:hover {
          background: #a1a1aa;
        }
      `}</style>
    </div>
  );
}
