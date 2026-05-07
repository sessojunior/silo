import { z } from "zod";

export const CreateContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  team: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const UpdateContactSchema = CreateContactSchema.partial().extend({
  removeImage: z.boolean().optional(),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;

export interface ContactDto {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
  phone: string | null;
  image: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
