import { z } from "zod";

import type {
  AiAssistantCitationDto,
  AiAssistantGenerationDto,
  AiAssistantScope,
} from "@silo/engine/contracts";
import { config } from "@silo/engine/config";
import { chatWithOllama, type OllamaChatMessage } from "../infra/llm/ollama-client.js";

const AssistantRewriteSchema = z.object({
  answer: z.string().min(1),
  contextSummary: z.string().default(""),
});

type ComposeAssistantAnswerInput = {
  scope: AiAssistantScope;
  question: string;
  fallbackAnswer: string;
  contextSummary: string;
  citations: AiAssistantCitationDto[];
  suggestedQuestions: string[];
};

const buildPrompt = (input: ComposeAssistantAnswerInput): OllamaChatMessage[] => {
  const citationLines = input.citations
    .map((citation) => `- ${citation.label}${citation.detail ? `: ${citation.detail}` : ""}`)
    .join("\n");

  const suggestedQuestions = input.suggestedQuestions.map((item) => `- ${item}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Você é o assistente analítico do SILO.",
        "Responda sempre em português brasileiro.",
        "Use somente os fatos fornecidos no contexto.",
        "Não invente números, nomes, eventos ou causas.",
        "Reescreva a resposta para ficar mais clara, mais útil e mais detalhada, sem alterar os fatos.",
        "Retorne apenas JSON válido com as chaves answer e contextSummary.",
      ].join(" "),
    },
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

const buildGeneration = (
  generation: Omit<AiAssistantGenerationDto, "errorMessage"> & {
    errorMessage?: string | null;
  },
): AiAssistantGenerationDto => ({
  provider: generation.provider,
  model: generation.model,
  status: generation.status,
  latencyMs: generation.latencyMs,
  errorMessage: generation.errorMessage ?? null,
});

export async function composeAssistantAnswerWithOllama(
  input: ComposeAssistantAnswerInput,
): Promise<{
  answer: string;
  contextSummary: string;
  generation: AiAssistantGenerationDto;
}> {
  const startedAt = Date.now();

  try {
    const { content, latencyMs } = await chatWithOllama({
      model: config.ollama.model,
      timeoutMs: config.ollama.timeoutMs,
      messages: buildPrompt(input),
    });

    const parsedContent = AssistantRewriteSchema.parse(JSON.parse(content) as unknown);

    return {
      answer: parsedContent.answer.trim(),
      contextSummary:
        parsedContent.contextSummary.trim().length > 0
          ? parsedContent.contextSummary.trim()
          : input.contextSummary,
      generation: buildGeneration({
        provider: "ollama",
        model: config.ollama.model,
        status: "success",
        latencyMs,
      }),
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      answer: input.fallbackAnswer,
      contextSummary: input.contextSummary,
      generation: buildGeneration({
        provider: "ollama",
        model: config.ollama.model,
        status: "fallback",
        latencyMs,
        errorMessage,
      }),
    };
  }
}