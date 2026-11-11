import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NotificationDropdown from "./notification-dropdown";

const clearUnreadMessages = vi.fn();
const loadUnreadMessages = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/chat-context", () => ({
  useChat: () => ({ loadSidebarData: vi.fn() }),
}));

vi.mock("@/hooks/use-chat-notifications", () => ({
  useChatNotifications: () => ({
    totalUnread: 3,
    isLoading: false,
    loadUnreadMessages,
    clearUnreadMessages,
    getConversationsWithUnread: () => [],
  }),
}));

vi.mock("@/hooks/use-chat-presence", () => ({
  useChatPresence: () => ({
    localPresence: "online",
    changePresence: vi.fn(),
    fetchCurrentPresence: vi.fn(),
  }),
}));

vi.mock("./presence-toggle", () => ({
  default: () => <div data-testid="presence-toggle" />,
}));

vi.mock("./conversation-list", () => ({
  default: () => <div data-testid="conversation-list" />,
}));

describe("NotificationDropdown", () => {
  beforeEach(() => {
    clearUnreadMessages.mockReset();
    loadUnreadMessages.mockReset();
  });

  it("expõe uma ação explícita para limpar todas as notificações", () => {
    render(<NotificationDropdown onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /limpar todas/i }));

    expect(clearUnreadMessages).toHaveBeenCalledTimes(1);
  });
});
