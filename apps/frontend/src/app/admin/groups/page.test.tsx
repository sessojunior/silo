import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { GroupDto as Group } from "@silo/engine/contracts/dto/groups";
import GroupsPage from "./page";

interface ShellMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

interface DialogMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
}

vi.mock("@/context/user-context", () => ({
  useUser: () => ({
    isAdmin: true,
    loading: false,
  }),
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    title,
    children,
    footerActions,
    onClose,
  }: ShellMockProps) {
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

vi.mock("@/components/ui/dialog", () => ({
  default: function MockDialog({ open, title, children, onClose }: DialogMockProps) {
    if (!open) {
      return null;
    }

    const accessibleName = typeof title === "string" ? title : undefined;

    return (
      <section role="dialog" aria-label={accessibleName}>
        <div>{title}</div>
        <div>{children}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/admin/groups/group-users-section", () => ({
  default: function MockGroupUsersSection() {
    return null;
  },
}));

vi.mock("@/components/admin/groups/user-selector-offcanvas", () => ({
  default: function MockUserSelectorOffcanvas() {
    return null;
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

function createGroupsFetchMock(initialGroups: Group[]) {
  const groupsPathname = new URL(
    config.getApiUrl("/api/admin/groups"),
    "http://localhost",
  ).pathname;
  const usersPathname = new URL(
    config.getApiUrl("/api/admin/users"),
    "http://localhost",
  ).pathname;

  let groups = initialGroups.map((group) => ({ ...group }));
  let nextGroupSequence = groups.length + 1;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname === groupsPathname) {
      if (method === "GET") {
        return jsonResponse({
          success: true,
          data: { items: groups },
        });
      }

      if (method === "POST") {
        const body = parseJsonBody(init?.body);

        expect(body).toMatchObject({
          name: "Grupo Beta",
          description: "Grupo de teste",
          icon: "icon-[lucide--users]",
          color: "#2563EB",
          active: true,
          isDefault: false,
        });

        const newGroup: Group = {
          id: `group-${nextGroupSequence}`,
          name: "Grupo Beta",
          description: "Grupo de teste",
          icon: "icon-[lucide--users]",
          color: "#2563EB",
          role: "user",
          active: true,
          isDefault: false,
          userCount: 0,
          createdAt: "2025-05-20T00:00:00.000Z",
          updatedAt: "2025-05-20T00:00:00.000Z",
        };

        groups = [...groups, newGroup];
        nextGroupSequence += 1;

        return jsonResponse({ success: true, message: "Grupo criado com sucesso." }, 201);
      }

      if (method === "PUT") {
        const body = parseJsonBody(init?.body);
        const groupId = String(body.id);

        expect(body).toMatchObject({
          id: groupId,
          name: "Grupo Alfa Revisado",
          description: "Grupo ajustado",
          icon: "icon-[lucide--shield-check]",
          color: "#7C3AED",
          active: true,
          isDefault: false,
        });

        groups = groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                name: "Grupo Alfa Revisado",
                description: "Grupo ajustado",
                updatedAt: "2025-05-21T00:00:00.000Z",
              }
            : group,
        );

        return jsonResponse({ success: true, message: "Grupo atualizado com sucesso." });
      }

      if (method === "DELETE") {
        const id = requestUrl.searchParams.get("id");

        groups = groups.filter((group) => group.id !== id);
        return jsonResponse({ success: true, message: "Grupo excluído com sucesso." });
      }
    }

    if (requestUrl.pathname === usersPathname && method === "GET") {
      return jsonResponse({ success: true, data: { total: 7, items: [] } });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return {
    fetchMock,
    getGroups: () => groups,
  };
}

const initialGroup: Group = {
  id: "group-1",
  name: "Grupo Alfa",
  description: "Grupo principal",
  icon: "icon-[lucide--shield-check]",
  color: "#7C3AED",
  role: "user",
  active: true,
  isDefault: false,
  userCount: 3,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("GroupsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads, creates, updates and deletes groups through the page flow", async () => {
    const { fetchMock, getGroups } = createGroupsFetchMock([initialGroup]);
    vi.stubGlobal("fetch", fetchMock);

    render(<GroupsPage />);

    await screen.findByText("Grupo Alfa");

    fireEvent.click(screen.getByRole("button", { name: /novo grupo/i }));

    const createDialog = await screen.findByRole("dialog", { name: "Novo Grupo" });
    fireEvent.change(within(createDialog).getByPlaceholderText("Digite o nome do grupo"), {
      target: { value: "Grupo Beta" },
    });
    fireEvent.change(within(createDialog).getByPlaceholderText("Descrição opcional do grupo"), {
      target: { value: "Grupo de teste" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /criar grupo/i }));

    await waitFor(() => {
      expect(screen.getByText("Grupo Beta")).toBeInTheDocument();
    });

    expect(getGroups()).toHaveLength(2);

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/groups"), "http://localhost").pathname &&
        init?.method === "POST",
    );
    expect(createCall).toBeDefined();

    const groupRow = screen.getByText("Grupo Alfa").closest("tr");
    expect(groupRow).not.toBeNull();

    fireEvent.click(within(groupRow as HTMLTableRowElement).getByTitle("Editar Grupo"));

    const editDialog = await screen.findByRole("dialog", { name: "Editar Grupo" });
    fireEvent.change(within(editDialog).getByPlaceholderText("Digite o nome do grupo"), {
      target: { value: "Grupo Alfa Revisado" },
    });
    fireEvent.change(within(editDialog).getByPlaceholderText("Descrição opcional do grupo"), {
      target: { value: "Grupo ajustado" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /atualizar grupo/i }));

    await waitFor(() => {
      expect(screen.getByText("Grupo Alfa Revisado")).toBeInTheDocument();
    });

    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/groups"), "http://localhost").pathname &&
        init?.method === "PUT",
    );

    expect(updateCall).toBeDefined();
    const updateBody = parseJsonBody(updateCall?.[1]?.body);
    expect(updateBody).toMatchObject({
      id: "group-1",
      name: "Grupo Alfa Revisado",
      description: "Grupo ajustado",
    });
    expect(getGroups()[0]?.name).toBe("Grupo Alfa Revisado");

    const deleteButton = screen.getAllByTitle("Excluir Grupo")[0];
    expect(deleteButton).toBeDefined();

    fireEvent.click(deleteButton);

    const deleteDialog = await screen.findByRole("dialog", { name: "Confirmar exclusão" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /excluir grupo/i }));

    await waitFor(() => {
      expect(screen.queryByText("Grupo Alfa Revisado")).not.toBeInTheDocument();
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/groups?id=group-1"), "http://localhost").pathname &&
        init?.method === "DELETE",
    );

    expect(deleteCall).toBeDefined();
    expect(getGroups()).toHaveLength(1);
  });
});