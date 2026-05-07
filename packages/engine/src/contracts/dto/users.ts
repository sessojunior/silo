import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional().default(true),
  groupId: z.string().uuid().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  groupId: z.string().uuid().optional().nullable(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export interface UserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}
