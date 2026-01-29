import { z } from "zod";

// === SCHEMAS DE VALIDAÇÃO COM ZOD ===

const priorityEnumValues = ["low", "medium", "high", "urgent"] as const;
const productPriorityEnumValues = ["low", "normal", "high", "urgent"] as const;
const productTurnEnumValues = ["0", "6", "12", "18"] as const;
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
const problemStatusEnumValues = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

// Schema para usuários
export const userSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),

  email: z
    .string()
    .email("Email inválido")
    .endsWith("@inpe.br", "Apenas e-mails do domínio @inpe.br são permitidos"),

  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número",
    ),

  groups: z
    .array(z.string().uuid("ID de grupo inválido"))
    .min(1, "Usuário deve pertencer a pelo menos um grupo"),
});

// Schema para problemas
export const problemSchema = z.object({
  title: z
    .string()
    .min(5, "Título deve ter pelo menos 5 caracteres")
    .max(120, "Título deve ter no máximo 120 caracteres"),

  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(5000, "Descrição deve ter no máximo 5000 caracteres"),

  categoryId: z.string().uuid("ID de categoria inválido"),

  priority: z.enum(priorityEnumValues, {
    error: () => ({
      message: "Prioridade deve ser: low, medium, high ou urgent",
    }),
  }),

  status: z.enum(problemStatusEnumValues, {
    error: () => ({
      message: "Status deve ser: open, in_progress, resolved ou closed",
    }),
  }),
});

// Schema para soluções
export const solutionSchema = z.object({
  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(5000, "Descrição deve ter no máximo 5000 caracteres"),

  verified: z.boolean().optional().default(false),

  images: z
    .array(
      z.object({
        image: z.string().url("URL da imagem inválida"),
        description: z
          .string()
          .max(500, "Descrição da imagem deve ter no máximo 500 caracteres"),
      }),
    )
    .optional()
    .default([]),
});

// Schema para produtos
const productBaseSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  description: z
    .string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .nullable()
    .optional(),

  slug: z
    .string()
    .min(3, "Slug deve ter pelo menos 3 caracteres")
    .max(50, "Slug deve ter no máximo 50 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    )
    .optional(),

  available: z.boolean().optional().default(true),

  priority: z
    .enum(productPriorityEnumValues, {
      error: () => ({
        message: "Prioridade deve ser: low, normal, high ou urgent",
      }),
    })
    .optional()
    .default("normal"),

  turns: z
    .array(z.enum(productTurnEnumValues))
    .min(1, "Deve selecionar ao menos um turno")
    .default(["0", "6", "12", "18"]),
});

export const productSchema = productBaseSchema;
export const productCreateSchema = productBaseSchema;
export const productUpdateSchema = productBaseSchema.extend({
  id: z.string().min(1, "ID do produto é obrigatório"),
});

// Schema para grupos
export const groupSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),

  description: z
    .string()
    .max(200, "Descrição deve ter no máximo 200 caracteres")
    .optional(),

  color: z
    .string()
    .regex(
      /^#[0-9A-Fa-f]{6}$/,
      "Cor deve estar no formato hexadecimal (#RRGGBB)",
    )
    .optional(),

  isDefault: z.boolean().optional().default(false),
});

// Schema para projetos
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
      message:
        "Status deve ser: active, completed, paused ou cancelled",
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

// Schema para atividades de projeto
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

// Schema para contatos
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  email: z.string().email("Email inválido").optional(),

  phone: z
    .string()
    .regex(
      /^[\d\s\(\)\-\+]+$/,
      "Telefone deve conter apenas números, espaços, parênteses, hífens e +",
    )
    .optional(),

  role: z
    .string()
    .min(2, "Cargo deve ter pelo menos 2 caracteres")
    .max(50, "Cargo deve ter no máximo 50 caracteres"),

  department: z
    .string()
    .max(50, "Departamento deve ter no máximo 50 caracteres")
    .optional(),

  notes: z
    .string()
    .max(500, "Observações devem ter no máximo 500 caracteres")
    .optional(),
});

// Schema para filtros de data
export const dateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data final deve ser maior ou igual à data inicial",
    path: ["endDate"],
  });

// Schema para paginação
export const paginationSchema = z.object({
  page: z.number().min(1, "Página deve ser maior que 0").default(1),

  limit: z
    .number()
    .min(1, "Limite deve ser maior que 0")
    .max(100, "Limite máximo é 100")
    .default(20),

  search: z
    .string()
    .max(100, "Termo de busca deve ter no máximo 100 caracteres")
    .optional(),

  sortBy: z
    .string()
    .max(50, "Campo de ordenação deve ter no máximo 50 caracteres")
    .optional(),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// === FUNÇÕES DE VALIDAÇÃO ===

export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { success: false, errors: ["Erro de validação desconhecido"] };
  }
}

// Função para validar dados de formulário com mensagens específicas
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
):
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        const field = issue.path.join(".");
        fieldErrors[field] = issue.message;
      });
      return { success: false, fieldErrors };
    }
    return {
      success: false,
      fieldErrors: { general: "Erro de validação desconhecido" },
    };
  }
}

// Função para validar dados de API
export function validateApiData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
):
  | { success: true; data: T }
  | { success: false; error: string; field?: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false,
        error: firstError.message,
        field: firstError.path.join("."),
      };
    }
    return { success: false, error: "Erro de validação desconhecido" };
  }
}

// === TIPOS EXPORTADOS ===

export type UserInput = z.infer<typeof userSchema>;
export type ProblemInput = z.infer<typeof problemSchema>;
export type SolutionInput = z.infer<typeof solutionSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectActivityInput = z.infer<typeof projectActivitySchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
