import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});

export const UpdateGroupSchema = CreateGroupSchema.partial();

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupDto = z.infer<typeof UpdateGroupSchema>;

export interface GroupDto {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  role: string;
  active: boolean;
  isDefault: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}
