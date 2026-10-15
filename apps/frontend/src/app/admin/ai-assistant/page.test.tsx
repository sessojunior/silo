import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentUser } from "@/hooks/use-current-user";

import AiAssistantPage, {
  ASSISTANT_STATUS_TEXT,
  buildAssistantErrorGeneration,
  resolveAssistantThinking,
} from "./page";

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
    const buttonProps = { ...(rest as Record<string, unknown>) };
    delete buttonProps.style;
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
    onDeleteMessage,
  }: {
    messages: Array<{
      id: string;
      senderUserId: string;
      content: string;
      assistantGeneration?: { status?: string | null } | null;
      assistantCitations?: Array<{ source?: string | null; sourceId?: string | null }> | null;
      assistantVisualization?: { kind: string } | null;
      assistantArtifacts?: unknown[] | null;
    }>;
    onDeleteMessage?: (messageId: string) => void;
  }) {
    return (
      <div data-testid="messages-list">
        {messages
          .map((message) =>
            [
              message.content,
              message.assistantCitations?.map((citation) => `${citation.source}:${citation.sourceId}`)
                .join(","),
              message.assistantVisualization?.kind,
              message.assistantArtifacts?.length
                ? `artifacts=${message.assistantArtifacts.length}`
                : null,
              message.assistantGeneration?.status,
            ]
              .filter(Boolean)
              .join(" "),
          )
          .join(" | ")}
        {messages
          .filter((message) => message.senderUserId !== "ai-assistant")
          .map((message) => (
            <button
              key={`delete-${message.id}`}
              type="button"
              onClick={() => onDeleteMessage?.(message.id)}
            >
              Excluir mensagem
            </button>
          ))}
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
  it("marca falhas do fluxo como erro de geração", () => {
    expect(buildAssistantErrorGeneration("Falha temporária")).toMatchObject({
      status: "error",
      errorMessage: "Falha temporária",
    });
  });

  it("descarta o progresso temporário quando a resposta é fallback", () => {
    expect(
      resolveAssistantThinking(
        { status: "fallback" } as never,
        null,
        "O modelo vLLM está redigindo a resposta final.",
      ),
    ).toBeNull();
  });
  it("usa um texto genérico para indicar a consulta ao modelo", () => {
    expect(ASSISTANT_STATUS_TEXT).toBe("Consultando o modelo de IA...");
  });

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
    const threadId = "11111111-1111-4111-8111-111111111111";
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
          citations: [
            {
              label: "Manual de modelos",
              detail: "Recuperação híbrida",
              source: "manual",
              sourceId: "manual-models",
              snippet: "Os modelos ativos são mantidos no manual.",
              score: 0.91,
            },
          ],
          visualization: {
            kind: "chart",
            chartType: "bar",
            title: "Disponibilidade",
            categories: ["Produto Alfa"],
            series: [{ name: "Disponibilidade", values: [96] }],
          },
          artifacts: [
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
          contextSummary: "",
        };

        return new Response(
          `event: delta\ndata: ${JSON.stringify({ content: "Resposta parcial" })}\n\n` +
            `event: result\ndata: ${JSON.stringify(payload)}\n\n`,
          {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
          },
        );
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
    expect(screen.getByTestId("messages-list")).toHaveTextContent("manual:manual-models");
    expect(screen.getByTestId("messages-list")).toHaveTextContent("chart");
    expect(screen.getByTestId("messages-list")).toHaveTextContent("artifacts=1");
  });

  it("offers retry after a failed assistant stream", async () => {
    const threadId = "22222222-2222-4222-8222-222222222222";
    const thread = {
      id: threadId,
      title: "Pergunta inicial",
      lastMessagePreview: "Pergunta inicial",
      messageCount: 0,
      lastMessageAt: "2026-08-04T12:00:00.000Z",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };
    let streamCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && requestUrl.pathname.endsWith("/examples")) {
        return jsonResponse({ success: true, data: { examples: [] } });
      }
      if (method === "GET" && requestUrl.pathname.endsWith("/threads")) {
        return jsonResponse({ success: true, data: { threads: [] } });
      }
      if (method === "GET" && requestUrl.pathname.endsWith("/status")) {
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
      if (method === "POST" && requestUrl.pathname.endsWith("/threads")) {
        return jsonResponse({ success: true, data: { thread } });
      }
      if (method === "POST" && requestUrl.pathname.endsWith("/messages/stream")) {
        streamCalls += 1;
        if (streamCalls === 1) {
          return new Response('event: error\ndata: {"content":"Falha temporária"}\n\n', {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          });
        }
        const payload = {
          threadId,
          thread,
          messageContent: "Resposta recuperada",
          answer: "Resposta recuperada",
          scope: "general",
          isInScope: true,
          refusalReason: null,
          suggestedQuestions: [],
          citations: [],
          contextSummary: "",
        };
        return new Response(`event: result\ndata: ${JSON.stringify(payload)}\n\n`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistantPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Perguntar" }));

    const retryButton = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.getByTestId("messages-list")).toHaveTextContent(
      "Não foi possível consultar o assistente.",
    );
    expect(screen.getByTestId("messages-list")).toHaveTextContent("error");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId("messages-list")).toHaveTextContent("Resposta recuperada");
    });
    expect(streamCalls).toBe(2);
  });

  it("deletes a newly sent message using the id persisted by the backend", async () => {
    const threadId = "33333333-3333-4333-8333-333333333333";
    const persistedUserMessageId = "44444444-4444-4444-8444-444444444444";
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

      if (method === "GET" && requestUrl.pathname.endsWith("/examples")) {
        return jsonResponse({ success: true, data: { examples: [] } });
      }
      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/threads") {
        return jsonResponse({ success: true, data: { threads: [] } });
      }
      if (method === "GET" && requestUrl.pathname.endsWith("/status")) {
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
      if (method === "POST" && requestUrl.pathname.endsWith("/threads")) {
        return jsonResponse({ success: true, data: { thread } });
      }
      if (method === "POST" && requestUrl.pathname.endsWith("/messages/stream")) {
        const payload = {
          threadId,
          thread,
          userMessageId: persistedUserMessageId,
          assistantMessageId: "55555555-5555-4555-8555-555555555555",
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
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      if (method === "DELETE" && requestUrl.pathname ===
        `/api/admin/ai-assistant/threads/${threadId}/messages/${persistedUserMessageId}`) {
        return jsonResponse({ success: true, data: { deleted: true } });
      }
      if (method === "GET" && requestUrl.pathname ===
        `/api/admin/ai-assistant/threads/${threadId}`) {
        return jsonResponse({ success: true, data: { thread, messages: [] } });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistantPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Perguntar" }));

    const deleteButton = await screen.findByRole("button", { name: "Excluir mensagem" });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/ai-assistant/threads/${threadId}/messages/${persistedUserMessageId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("removes the selected message and later responses from the visible chat immediately", async () => {
    const threadId = "66666666-6666-4666-8666-666666666666";
    const firstUserMessageId = "77777777-7777-4777-8777-777777777777";
    const firstAssistantMessageId = "88888888-8888-4888-8888-888888888888";
    const deletedUserMessageId = "99999999-9999-4999-8999-999999999999";
    const laterAssistantMessageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const thread = {
      id: threadId,
      title: "Conversa com histórico",
      lastMessagePreview: "Resposta posterior",
      messageCount: 4,
      lastMessageAt: "2026-08-04T12:03:00.000Z",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:03:00.000Z",
    };
    const messages = [
      {
        id: firstUserMessageId,
        threadId,
        senderType: "user",
        senderUserId: "user-1",
        senderName: "User One",
        content: "Primeira pergunta",
        createdAt: "2026-08-04T12:00:00.000Z",
      },
      {
        id: firstAssistantMessageId,
        threadId,
        senderType: "assistant",
        senderUserId: null,
        senderName: "Assistente de IA",
        content: "Primeira resposta",
        citations: [],
        createdAt: "2026-08-04T12:01:00.000Z",
      },
      {
        id: deletedUserMessageId,
        threadId,
        senderType: "user",
        senderUserId: "user-1",
        senderName: "User One",
        content: "Pergunta a excluir",
        createdAt: "2026-08-04T12:02:00.000Z",
      },
      {
        id: laterAssistantMessageId,
        threadId,
        senderType: "assistant",
        senderUserId: null,
        senderName: "Assistente de IA",
        content: "Resposta posterior",
        citations: [],
        createdAt: "2026-08-04T12:03:00.000Z",
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && requestUrl.pathname.endsWith("/examples")) {
        return jsonResponse({ success: true, data: { examples: [] } });
      }
      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/threads") {
        return jsonResponse({ success: true, data: { threads: [thread] } });
      }
      if (method === "GET" && requestUrl.pathname.endsWith("/status")) {
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
      if (method === "GET" && requestUrl.pathname ===
        `/api/admin/ai-assistant/threads/${threadId}`) {
        return jsonResponse({ success: true, data: { thread, messages } });
      }
      if (method === "DELETE" && requestUrl.pathname ===
        `/api/admin/ai-assistant/threads/${threadId}/messages/${deletedUserMessageId}`) {
        return jsonResponse({ success: true, data: { deleted: true } });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistantPage />);

    await waitFor(() => {
      expect(screen.getByTestId("messages-list")).toHaveTextContent("Resposta posterior");
    });
    const deleteButtons = screen.getAllByRole("button", { name: "Excluir mensagem" });
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(screen.getByTestId("messages-list")).not.toHaveTextContent("Pergunta a excluir");
      expect(screen.getByTestId("messages-list")).not.toHaveTextContent("Resposta posterior");
    });
  });

  it("removes a temporary message locally when the backend returns message not found", async () => {
    const threadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const thread = {
      id: threadId,
      title: "Pergunta com falha",
      lastMessagePreview: "Pergunta com falha",
      messageCount: 0,
      lastMessageAt: "2026-08-04T12:00:00.000Z",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && requestUrl.pathname.endsWith("/examples")) {
        return jsonResponse({ success: true, data: { examples: [] } });
      }
      if (method === "GET" && requestUrl.pathname === "/api/admin/ai-assistant/threads") {
        return jsonResponse({ success: true, data: { threads: [] } });
      }
      if (method === "GET" && requestUrl.pathname.endsWith("/status")) {
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
      if (method === "POST" && requestUrl.pathname.endsWith("/threads")) {
        return jsonResponse({ success: true, data: { thread } });
      }
      if (method === "POST" && requestUrl.pathname.endsWith("/messages/stream")) {
        const payload = {
          threadId,
          thread,
          messageContent: "Resposta indisponível",
          answer: "Resposta indisponível",
          scope: "general",
          isInScope: true,
          refusalReason: null,
          suggestedQuestions: [],
          citations: [],
          contextSummary: "",
        };
        return new Response(`event: result\ndata: ${JSON.stringify(payload)}\n\n`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      if (method === "DELETE" && requestUrl.pathname.startsWith(
        `/api/admin/ai-assistant/threads/${threadId}/messages/`,
      )) {
        return jsonResponse(
          { success: false, error: "Mensagem não encontrada." },
          404,
        );
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistantPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Perguntar" }));

    await waitFor(() => {
      expect(screen.getByTestId("messages-list")).toHaveTextContent("Resposta indisponível");
    });
    fireEvent.click(screen.getByRole("button", { name: "Excluir mensagem" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(screen.queryByTestId("messages-list")).toBeNull();
    });
  });
});
