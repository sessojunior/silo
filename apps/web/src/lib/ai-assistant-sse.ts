import {
  AI_ASSISTANT_SCOPES,
  type AiAssistantMessageResponseDto,
  type AiAssistantScope,
} from "@silo/engine/contracts/dto/ai-assistant";

const ASSISTANT_SCOPE_SET = new Set<string>(AI_ASSISTANT_SCOPES);

export type AssistantSseAction =
  | { type: "ignore" }
  | { type: "thinking"; content: string }
  | { type: "result"; data: AiAssistantMessageResponseDto }
  | { type: "legacy-data"; data: Partial<AiAssistantMessageResponseDto> }
  | { type: "legacy-complete" }
  | { type: "error"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const readScope = (value: unknown): AiAssistantScope => {
  const candidate = readString(value);
  return candidate && ASSISTANT_SCOPE_SET.has(candidate)
    ? (candidate as AiAssistantScope)
    : "general";
};

const readCitations = (
  value: unknown,
): AiAssistantMessageResponseDto["citations"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.label !== "string") {
      return [];
    }

    return [
      {
        label: entry.label,
        detail:
          typeof entry.detail === "string" || entry.detail === null
            ? entry.detail
            : undefined,
      },
    ];
  });
};

export const parseAssistantSseEvent = (
  eventName: string,
  payload: Record<string, unknown>,
): AssistantSseAction => {
  switch (eventName) {
    case "":
    case "connected":
    case "scope":
      return { type: "ignore" };
    case "thinking":
      return { type: "thinking", content: readString(payload.content) ?? "" };
    case "result":
      return {
        type: "result",
        data: payload as unknown as AiAssistantMessageResponseDto,
      };
    case "data":
      return {
        type: "legacy-data",
        data: payload as Partial<AiAssistantMessageResponseDto>,
      };
    case "complete":
      return { type: "legacy-complete" };
    case "error":
      return {
        type: "error",
        message: readString(payload.content) ?? "Erro ao gerar resposta.",
      };
    default:
      return { type: "ignore" };
  }
};

export const buildLegacyAssistantSseResult = (
  legacyData: Partial<AiAssistantMessageResponseDto> | null,
  threadId: string,
  currentThinking: string,
): AiAssistantMessageResponseDto | null => {
  if (!legacyData) {
    return null;
  }

  const answer =
    readString(legacyData.answer) ?? readString(legacyData.messageContent);

  if (!answer) {
    return null;
  }

  const thinking =
    readString(legacyData.thinking) ?? readString(currentThinking) ?? undefined;

  return {
    threadId,
    thread: legacyData.thread,
    messageContent: readString(legacyData.messageContent) ?? answer,
    scope: readScope(legacyData.scope),
    isInScope:
      typeof legacyData.isInScope === "boolean" ? legacyData.isInScope : true,
    refusalReason: readString(legacyData.refusalReason),
    answer,
    ...(thinking ? { thinking } : {}),
    suggestedQuestions: readStringArray(legacyData.suggestedQuestions),
    citations: readCitations(legacyData.citations),
    ...(legacyData.visualization ? { visualization: legacyData.visualization } : {}),
    generation: legacyData.generation,
    contextSummary: readString(legacyData.contextSummary) ?? "",
  };
};
