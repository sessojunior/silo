import { z } from "zod";

export const CreateIncidentSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const UpdateIncidentSchema = CreateIncidentSchema.partial().extend({
  sortOrder: z.number().int().optional(),
});

export type CreateIncidentDto = z.infer<typeof CreateIncidentSchema>;
export type UpdateIncidentDto = z.infer<typeof UpdateIncidentSchema>;

export interface IncidentDto {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
