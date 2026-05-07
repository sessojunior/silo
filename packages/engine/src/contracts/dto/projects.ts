import { z } from "zod";

export const ProjectPriorityValues = ["low", "medium", "high", "urgent"] as const;
export const ProjectStatusValues = ["active", "completed", "paused", "cancelled"] as const;

export type ProjectPriority = (typeof ProjectPriorityValues)[number];
export type ProjectStatus = (typeof ProjectStatusValues)[number];

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  priority: z.enum(ProjectPriorityValues).optional().default("medium"),
  status: z.enum(ProjectStatusValues).optional().default("active"),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

export interface ProjectDto {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: ProjectPriority;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export const CreateActivitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.string().optional(),
  projectId: z.string().uuid(),
});

export const UpdateActivitySchema = CreateActivitySchema.partial().omit({ projectId: true });

export type CreateActivityDto = z.infer<typeof CreateActivitySchema>;
export type UpdateActivityDto = z.infer<typeof UpdateActivitySchema>;

export interface ProjectActivityDto {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  estimatedDays: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  status: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskDto {
  id: string;
  name: string;
  description: string;
  category: string | null;
  estimatedDays: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  status: string;
  sort: number;
  projectId: string;
  projectActivityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskUserDto {
  id: string;
  taskId: string;
  userId: string;
}

export interface ProjectTaskHistoryDto {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  fromSort: number | null;
  toSort: number | null;
  details: unknown;
  createdAt: string;
}
