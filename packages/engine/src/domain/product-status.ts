/**
 * Definições centralizadas de status de produtos
 * Este arquivo é a única fonte de verdade para status, cores e labels
 */

export type ProductStatus =
  | "completed"
  | "with_problems"
  | "run_again"
  | "not_run"
  | "under_support"
  | "suspended"
  | "in_progress"
  | "pending";

export type StatusColor =
  | "green"
  | "orange"
  | "red"
  | "gray"
  | "transparent"
  | "blue"
  | "violet"
  | "yellow"
  | "white";

export interface StatusOption {
  label: string;
  value: ProductStatus;
}

export interface StatusDefinition {
  status: ProductStatus;
  label: string;
  color: StatusColor;
  description: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { label: "Concluído", value: "completed" },
  { label: "Com problemas", value: "with_problems" },
  { label: "Rodar novamente", value: "run_again" },
  { label: "Não rodou", value: "not_run" },
  { label: "Sob intervenção", value: "under_support" },
  { label: "Suspenso", value: "suspended" },
  { label: "Em execução", value: "in_progress" },
  { label: "Pendente", value: "pending" },
];

export const STATUS_DEFINITIONS: Record<ProductStatus, StatusDefinition> = {
  completed: {
    status: "completed",
    label: "Concluído",
    color: "green",
    description: "Produto executado com sucesso.",
  },
  with_problems: {
    status: "with_problems",
    label: "Com problemas",
    color: "red",
    description: "Produto rodou com problemas.",
  },
  run_again: {
    status: "run_again",
    label: "Rodar novamente",
    color: "orange",
    description: "Produto deve ser rodado novamente.",
  },
  not_run: {
    status: "not_run",
    label: "Não rodou",
    color: "yellow",
    description: "Produto não rodou durante o turno devido a algum problema.",
  },
  under_support: {
    status: "under_support",
    label: "Sob intervenção",
    color: "violet",
    description: "Sob intervenção do suporte técnico.",
  },
  suspended: {
    status: "suspended",
    label: "Suspenso",
    color: "blue",
    description: "Rodada suspensa temporariamente.",
  },
  in_progress: {
    status: "in_progress",
    label: "Em execução",
    color: "gray",
    description: "Produto rodando normalmente no turno atual.",
  },
  pending: {
    status: "pending",
    label: "Pendente",
    color: "white",
    description:
      "Quando ainda não deu a hora de executar e terminar a execução.",
  },
};

export const DEFAULT_STATUS: ProductStatus = "pending";

export const INCIDENT_STATUS = new Set<ProductStatus>([
  "under_support",
  "suspended",
  "not_run",
  "with_problems",
  "run_again",
]);

export const getStatusColor = (status?: ProductStatus): StatusColor => {
  if (!status) return STATUS_DEFINITIONS[DEFAULT_STATUS].color;
  const definition = STATUS_DEFINITIONS[status];
  if (!definition) return STATUS_DEFINITIONS[DEFAULT_STATUS].color;
  return definition.color;
};

export const getStatusLabel = (status: ProductStatus): string => {
  return (
    STATUS_DEFINITIONS[status]?.label ||
    STATUS_DEFINITIONS[DEFAULT_STATUS].label
  );
};

export const getStatusDescription = (status: ProductStatus): string => {
  return (
    STATUS_DEFINITIONS[status]?.description ||
    STATUS_DEFINITIONS[DEFAULT_STATUS].description
  );
};

export const getStatusDefinition = (
  status: ProductStatus,
): StatusDefinition => {
  return STATUS_DEFINITIONS[status] || STATUS_DEFINITIONS[DEFAULT_STATUS];
};

export const STATUS_SEVERITY_ORDER: Record<ProductStatus, number> = {
  completed: 8,
  in_progress: 6,
  pending: 7,
  under_support: 4,
  suspended: 5,
  not_run: 3,
  with_problems: 1,
  run_again: 2,
};

export const getStatusSeverity = (status: ProductStatus): number => {
  return STATUS_SEVERITY_ORDER[status] || 5;
};

export const getStatusClasses = (
  color: StatusColor,
  variant: "timeline" | "calendar" | "stats" = "timeline",
): string => {
  switch (color) {
    case "green":
      switch (variant) {
        case "timeline":
          return "bg-green-600 text-white";
        case "calendar":
          return "bg-green-600";
        case "stats":
          return "bg-green-600";
      }
    case "orange":
      switch (variant) {
        case "timeline":
          return "bg-orange-500 text-white";
        case "calendar":
          return "bg-orange-500";
        case "stats":
          return "bg-orange-500";
      }
    case "red":
      switch (variant) {
        case "timeline":
          return "bg-red-600 text-white";
        case "calendar":
          return "bg-red-600";
        case "stats":
          return "bg-red-600";
      }
    case "gray":
      switch (variant) {
        case "timeline":
          return "bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";
        case "calendar":
          return "bg-zinc-300 dark:bg-zinc-700";
        case "stats":
          return "bg-zinc-300 dark:bg-zinc-700";
      }
    case "transparent":
      switch (variant) {
        case "timeline":
          return "bg-transparent border border-zinc-300 text-zinc-600 dark:border-zinc-700";
        case "calendar":
          return "bg-transparent border border-zinc-300 dark:border-zinc-700";
        case "stats":
          return "bg-transparent border border-zinc-300 dark:border-zinc-700";
      }
    case "blue":
      switch (variant) {
        case "timeline":
          return "bg-blue-500 text-white";
        case "calendar":
          return "bg-blue-500";
        case "stats":
          return "bg-blue-500";
      }
    case "violet":
      switch (variant) {
        case "timeline":
          return "bg-violet-500 text-white";
        case "calendar":
          return "bg-violet-500";
        case "stats":
          return "bg-violet-500";
      }
    case "yellow":
      switch (variant) {
        case "timeline":
          return "bg-yellow-500 text-white";
        case "calendar":
          return "bg-yellow-500";
        case "stats":
          return "bg-yellow-500";
      }
    case "white":
      switch (variant) {
        case "timeline":
          return "bg-white text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300";
        case "calendar":
          return "bg-white border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600";
        case "stats":
          return "bg-white border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600";
      }
    default:
      return "bg-zinc-200 dark:bg-zinc-700";
  }
};

export const getDayColorFromTurns = (turns: ProductStatus[]): StatusColor => {
  if (turns.length === 0) return "white";

  const allCompleted = turns.every((status) => status === "completed");
  if (allCompleted) return "green";

  const severities = turns.map((status) => getStatusSeverity(status));
  const maxSeverity = Math.max(...severities);

  if (maxSeverity >= 1) {
    if (turns.includes("with_problems")) return "red";
  }
  if (maxSeverity >= 2) {
    if (turns.includes("run_again")) return "orange";
  }
  if (maxSeverity >= 3) {
    if (turns.includes("not_run")) return "yellow";
  }
  if (maxSeverity >= 4) {
    if (turns.includes("under_support")) return "violet";
  }
  if (maxSeverity >= 5) {
    if (turns.includes("suspended")) return "blue";
  }
  if (maxSeverity >= 6) {
    if (turns.includes("in_progress")) return "gray";
  }
  if (maxSeverity >= 7) {
    if (turns.includes("pending")) return "white";
  }
  return "green";
};
