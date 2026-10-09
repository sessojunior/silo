import { render, screen } from "@testing-library/react";
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

    expect(screen.getByText("Resposta de contingência")).toBeInTheDocument();
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
