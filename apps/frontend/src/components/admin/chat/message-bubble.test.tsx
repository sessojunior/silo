import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/context/chat-context";

vi.mock("next/dynamic", () => ({
  default: () => {
    function MockDynamicComponent() {
      return <div data-testid="mock-dynamic" />;
    }

    return MockDynamicComponent;
  },
}));

vi.mock("@/hooks/use-dark-mode", () => ({
  useDarkMode: () => false,
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
  },
}));

import MessageBubble from "./message-bubble";

describe("message bubble assistant artifacts dedupe", () => {
  it("keeps the streaming state compact and without a second loading block", () => {
    const message: ChatMessage = {
      id: "88888888-8888-4888-8888-888888888888",
      content: "",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantThinking: null,
      assistantGeneration: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar
        showAssistantFooter
      />,
    );

    expect(screen.getByText("Processando")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-message-bubble")).toHaveClass("px-5", "py-4");
    expect(screen.getByTestId("assistant-streaming-status")).toBeInTheDocument();
    expect(screen.queryByText("Analisando dados do Silo...")).not.toBeInTheDocument();
    expect(screen.queryByText("aguardando resultado")).not.toBeInTheDocument();
    expect(screen.queryByText("Processando a solicitação...")).not.toBeInTheDocument();
  });

  it("offers a retry action in the assistant error card", () => {
    const onRetry = vi.fn();
    const message: ChatMessage = {
      id: "99999999-9999-4999-8999-999999999999",
      content: "Mensagem longa que não deve dominar o cartão de erro.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "error",
        latencyMs: 1200,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage: "O modelo de IA não respondeu dentro do tempo limite.",
      },
      assistantThinking: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Não foi possível obter a resposta")).toBeInTheDocument();
    expect(
      screen.getByText("O modelo de IA não respondeu dentro do tempo limite."),
    ).toBeInTheDocument();
    expect(screen.queryByText(message.content)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps fallback content and offers retry in a compact notice", () => {
    const onRetry = vi.fn();
    const message: ChatMessage = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      content: "Resumo provisório baseado nos dados autorizados.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "fallback",
        latencyMs: 1200,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage: "O modelo não pôde ser acessado.",
      },
      assistantThinking: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(message.content)).toBeInTheDocument();
    expect(screen.getByText("Resposta provisória")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("identifies deterministic fallback responses to the user", () => {
    const message: ChatMessage = {
      id: "44444444-4444-4444-8444-444444444444",
      content: "Resposta baseada nos dados autorizados.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "fallback",
        latencyMs: 1200,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage: "O modelo respondeu em formato inválido.",
      },
      assistantThinking: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        showAssistantFooter
      />,
    );

    expect(screen.getByText("O modelo respondeu em formato inválido.")).toBeInTheDocument();
  });

  it("does not render execution thinking for fallback responses", () => {
    const message: ChatMessage = {
      id: "55555555-5555-4555-8555-555555555555",
      content: "Resposta baseada nos dados autorizados.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "fallback",
        latencyMs: 1200,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage: "O modelo respondeu em formato inválido.",
      },
      assistantThinking: "O modelo vLLM está redigindo a resposta final.",
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        showAssistantFooter
      />,
    );

    expect(screen.queryByText("Raciocínio de Qwen/Qwen2.5-0.5B-Instruct")).not.toBeInTheDocument();
    expect(screen.queryByText("O modelo vLLM está redigindo a resposta final.")).not.toBeInTheDocument();
  });

  it("does not present persisted execution status as model reasoning", () => {
    const operationalThinking =
      "Estou consultando os dados autorizados do SILO e preparando a resposta com o modelo de IA...";
    const message: ChatMessage = {
      id: "77777777-7777-4777-8777-777777777777",
      content: "Resposta gerada pelo modelo.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "success",
        latencyMs: 1200,
        generatedTokens: 64,
        thinkingTimeMs: null,
        errorMessage: null,
      },
      assistantThinking: operationalThinking,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        showAssistantFooter
      />,
    );

    expect(screen.queryByText("Raciocínio de Qwen/Qwen2.5-0.5B-Instruct")).not.toBeInTheDocument();
    expect(screen.queryByText(operationalThinking)).not.toBeInTheDocument();
  });

  it("does not repeat the error in the assistant failure footer", () => {
    const errorMessage = "O assistente de IA não está disponível no momento.";
    const message: ChatMessage = {
      id: "66666666-6666-4666-8666-666666666666",
      content: errorMessage,
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantGeneration: {
        provider: "vllm",
        model: "indisponível",
        status: "error",
        latencyMs: 0,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage,
      },
      assistantThinking: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        showAssistantFooter
      />,
    );

    expect(
      screen.getAllByText((content) => content.includes(errorMessage)),
    ).toHaveLength(1);
    expect(screen.queryByText("Pensando...")).not.toBeInTheDocument();
  });

  it("renders assistant Markdown without enabling raw HTML", () => {
    const message: ChatMessage = {
      id: "33333333-3333-3333-8333-333333333333",
      content: "# Resumo\n\n- Item importante\n\n<script>alert('x')</script>",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantThinking: null,
      assistantGeneration: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar={false}
        showAssistantFooter={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Resumo" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Item importante");
    expect(screen.queryByRole("script")).not.toBeInTheDocument();
  });

  it("renders grounded citation provenance for assistant responses", () => {
    const message: ChatMessage = {
      id: "22222222-2222-2222-2222-222222222222",
      content: "Resposta fundamentada.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantCitations: [
        {
          label: "Manual de modelos",
          detail: "Recuperação híbrida",
          source: "manual",
          sourceId: "manual-models",
          snippet: "Os modelos ativos são mantidos no manual.",
          score: 0.91,
        },
      ],
      assistantThinking: null,
      assistantGeneration: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar
        showAssistantFooter={false}
      />,
    );

    expect(screen.getByTestId("assistant-citations")).toHaveTextContent(
      "Manual de modelos · manual-models",
    );
    expect(screen.getByTestId("assistant-citations")).toHaveTextContent(
      "Os modelos ativos são mantidos no manual.",
    );
  });

  it("renders the legacy PDF only once when visualization and artifacts share the same source", () => {
    const message: ChatMessage = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Relatório executivo disponível.",
      senderUserId: "ai-assistant",
      senderName: "Assistente de IA",
      receiverGroupId: null,
      receiverUserId: null,
      createdAt: new Date("2026-07-28T12:00:00Z"),
      readAt: null,
      deletedAt: null,
      messageType: "userMessage",
      assistantVisualization: {
        kind: "image",
        src: "/uploads/serve/reports/executive.pdf",
        alt: "Relatório executivo",
        caption: "PDF legado",
      },
      assistantArtifacts: [
        {
          kind: "pdf",
          url: "/api/upload/serve/reports/executive.pdf",
          filename: "executive.pdf",
          title: "Relatório executivo",
          mimeType: "application/pdf",
          reportType: "executive",
          checksum: "abc123",
          byteSize: 1024,
        },
      ],
      assistantThinking: null,
      assistantGeneration: null,
    };

    render(
      <MessageBubble
        message={message}
        isOwnMessage={false}
        showAvatar
        showAssistantFooter={false}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Baixar PDF" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Visualizar" })).toHaveLength(1);
    expect(screen.getByText("PDF legado")).toBeInTheDocument();
  });
});
