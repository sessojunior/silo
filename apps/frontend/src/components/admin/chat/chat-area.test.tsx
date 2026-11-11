import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatArea from "./chat-area";

const sendMessage = vi.fn();

vi.mock("@/context/chat-context", () => ({
  useChat: () => ({ sendMessage }),
}));

vi.mock("@/hooks/use-chat-messages", () => ({
  useChatMessages: () => ({
    isLoading: false,
    isLoadingOlder: false,
    isLoadingNewer: false,
    hasMoreOlderMessages: false,
    hasMoreNewerMessages: false,
    totalMessagesCount: 0,
    targetMessages: [],
    olderMessagesRemaining: 0,
    newerMessagesRemaining: 0,
    handleLoadOlderMessages: vi.fn(),
    handleLoadNewerMessages: vi.fn(),
    currentUser: { id: "current-user" },
  }),
}));

vi.mock("./chat-header", () => ({ ChatHeader: () => <header /> }));
vi.mock("./messages-list", () => ({ MessagesList: () => <main /> }));
vi.mock("./empty-chat-state", () => ({ EmptyChatState: () => <div /> }));

describe("ChatArea", () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it("blocks duplicate sends and shows progress while sending", () => {
    let resolveSend: (() => void) | undefined;
    sendMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );

    render(
      <ChatArea
        activeTargetId="user-1"
        activeTargetType="user"
        activeTarget={{ id: "user-1", name: "User 1" } as never}
        onToggleSidebar={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Digite sua mensagem...");
    const sendButton = screen.getByRole("button", { name: "Enviar mensagem" });
    fireEvent.change(textarea, { target: { value: "Olá" } });
    fireEvent.click(sendButton);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendButton).toBeDisabled();
    expect(sendButton.querySelector(".animate-spin")).toBeInTheDocument();

    resolveSend?.();
  });

  it("does not send an empty or whitespace-only message", () => {
    render(
      <ChatArea
        activeTargetId="user-1"
        activeTargetType="user"
        activeTarget={{ id: "user-1", name: "User 1" } as never}
        onToggleSidebar={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Digite sua mensagem...");
    const sendButton = screen.getByRole("button", { name: "Enviar mensagem" });
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(sendButton);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendButton).toBeDisabled();
  });

  it("selects a file and sends it with the chat message", () => {
    render(
      <ChatArea
        activeTargetId="user-1"
        activeTargetType="user"
        activeTarget={{ id: "user-1", name: "User 1" } as never}
        onToggleSidebar={vi.fn()}
      />,
    );

    const file = new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Anexar arquivo"), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByPlaceholderText("Digite sua mensagem..."), {
      target: { value: "Veja o relatório" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(sendMessage).toHaveBeenCalledWith(
      "Veja o relatório",
      undefined,
      "user-1",
      [file],
    );
  });
});
