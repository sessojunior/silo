import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import GroupDeleteDialog from "./group-delete-dialog";

interface DialogMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
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

function createDeleteFetchMock() {
  const groupsPathname = new URL(
    config.getApiUrl("/api/admin/groups?id=group-1"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");

    expect(requestUrl.pathname).toBe(groupsPathname);
    expect(requestUrl.search).toBe("?id=group-1");
    expect((init?.method ?? "GET").toUpperCase()).toBe("DELETE");

    return jsonResponse({ success: true, message: "Grupo excluído com sucesso." });
  });

  return { fetchMock };
}

const defaultGroup: GroupRecord = {
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

describe("GroupDeleteDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes a group through the query-string API contract", async () => {
    const { fetchMock } = createDeleteFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GroupDeleteDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        group={defaultGroup}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir grupo/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});