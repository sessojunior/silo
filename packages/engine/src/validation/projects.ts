import { z } from "zod";
import { priorityEnumValues } from "./shared.js";

const projectStatusEnumValues = [
  "active",
  "completed",
  "paused",
  "cancelled",
] as const;

const projectActivityStatusEnumValues = [
  "todo",
  "progress",
  "done",
  "blocked",
] as const;

export const projectSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(2000, "Descrição deve ter no máximo 2000 caracteres"),

  status: z.enum(projectStatusEnumValues, {
    error: () => ({
      message: "Status deve ser: active, completed, paused ou cancelled",
    }),
  }),

  priority: z.enum(priorityEnumValues, {
    error: () => ({
      message: "Prioridade deve ser: low, medium, high ou urgent",
    }),
  }),

  startDate: z.date(),
  endDate: z.date().optional(),

  budget: z
    .number()
    .min(0, "Orçamento deve ser maior ou igual a zero")
    .optional(),
});

export const projectActivitySchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(2000, "Descrição deve ter no máximo 2000 caracteres"),

  status: z.enum(projectActivityStatusEnumValues, {
    error: () => ({
      message: "Status deve ser: todo, progress, done ou blocked",
    }),
  }),

  priority: z.enum(priorityEnumValues, {
    error: () => ({
      message: "Prioridade deve ser: low, medium, high ou urgent",
    }),
  }),

  estimatedDuration: z
    .number()
    .min(1, "Duração estimada deve ser pelo menos 1 hora")
    .optional(),

  assignedTo: z.array(z.string().uuid("ID de usuário inválido")).optional(),

  dueDate: z.date().optional(),
});
