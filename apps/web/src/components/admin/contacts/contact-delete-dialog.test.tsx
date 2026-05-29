import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import ContactDeleteDialog from "./contact-delete-dialog";

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

interface ContactRecord {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
  phone: string | null;
  image: string | null;
  active: boolean;
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
  const contactsPathname = new URL(
    config.getApiUrl("/api/admin/contacts"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");

    expect(requestUrl.pathname).toBe(contactsPathname);
    expect((init?.method ?? "GET").toUpperCase()).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ id: "contact-1" });

    return jsonResponse({ success: true, message: "Contato excluído com sucesso" });
  });

  return { fetchMock };
}

const contact: ContactRecord = {
  id: "contact-1",
  name: "Contato Alfa",
  role: "Pesquisador Sênior",
  team: "Meteorologia",
  email: "contato.alfa@example.com",
  phone: "(12) 3208-6000",
  image: null,
  active: true,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("ContactDeleteDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes a contact through the JSON API contract", async () => {
    const { fetchMock } = createDeleteFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ContactDeleteDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        contact={contact}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir contato/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});