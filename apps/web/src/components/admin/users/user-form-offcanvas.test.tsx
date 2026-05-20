import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import UserFormOffcanvas from "./user-form-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

interface GroupDto {
  id: string;
  name: string;
  icon: string;
  color: string;
  role: string;
  active: boolean;
  isDefault: boolean;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AuthUserLike {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  groups?: Array<{
    groupId: string;
    groupName: string;
    groupIcon: string;
    groupColor: string;
  }>;
  groupId?: string;
  needsPasswordSetup?: boolean;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ currentUser: null }),
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

function createUsersFetchMock() {
  const usersPathname = new URL(
    config.getApiUrl("/api/admin/users"),
    "http://localhost",
  ).pathname;

  const resendPathname = new URL(
    config.getApiUrl("/api/admin/users/user-1/resend-password-setup"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname === usersPathname) {
      if (method === "POST") {
        return jsonResponse({
          success: true,
          data: { id: "user-new" },
          message: "Usuário criado com sucesso.",
        }, 201);
      }

      if (method === "PUT") {
        return jsonResponse({
          success: true,
          data: { id: "user-1" },
          message: "Usuário atualizado com sucesso.",
        });
      }

      if (method === "DELETE") {
        expect(requestUrl.search).toBe("?id=user-1");
        return jsonResponse({ success: true, message: "Usuário excluído com sucesso." });
      }

      throw new Error(`Unexpected method: ${method}`);
    }

    if (requestUrl.pathname === resendPathname) {
      expect(method).toBe("POST");
      return jsonResponse({
        success: true,
        message: "Código OTP para definição de senha reenviado.",
      });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return { fetchMock };
}

const groups: GroupDto[] = [
  {
    id: "group-1",
    name: "Administradores",
    icon: "icon-[lucide--shield-check]",
    color: "#2563EB",
    role: "admin",
    active: true,
    isDefault: true,
    description: "Grupo administrativo",
    userCount: 2,
    createdAt: "2025-05-19T00:00:00.000Z",
    updatedAt: "2025-05-20T00:00:00.000Z",
  },
  {
    id: "group-2",
    name: "Operações",
    icon: "icon-[lucide--users]",
    color: "#7C3AED",
    role: "user",
    active: true,
    isDefault: false,
    description: "Grupo operacional",
    userCount: 4,
    createdAt: "2025-05-19T00:00:00.000Z",
    updatedAt: "2025-05-20T00:00:00.000Z",
  },
];

const editingUser: AuthUserLike = {
  id: "user-1",
  name: "Usuário Alfa",
  email: "alfa@inpe.br",
  emailVerified: true,
  isActive: true,
  needsPasswordSetup: true,
  groups: [
    {
      groupId: "group-1",
      groupName: "Administradores",
      groupIcon: "shield-check",
      groupColor: "#2563EB",
    },
  ],
};

describe("UserFormOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a user through the JSON API contract", async () => {
    const { fetchMock } = createUsersFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UserFormOffcanvas
        isOpen
        onClose={onClose}
        user={null}
        groups={groups}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Digite o nome do usuário"), {
      target: { value: "Novo Usuário" },
    });
    fireEvent.change(screen.getByPlaceholderText("Digite o email do usuário"), {
      target: { value: "NOVO.USUARIO@INPE.BR" },
    });
    fireEvent.click(screen.getByLabelText("Operações"));
    await waitFor(() => {
      expect((screen.getByLabelText("Operações") as HTMLInputElement).checked).toBe(true);
    });
    const createForm = document.getElementById("user-form");
    expect(createForm).not.toBeNull();
    fireEvent.submit(createForm as HTMLFormElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const createBody = parseJsonBody(
      (fetchMock.mock.calls[0]?.[1]?.body as BodyInit | null | undefined) ?? null,
    );
    expect(createBody).toEqual({
      name: "Novo Usuário",
      email: "novo.usuario@inpe.br",
      emailVerified: false,
      isActive: true,
      groupId: "group-2",
      groups: [{ groupId: "group-2" }],
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates a user and can resend password setup", async () => {
    const { fetchMock } = createUsersFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UserFormOffcanvas
        isOpen
        onClose={onClose}
        user={editingUser as AuthUserLike}
        groups={groups}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Digite o nome do usuário"), {
      target: { value: "Usuário Alfa Atualizado" },
    });
    fireEvent.change(screen.getByPlaceholderText("Digite o email do usuário"), {
      target: { value: "ALFA@INPE.BR" },
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Administradores") as HTMLInputElement).checked).toBe(true);
    });
    const updateForm = document.getElementById("user-form");
    expect(updateForm).not.toBeNull();
    fireEvent.submit(updateForm as HTMLFormElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const updateBody = parseJsonBody(
      (fetchMock.mock.calls[0]?.[1]?.body as BodyInit | null | undefined) ?? null,
    );
    expect(updateBody).toEqual({
      id: "user-1",
      name: "Usuário Alfa Atualizado",
      email: "alfa@inpe.br",
      emailVerified: true,
      isActive: true,
      groupId: "group-1",
      groups: [{ groupId: "group-1" }],
    });

    fireEvent.click(screen.getByRole("button", { name: /reenviar email para definir senha/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(new URL(String(fetchMock.mock.calls[1]?.[0]), "http://localhost").pathname).toBe(
      new URL(config.getApiUrl("/api/admin/users/user-1/resend-password-setup"), "http://localhost").pathname,
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});