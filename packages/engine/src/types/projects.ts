// === TIPOS CENTRALIZADOS PARA PROJETOS - SILO ===
// Contratos de domínio desacoplados do schema de persistência.

// === TIPOS BASE ===

export interface Project {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "active" | "completed" | "paused" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: string | null;
  estimatedDays: number | null;
  startDate: Date | null;
  endDate: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "progress" | "done" | "blocked";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTask {
  id: string;
  activityId: string;
  name: string;
  description: string;
  category: string | null;
  estimatedDays: number | null;
  startDate: Date | null;
  endDate: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "blocked" | "review" | "done";
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTaskUser {
  id: string;
  taskId: string;
  userId: string;
  createdAt: Date;
}

export interface ProjectTaskHistory {
  id: string;
  taskId: string;
  userId: string;
  action: "status_change" | "created" | "updated" | "deleted";
  fromStatus: string | null;
  toStatus: string;
  fromSort: number | null;
  toSort: number | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

// === TIPOS ESTENDIDOS (Para Uso em Componentes) ===

// Project com atividades populadas
export interface ProjectWithActivities extends Project {
  activities?: ProjectActivity[];
}

// Activity com tarefas populadas
export interface ActivityWithTasks extends ProjectActivity {
  tasks?: ProjectTask[];
}

// Task com usuários atribuídos populados
export interface TaskWithUsers extends ProjectTask {
  assignedUsers?: string[];
  assignedUsersDetails?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    isActive: boolean;
  }[];
}

// Task com histórico populado
export interface TaskWithHistory extends ProjectTask {
  history?: ProjectTaskHistory[];
}

// === TIPOS PARA FORMULÁRIOS ===

// Dados para criação/edição de projetos
export interface ProjectFormData {
  name: string;
  shortDescription: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "active" | "completed" | "paused" | "cancelled";
}

// Dados para criação/edição de atividades
export interface ActivityFormData {
  name: string;
  description: string;
  category: string | null;
  estimatedDays: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "progress" | "done" | "blocked";
}

// Dados para criação/edição de tarefas
export interface TaskFormData {
  name: string;
  description: string;
  category: string | null;
  estimatedDays: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "blocked" | "review" | "done";
  sort: number;
  assignedUsers: string[];
}

// === TIPOS PARA ESTATÍSTICAS ===

// Estatísticas de projetos
export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  cancelled: number;
  avgProgress: number;
}

// Estatísticas de atividades
export interface ActivityStats {
  total: number;
  todo: number;
  progress: number;
  done: number;
  blocked: number;
  avgEstimatedDays: number;
}

// Estatísticas de tarefas
export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  blocked: number;
  review: number;
  done: number;
  avgEstimatedDays: number;
}

// === TIPOS PARA FILTROS ===

export type ProjectStatusFilter =
  | "all"
  | "active"
  | "completed"
  | "paused"
  | "cancelled";
export type ProjectPriorityFilter =
  | "all"
  | "low"
  | "medium"
  | "high"
  | "urgent";
export type ActivityStatusFilter =
  | "all"
  | "todo"
  | "progress"
  | "done"
  | "blocked";
export type TaskStatusFilter =
  | "all"
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";

// === TIPOS PARA KANBAN ===

// Coluna do Kanban
export interface KanbanColumn {
  id: TaskStatusFilter;
  title: string;
  tasks: TaskWithUsers[];
}

// Dados para drag & drop
export interface DragData {
  taskId: string;
  fromStatus: TaskStatusFilter;
  toStatus: TaskStatusFilter;
  fromSort: number;
  toSort: number;
}

// === TIPOS PARA RELATÓRIOS ===

// Relatório de progresso de projeto
export interface ProjectProgressReport {
  projectId: string;
  projectName: string;
  totalActivities: number;
  completedActivities: number;
  totalTasks: number;
  completedTasks: number;
  overallProgress: number;
  estimatedCompletion: string | null;
}

// === TIPOS PARA NOTIFICAÇÕES ===

// Notificação de projeto
export interface ProjectNotification {
  id: string;
  type:
    | "project_created"
    | "project_updated"
    | "project_completed"
    | "activity_created"
    | "task_assigned"
    | "task_completed";
  projectId: string;
  projectName: string;
  message: string;
  userId: string;
  read: boolean;
  createdAt: Date;
}

// === TIPOS PARA VALIDAÇÃO ===

// Resultado de validação
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
