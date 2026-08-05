import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import UserDeleteDialog from "./user-delete-dialog";

interface DialogMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
}

interface AuthUserLike {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createDeleteFetchMock() {
  const usersPathname = new URL(
    config.getApiUrl("/api/admin/users?id=user-1"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");

    expect(requestUrl.pathname).toBe(usersPathname);
    expect(requestUrl.search).toBe("?id=user-1");
    expect((init?.method ?? "GET").toUpperCase()).toBe("DELETE");

    return jsonResponse({ success: true, message: "Usuário excluído com sucesso." });
  });

  return { fetchMock };
}

const user: AuthUserLike = {
  id: "user-1",
  name: "Usuário Alfa",
  email: "alfa@inpe.br",
  emailVerified: true,
  isActive: true,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("UserDeleteDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes a user through the query-string API contract", async () => {
    const { fetchMock } = createDeleteFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UserDeleteDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        user={user as AuthUserLike}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir usuário/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});