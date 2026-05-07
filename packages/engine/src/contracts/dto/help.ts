import { z } from "zod";

export const UpdateHelpSchema = z.object({
  description: z.string(),
});

export type UpdateHelpDto = z.infer<typeof UpdateHelpSchema>;

export interface HelpDto {
  id: string;
  description: string | null;
  updatedAt: string;
}
