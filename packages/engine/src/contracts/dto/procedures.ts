import { z } from "zod";

export const ProcedureAttachmentStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "error",
]);

export const ProcedureAttachmentKindSchema = z.enum(["image", "document"]);

export type ProcedureAttachmentStatus = z.infer<typeof ProcedureAttachmentStatusSchema>;
export type ProcedureAttachmentKind = z.infer<typeof ProcedureAttachmentKindSchema>;

export interface GeneralProcedureAttachmentDto {
  id: string;
  procedureId: string;
  kind: ProcedureAttachmentKind;
  originalName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  extractionStatus: ProcedureAttachmentStatus;
  extractionError: string | null;
  imageDescription: string | null;
}

export interface GeneralProcedureDto {
  id: string;
  title: string;
  category: string | null;
  content: string;
  active: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  attachments: GeneralProcedureAttachmentDto[];
}
