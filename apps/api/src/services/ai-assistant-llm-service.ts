import { z } from "zod";

import type {
  AiAssistantCitationDto,
  AiAssistantGenerationDto,
  AiAssistantScope,
} from "@silo/engine/contracts/dto/ai-assistant";
import { AiAssistantScopeSchema } from "@silo/engine/contracts/dto/ai-assistant";
import { config } from "@silo/engine/config";
import { chatWithOllama, chatWithOllamaStream, type OllamaChatMessage } from "../infra/llm/ollama-client.js";

const AssistantRewriteSchema = z.object({
  answer: z.string().default(""),
  contextSummary: z.string().default(""),
  thinking: z.string().optional(),
});

type AssistantRewriteContent = {
  answer: string;
  contextSummary: string;
  thinking?: string;
};

type ComposeAssistantAnswerInput = {
  scope: AiAssistantScope;
  question: string;
  fallbackAnswer: string;
  contextSummary: string;
  citations: AiAssistantCitationDto[];
  suggestedQuestions: string[];
  conversationHistory: OllamaChatMessage[];
  conversationMemory: string | null;
};

type ClassifyAssistantScopeInput = {
  question: string;
  lastKnownScope: AiAssistantScope | null;
  conversationHistory: OllamaChatMessage[];
  conversationMemory: string | null;
};

const buildScopeClassificationPrompt = (
  input: ClassifyAssistantScopeInput,
): OllamaChatMessage[] => {
  const recentHistory = input.conversationHistory.slice(-6);

  const memoryMessage = input.conversationMemory
    ? {
        role: "system" as const,
        content: [
          "Memória persistida da conversa:",
          input.conversationMemory,
          "Use esta memória para manter continuidade de contexto e herança de assunto.",
        ].join("\n"),
      }
    : null;

  const examplesMessage = {
    role: "system" as const,
    content: [
      "Exemplos de classificação:",
      '- Contexto sobre modelos + "Como foi o dia hoje?" -> {"scope":"models","isInScope":true}',
      '- Contexto sobre projetos + "E qual depende de mais gente?" -> {"scope":"projects","isInScope":true}',
      '- "Que filme você assistiu hoje?" -> {"scope":null,"isInScope":false}',
    ].join("\n"),
  };

  return [
    {
      role: "system",
      content: [
        "Você classifica se a próxima pergunta está no escopo do assistente analítico do SILO.",
        "Escopos válidos: models, pending, reports, problems, solutions, projects e general.",
        "Use general para um panorama amplo da operação, resumo do dia, cenário atual ou visão executiva que misture vários temas do SILO.",
        "Se a pergunta for claramente externa ao SILO, responda com scope null e isInScope false.",
        "Perguntas curtas, elípticas ou de seguimento devem herdar o assunto da thread quando isso fizer sentido.",
        'Responda apenas com JSON válido no formato {"scope":null|"models"|"pending"|"reports"|"problems"|"solutions"|"projects"|"general","isInScope":true|false}.',
      ].join(" "),
    },
    examplesMessage,
    ...(memoryMessage ? [memoryMessage] : []),
    ...recentHistory,
    {
      role: "user",
      content: [
        `Último escopo conhecido: ${input.lastKnownScope ?? "nenhum"}`,
        "Memória resumida da thread:",
        input.conversationMemory ?? "sem memória",
        "",
        `Pergunta atual: ${input.question}`,
        "",
        "Se a pergunta for um seguimento da operação do SILO, preserve o contexto da thread.",
        "Se for um assunto externo como filmes, receitas, clima ou outros temas pessoais, marque fora do escopo.",
      ].join("\n"),
    },
  ];
};

const buildPrompt = (input: ComposeAssistantAnswerInput): OllamaChatMessage[] => {
  const citationLines = input.citations
    .map((citation) => `- ${citation.label}${citation.detail ? `: ${citation.detail}` : ""}`)
    .join("\n");

  const suggestedQuestions = input.suggestedQuestions.map((item) => `- ${item}`).join("\n");

  const memoryMessage = input.conversationMemory
    ? {
        role: "system" as const,
        content: [
          "Memória persistida da conversa:",
          input.conversationMemory,
          "Use esta memória apenas para continuidade, referências implícitas e manutenção do contexto da thread.",
        ].join("\n"),
      }
    : null;

  return [
    {
      role: "system",
      content: [
        "Você é o assistente analítico do SILO.",
        "SEMPRE que precisar raciocinar, analisar dados ou comparar informações, coloque esse raciocínio no campo thinking.",
        "O campo answer deve conter APENAS a resposta final limpa, sem raciocínio, sem análise, sem passo a passo.",
        "Nunca misture raciocínio com a resposta final.",
        "Responda sempre em português brasileiro.",
        "Use sempre o contexto factual atual como fonte principal. O histórico da conversa serve apenas para continuidade e memória; se houver conflito, o contexto factual atual vence.",
        "Não invente números, nomes, eventos ou causas.",
        "Reescreva a resposta para ficar mais clara, mais útil e mais detalhada, sem alterar os fatos.",
        'Responda com um objeto JSON estrito, sem markdown, sem bloco de código e sem texto extra.',
        'Exemplo: {"thinking":"Analisando os dados, vejo que o BAM tem 0% de disponibilidade...","answer":"Resumo objetivo final.","contextSummary":"Contexto curto."}',
        "Retorne apenas JSON válido com as chaves thinking (opcional, só se houver raciocínio), answer e contextSummary.",
      ].join(" "),
    },
    ...(memoryMessage ? [memoryMessage] : []),
    ...input.conversationHistory,
    {
      role: "user",
      content: [
        `Escopo: ${input.scope}`,
        `Pergunta original: ${input.question}`,
        "",
        "Resumo factual base:",
        input.contextSummary,
        "",
        "Resposta base para reescrita:",
        input.fallbackAnswer,
        "",
        "Citações disponíveis:",
        citationLines.length > 0 ? citationLines : "- Nenhuma",
        "",
        "Perguntas sugeridas:",
        suggestedQuestions.length > 0 ? suggestedQuestions : "- Nenhuma",
      ].join("\n"),
    },
  ];
};

function getStringProperty(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function coerceAssistantRewriteContent(content: unknown): AssistantRewriteContent | null {
  if (typeof content === "string") {
    const answer = content.trim();
    return answer.length > 0 ? { answer, contextSummary: "" } : null;
  }

  if (!isRecord(content)) {
    return null;
  }

  const record = content;
  const answer = getStringProperty(record, ["answer", "response", "content", "text"]);

  if (!answer) {
    return null;
  }

  const thinking = getStringProperty(record, ["thinking", "reasoning", "thought", "thought_process"]);

  return {
    answer,
    contextSummary:
      getStringProperty(record, ["contextSummary", "summary", "context"]) ?? "",
    thinking: thinking ?? undefined,
  };
}

function extractJsonCandidates(content: string): string[] {
  const trimmed = content.trim();
  const candidates = new Set<string>();

  if (trimmed.length === 0) {
    return [];
  }

  candidates.add(trimmed);

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    candidates.add(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  return [...candidates];
}

export function parseAssistantRewriteContent(content: string): AssistantRewriteContent | null {
  for (const candidate of extractJsonCandidates(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const coerced = coerceAssistantRewriteContent(parsed);
      if (coerced) {
        const validated = AssistantRewriteSchema.safeParse(coerced);
        if (validated.success) {
          return {
            answer: validated.data.answer.trim(),
            contextSummary: validated.data.contextSummary.trim(),
            thinking: validated.data.thinking?.trim() || undefined,
          };
        }
      }
    } catch {
      // Tenta o próximo candidato.
    }
  }

  const fallbackAnswer = content.trim();
  return fallbackAnswer.length > 0
    ? { answer: fallbackAnswer, contextSummary: "" }
    : null;
}

function parseAssistantScopeClassificationContent(content: string): AiAssistantScope | null {
  for (const candidate of extractJsonCandidates(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (!isRecord(parsed)) {
        continue;
      }

      const isInScope = typeof parsed.isInScope === "boolean" ? parsed.isInScope : null;
      if (isInScope === null) {
        continue;
      }

      if (!isInScope) {
        return null;
      }

      const scopeCandidate = getStringProperty(parsed, ["scope", "scopeName"]);
      const validatedScope = scopeCandidate ? AiAssistantScopeSchema.safeParse(scopeCandidate) : null;

      if (!validatedScope?.success) {
        continue;
      }

      return validatedScope.data;
    } catch {
      // Tenta o próximo candidato.
    }
  }

  return null;
}

const buildGeneration = (
  generation: Omit<AiAssistantGenerationDto, "errorMessage"> & {
    errorMessage?: string | null;
  },
): AiAssistantGenerationDto => ({
  provider: generation.provider,
  model: generation.model,
  status: generation.status,
  latencyMs: generation.latencyMs,
  generatedTokens: generation.generatedTokens ?? null,
  thinkingTimeMs: generation.thinkingTimeMs ?? null,
  errorMessage: generation.errorMessage ?? null,
});

export async function composeAssistantAnswerWithOllama(
  input: ComposeAssistantAnswerInput,
): Promise<{
  answer: string;
  contextSummary: string;
  thinking?: string;
  generation: AiAssistantGenerationDto;
}> {
  const startedAt = Date.now();

  try {
    const { content, latencyMs, generatedTokens, thinkingTimeMs } = await chatWithOllama({
      model: config.ollama.model,
      timeoutMs: config.ollama.timeoutMs,
      messages: buildPrompt(input),
    });

    const parsedContent = parseAssistantRewriteContent(content);

    if (!parsedContent) {
      throw new Error("Resposta do Ollama vazia ou inválida.");
    }

    const finalAnswer = parsedContent.answer.trim();
    return {
      answer: finalAnswer.length > 0 ? finalAnswer : input.fallbackAnswer,
      contextSummary:
        parsedContent.contextSummary.trim().length > 0
          ? parsedContent.contextSummary.trim()
          : input.contextSummary,
      thinking: parsedContent.thinking?.trim() || undefined,
      generation: buildGeneration({
        provider: "ollama",
        model: config.ollama.model,
        status: finalAnswer.length > 0 ? "success" : "fallback",
        latencyMs,
        generatedTokens,
        thinkingTimeMs,
      }),
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("❌ [OLLAMA_COMPOSE] Falha ao compor resposta:", errorMessage);

    // Sem fallback — propaga o erro para o chamador tratar
    throw new Error(`Falha ao gerar resposta com IA: ${errorMessage}`, { cause: error instanceof Error ? error : undefined });
  }
}

export type AssistantStreamEvent =
  | { type: "thinking"; content: string }
  | { type: "answer"; content: string; contextSummary: string; generation: AiAssistantGenerationDto }
  | { type: "error"; content: string };

/**
 * Versão streaming do composeAssistantAnswerWithOllama.
 * Faz yield de eventos SSE: primeiro os tokens de pensamento (type: "thinking"),
 * depois o resultado final (type: "answer").
 */
export async function* composeAssistantAnswerWithOllamaStream(
  input: ComposeAssistantAnswerInput,
): AsyncGenerator<AssistantStreamEvent> {
  const startedAt = Date.now();

  try {
    let fullContent = "";

    for await (const chunk of chatWithOllamaStream({
      model: config.ollama.model,
      timeoutMs: config.ollama.timeoutMs,
      messages: buildPrompt(input),
    })) {
      if (chunk.done) break;
      fullContent += chunk.token;

      // Tenta extrair o campo "thinking" do JSON parcial
      const thinking = extractPartialThinking(fullContent);
      if (thinking) {
        yield { type: "thinking", content: thinking };
      }
    }

    const latencyMs = Date.now() - startedAt;
    const parsedContent = parseAssistantRewriteContent(fullContent);

    if (!parsedContent) {
      throw new Error("Resposta do Ollama vazia ou inválida.");
    }

    const finalAnswer = parsedContent.answer.trim();
    yield {
      type: "answer",
      content: finalAnswer.length > 0 ? finalAnswer : input.fallbackAnswer,
      contextSummary:
        parsedContent.contextSummary.trim().length > 0
          ? parsedContent.contextSummary.trim()
          : input.contextSummary,
      generation: buildGeneration({
        provider: "ollama",
        model: config.ollama.model,
        status: finalAnswer.length > 0 ? "success" : "fallback",
        latencyMs,
        generatedTokens: null,
        thinkingTimeMs: null,
      }),
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("❌ [OLLAMA_COMPOSE_STREAM] Falha ao compor resposta:", errorMessage);

    // Sem fallback — envia evento de erro e encerra o stream
    yield {
      type: "error",
      content: `Falha ao gerar resposta com IA: ${errorMessage}`,
    };
  }
}

/**
 * Extrai o campo "thinking" de um JSON parcial (ainda em construção).
 * Retorna o valor atual de thinking conforme vai sendo gerado.
 */
function extractPartialThinking(partialJson: string): string | null {
  try {
    // Tenta parse como JSON completo primeiro
    const parsed = JSON.parse(partialJson) as Record<string, unknown>;
    return typeof parsed.thinking === "string" ? parsed.thinking : null;
  } catch {
    // JSON ainda incompleto — tenta extrair com regex
    const match = partialJson.match(/"thinking"\s*:\s*"((?:[^"\\]|\\.)*)/);
    return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null;
  }
}

export async function classifyAssistantScopeWithOllama(
  input: ClassifyAssistantScopeInput,
): Promise<AiAssistantScope | null> {
  try {
    const { content } = await chatWithOllama({
      model: config.ollama.model,
      timeoutMs: config.ollama.timeoutMs,
      messages: buildScopeClassificationPrompt(input),
    });

    return parseAssistantScopeClassificationContent(content);
  } catch {
    return null;
  }
}