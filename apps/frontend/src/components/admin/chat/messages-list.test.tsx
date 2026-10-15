import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/context/chat-context";

vi.mock("./message-bubble", () => ({
  default: ({ message, onDelete }: { message: ChatMessage; onDelete?: (id: string) => void }) => (
    <div data-testid={`message-${message.id}`}>
      <span>{message.content}</span>
      {onDelete && message.senderUserId !== "ai-assistant" ? (
        <button type="button" onClick={() => onDelete(message.id)}>
          Excluir mensagem
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("./load-messages-button", () => ({
  LoadMessagesButton: () => null,
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: ({ text }: { text?: string }) => <span>{text}</span>,
}));

import { MessagesList } from "./messages-list";

const createMessage = (id: string, content: string, senderUserId: string): ChatMessage => ({
  id,
  content,
  senderUserId,
  senderName: senderUserId === "ai-assistant" ? "Assistente de IA" : "User One",
  receiverGroupId: null,
  receiverUserId: null,
  createdAt: new Date("2026-10-14T12:00:00Z"),
  readAt: null,
  deletedAt: null,
  messageType: "userMessage",
});

describe("MessagesList do assistente", () => {
  it("não permite excluir a primeira mensagem, mas permite excluir perguntas posteriores", () => {
    const onDeleteMessage = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    const messages = [
      createMessage("leading-assistant-message", "Resposta inicial carregada", "ai-assistant"),
      createMessage("first-user-message", "Primeira pergunta", "user-1"),
      createMessage("first-assistant-message", "Primeira resposta", "ai-assistant"),
      createMessage("second-user-message", "Pergunta posterior", "user-1"),
    ];

    render(
      <MessagesList
        messages={messages}
        isLoading={false}
        isLoadingOlder={false}
        isLoadingNewer={false}
        hasMoreOlderMessages={false}
        hasMoreNewerMessages={false}
        olderMessagesRemaining={0}
        newerMessagesRemaining={0}
        currentUserId="user-1"
        variant="assistant"
        onLoadOlderMessages={vi.fn()}
        onLoadNewerMessages={vi.fn()}
        onDeleteMessage={onDeleteMessage}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Excluir mensagem" });
    expect(deleteButtons).toHaveLength(1);
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteMessage).toHaveBeenCalledWith("second-user-message");
    expect(screen.getByTestId("message-first-user-message")).toHaveTextContent("Primeira pergunta");
  });

  it("exibe a mensagem genérica enquanto consulta o modelo de IA", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });

    render(
      <MessagesList
        messages={[]}
        isLoading={false}
        isLoadingOlder={false}
        isLoadingNewer={false}
        hasMoreOlderMessages={false}
        hasMoreNewerMessages={false}
        olderMessagesRemaining={0}
        newerMessagesRemaining={0}
        currentUserId="user-1"
        variant="assistant"
        assistantStatusText="Consultando o modelo de IA..."
        onLoadOlderMessages={vi.fn()}
        onLoadNewerMessages={vi.fn()}
      />,
    );

    expect(screen.getByText("Consultando o modelo de IA...")).toBeInTheDocument();
  });
});
