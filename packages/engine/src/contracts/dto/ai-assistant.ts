import { z } from "zod";

export const AI_ASSISTANT_SCOPES = [
  "models",
  "pending",
  "reports",
  "problems",
  "solutions",
  "projects",
  "general",
] as const;

export const AiAssistantScopeSchema = z.enum(AI_ASSISTANT_SCOPES);
export type AiAssistantScope = z.infer<typeof AiAssistantScopeSchema>;

export const AiAssistantExampleSchema = z.object({
  id: z.string(),
  title: z.string(),
  prompt: z.string(),
  description: z.string(),
  scope: AiAssistantScopeSchema,
});

export type AiAssistantExampleDto = z.infer<typeof AiAssistantExampleSchema>;

export const AiAssistantExamplesResponseSchema = z.object({
  guidance: z.string(),
  scopePolicy: z.string(),
  examples: z.array(AiAssistantExampleSchema),
});

export type AiAssistantExamplesResponseDto = z.infer<
  typeof AiAssistantExamplesResponseSchema
>;

export const AiAssistantThreadSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  lastMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AiAssistantThreadSummaryDto = z.infer<
  typeof AiAssistantThreadSummarySchema
>;

export const AiAssistantThreadMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  senderType: z.enum(["user", "assistant"]),
  senderUserId: z.string().nullable(),
  senderName: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export type AiAssistantThreadMessageDto = z.infer<
  typeof AiAssistantThreadMessageSchema
>;

export const AiAssistantThreadsResponseSchema = z.object({
  threads: z.array(AiAssistantThreadSummarySchema),
});

export type AiAssistantThreadsResponseDto = z.infer<
  typeof AiAssistantThreadsResponseSchema
>;

export const AiAssistantThreadDetailResponseSchema = z.object({
  thread: AiAssistantThreadSummarySchema,
  messages: z.array(AiAssistantThreadMessageSchema),
});

export type AiAssistantThreadDetailResponseDto = z.infer<
  typeof AiAssistantThreadDetailResponseSchema
>;

export const AiAssistantCreateThreadResponseSchema = z.object({
  thread: AiAssistantThreadSummarySchema,
});

export type AiAssistantCreateThreadResponseDto = z.infer<
  typeof AiAssistantCreateThreadResponseSchema
>;

export const AiAssistantMessageRequestSchema = z.object({
  threadId: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(4000),
});

export type AiAssistantMessageRequestDto = z.infer<
  typeof AiAssistantMessageRequestSchema
>;

export const AiAssistantCitationSchema = z.object({
  label: z.string(),
  detail: z.string().optional().nullable(),
});

export type AiAssistantCitationDto = z.infer<typeof AiAssistantCitationSchema>;

export const AiAssistantMessageResponseSchema = z.object({
  threadId: z.string(),
  thread: AiAssistantThreadSummarySchema.optional(),
  messageContent: z.string().optional(),
  scope: AiAssistantScopeSchema,
  isInScope: z.boolean(),
  refusalReason: z.string().optional().nullable(),
  answer: z.string(),
  suggestedQuestions: z.array(z.string()),
  citations: z.array(AiAssistantCitationSchema),
  contextSummary: z.string(),
});

export type AiAssistantMessageResponseDto = z.infer<
  typeof AiAssistantMessageResponseSchema
>;