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

const normalizeSseFieldValue = (value: string): string =>
  value.startsWith(" ") ? value.slice(1) : value;

const parseAssistantSseFramePayload = (
  eventName: string,
  rawData: string,
): Record<string, unknown> | null => {
  if (rawData.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawData);
    if (isRecord(parsed)) {
      return parsed;
    }

    if (eventName === "error") {
      return { content: String(parsed) };
    }
  } catch {
    if (eventName === "error") {
      return { content: rawData };
    }
  }

  return null;
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

export const parseAssistantSseFrame = (frameLines: string[]): AssistantSseAction => {
  let eventName = "";
  const dataLines: string[] = [];

  for (const rawLine of frameLines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.length === 0 || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = normalizeSseFieldValue(line.slice("event:".length)).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(normalizeSseFieldValue(line.slice("data:".length)));
    }
  }

  if (eventName.length === 0 && dataLines.length === 0) {
    return { type: "ignore" };
  }

  const payload = parseAssistantSseFramePayload(eventName, dataLines.join("\n"));
  if (!payload) {
    return { type: "ignore" };
  }

  return parseAssistantSseEvent(eventName, payload);
};

export class AssistantSseStreamParser {
  private buffer = "";

  private frameLines: string[] = [];

  pushChunk(chunk: string): AssistantSseAction[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";

    const actions: AssistantSseAction[] = [];
    for (const line of lines) {
      this.consumeLine(line, actions);
    }

    return actions;
  }

  flush(): AssistantSseAction[] {
    const actions: AssistantSseAction[] = [];

    if (this.buffer.length > 0) {
      this.consumeLine(this.buffer, actions);
      this.buffer = "";
    }

    if (this.frameLines.length > 0) {
      actions.push(parseAssistantSseFrame(this.frameLines));
      this.frameLines = [];
    }

    return actions;
  }

  private consumeLine(line: string, actions: AssistantSseAction[]): void {
    const normalizedLine = line.replace(/\r$/, "");

    if (normalizedLine.length === 0) {
      if (this.frameLines.length > 0) {
        actions.push(parseAssistantSseFrame(this.frameLines));
        this.frameLines = [];
      }
      return;
    }

    if (normalizedLine.startsWith(":")) {
      return;
    }

    this.frameLines.push(normalizedLine);
  }
}

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
    ...(legacyData.artifacts != null ? { artifacts: legacyData.artifacts } : {}),
    generation: legacyData.generation,
    contextSummary: readString(legacyData.contextSummary) ?? "",
  };
};
