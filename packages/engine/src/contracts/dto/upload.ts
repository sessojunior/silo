import { z } from "zod";

export const UploadFileSchema = z.object({
  kind: z.enum(["general", "avatars", "contacts", "problems", "solutions", "help", "projects"]),
  filename: z.string().optional(),
});

export type UploadFileDto = z.infer<typeof UploadFileSchema>;

export interface UploadResultDto {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}
