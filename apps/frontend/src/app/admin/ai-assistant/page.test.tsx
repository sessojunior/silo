import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentUser } from "@/hooks/use-current-user";
import { config } from "@/lib/config";

import AiAssistantPage from "./page";

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    getApiUrl: (path: string) => path,
    getAssistantApiUrl: (path: string) => path,
    getPublicPath: (path: string) => path,
    publicBasePath: "",
    isSmokeMode: false,
  },
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  default: function MockButton({
    children,
    type = "button",
    onClick,
    ...rest
  }: {
    children: ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    [key: string]: unknown;
  }) {
    const { style: _style, ...buttonProps } = rest as Record<string, unknown>;
    return (
      <button type={type} onClick={onClick} {...buttonProps}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/admin/chat/message-input", () => ({
  MessageInput: function MockMessageInput({
    onSendMessage,
  }: {
    onSendMessage: (message: string) => Promise<void>;
  }) {
    return (
      <button type="button" onClick={() => void onSendMessage("Quais modelos estao ativos?")}>
        Enviar pergunta
      </button>
    );
  },
}));

vi.mock("@/components/admin/chat/messages-list", () => ({
  MessagesList: function MockMessagesList({
    messages,
  }: {
    messages: Array<{ content: string }>;
  }) {
    return (
      <div data-testid="messages-list">
        {messages.map((message) => message.content).join(" | ")}
      </div>
    );
  },
}));

vi.mock("@/components/admin/ai-assistant/assistant-sidebar", () => ({
  default: function MockAssistantSidebar() {
    return <aside data-testid="assistant-sidebar" />;
  },
}));

vi.mock("@/components/admin/ai-assistant/assistant-empty-state", () => ({
  default: function MockAssistantEmptyState({
    examples,
    onExampleSelect,
  }: {
    examples: Array<{ prompt: string }>;
    onExampleSelect: (prompt: string) => void;
  }) {
    return (
      <div data-testid="assistant-empty-state">
        <button type="button" onClick={() => onExampleSelect(examples[0]?.prompt ?? "")}>
          Perguntar
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  default: function MockDialog({
    open,
    children,
  }: {
    open: boolean;
    children?: ReactNode;
  }) {
    return open ? <div role="dialog">{children}</div> : null;
  },
}));

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body) as Record<string, unknown>;
}

describe("AiAssistantPage", () => {
  beforeEach(() => {
    mockedUseCurrentUser.mockReturnValue({
      currentUser: {
        id: "user-1",
        name: "User One",
        email: "user.one@example.test",
        image: null,
      },
      loading: false,
      error: null,
    } as never);

    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads assistant data and streams a response when the user selects an example", async () => {
    const threadId = "thread-1";
    const thread = {
      id: threadId,
      title: "Pergunta inicial",
      lastMessagePreview: "Pergunta inicial",
      messageCount: 0,
      lastMessageAt: "2026-08-04T12:00:00.000Z",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/examples") {
        return jsonResponse({
          success: true,
          data: {
            examples: [
              {
                id: "example-1",
                title: "Modelos",
                prompt: "Quais modelos estao ativos?",
                description: "Teste de fluxo",
                scope: "models",
              },
            ],
          },
        });
      }

      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/threads") {
        return jsonResponse({
          success: true,
          data: {
            threads: [],
          },
        });
      }

      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/status") {
        return jsonResponse({
          success: true,
          data: {
            provider: "vllm",
            model: "smna",
            mode: "vllm",
            latencyMs: 12,
            checkedAt: "2026-08-04T12:00:00.000Z",
          },
        });
      }

      if (method === "POST" && requestUrl.pathname === "/api/admin/ai-assistant/threads") {
        return jsonResponse({
          success: true,
          data: {
            thread,
          },
        });
      }

      if (method === "POST" && requestUrl.pathname === "/api/admin/ai-assistant/messages/stream") {
        expect(init?.headers).toEqual(
          expect.objectContaining({
            "Content-Type": "application/json",
            "X-Idempotency-Key": expect.any(String),
          }),
        );
        expect(parseJsonBody(init?.body)).toEqual({
          content: "Quais modelos estao ativos?",
          threadId,
        });

        const payload = {
          threadId,
          thread,
          messageContent: "Resposta de teste",
          answer: "Resposta de teste",
          scope: "general",
          isInScope: true,
          refusalReason: null,
          suggestedQuestions: [],
          citations: [],
          contextSummary: "",
        };

        return new Response(`event: result\ndata: ${JSON.stringify(payload)}\n\n`, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistantPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-assistant/status", expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-assistant/examples", expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-assistant/threads", expect.any(Object));
    });

    expect(await screen.findByTestId("assistant-empty-state")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai-assistant/messages/stream",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(await screen.findByTestId("messages-list")).toHaveTextContent("Resposta de teste");
  });
});
