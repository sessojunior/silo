import { z } from "zod";

export const SendMessageSchema = z.object({
  content: z.string().min(1),
  receiverGroupId: z.string().uuid().optional().nullable(),
  receiverUserId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => data.receiverGroupId != null || data.receiverUserId != null,
  { message: "Must specify receiverGroupId or receiverUserId" },
);

export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export interface ChatMessageDto {
  id: string;
  content: string;
  senderUserId: string;
  senderName: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
  createdAt: string;
  readAt: string | null;
  messageType: "text" | "image" | "file";
}
