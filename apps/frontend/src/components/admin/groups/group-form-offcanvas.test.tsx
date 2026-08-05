import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import GroupFormOffcanvas from "./group-form-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    title,
    children,
    footerActions,
    onClose,
  }: OffcanvasMockProps) {
    if (!open) {
      return null;
    }

    const accessibleName = typeof title === "string" ? title : undefined;

    return (
      <section role="dialog" aria-label={accessibleName}>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footerActions}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    );
  },
}));

interface GroupRecord {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  role: string;
  active: boolean;
  isDefault: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

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

function createGroupFetchMock() {
  const groupsPathname = new URL(
    config.getApiUrl("/api/admin/groups"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname !== groupsPathname) {
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    }

    if (method === "POST") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        name: "Grupo Beta",
        description: "Grupo de teste",
        icon: "icon-[lucide--users]",
        color: "#2563EB",
        active: false,
        isDefault: true,
      });

      return jsonResponse({ success: true, message: "Grupo criado com sucesso." }, 201);
    }

    if (method === "PUT") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        id: "group-1",
        name: "Grupo Alfa Atualizado",
        description: "Grupo ajustado",
        icon: "icon-[lucide--shield-check]",
        color: "#7C3AED",
        active: false,
        isDefault: false,
      });

      return jsonResponse({ success: true, message: "Grupo atualizado com sucesso." });
    }

    throw new Error(`Unexpected method: ${method}`);
  });

  return { fetchMock };
}

const createGroup: GroupRecord = {
  id: "group-new",
  name: "Grupo Beta",
  description: null,
  icon: "icon-[lucide--users]",
  color: "#2563EB",
  role: "user",
  active: true,
  isDefault: false,
  userCount: 0,
  createdAt: "2025-05-20T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

const updateGroup: GroupRecord = {
  id: "group-1",
  name: "Grupo Alfa",
  description: "Grupo principal",
  icon: "icon-[lucide--shield-check]",
  color: "#7C3AED",
  role: "user",
  active: false,
  isDefault: false,
  userCount: 3,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("GroupFormOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a group through the JSON API contract", async () => {
    const { fetchMock } = createGroupFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GroupFormOffcanvas
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Digite o nome do grupo"), {
      target: { value: createGroup.name },
    });
    fireEvent.change(screen.getByPlaceholderText("Descrição opcional do grupo"), {
      target: { value: "Grupo de teste" },
    });
    fireEvent.click(screen.getByLabelText(/grupo ativo/i));
    fireEvent.click(screen.getByLabelText(/grupo padrão/i));

    fireEvent.click(screen.getByRole("button", { name: /criar grupo/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(new URL(String(requestUrl), "http://localhost").pathname).toBe(
      new URL(config.getApiUrl("/api/admin/groups"), "http://localhost").pathname,
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Grupo Beta",
      description: "Grupo de teste",
      icon: "icon-[lucide--users]",
      color: "#2563EB",
      active: false,
      isDefault: true,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates a group through the JSON API contract", async () => {
    const { fetchMock } = createGroupFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GroupFormOffcanvas
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        group={updateGroup}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Digite o nome do grupo"), {
      target: { value: "Grupo Alfa Atualizado" },
    });
    fireEvent.change(screen.getByPlaceholderText("Descrição opcional do grupo"), {
      target: { value: "Grupo ajustado" },
    });

    fireEvent.click(screen.getByRole("button", { name: /atualizar grupo/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(new URL(String(requestUrl), "http://localhost").pathname).toBe(
      new URL(config.getApiUrl("/api/admin/groups"), "http://localhost").pathname,
    );
    expect(init).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      id: "group-1",
      name: "Grupo Alfa Atualizado",
      description: "Grupo ajustado",
      icon: "icon-[lucide--shield-check]",
      color: "#7C3AED",
      active: false,
      isDefault: false,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});