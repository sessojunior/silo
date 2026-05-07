import { z } from "zod";

export const TaskStatusValues = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type TaskStatus = (typeof TaskStatusValues)[number];

export const CreateTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(TaskStatusValues).optional().default("pending"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  activityId: z.string().uuid(),
  sort: z.number().int().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().omit({ activityId: true });

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;

export interface TaskDto {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  assignedUserId: string | null;
  activityId: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}
