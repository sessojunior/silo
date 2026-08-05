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
