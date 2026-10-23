import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import { config } from "@/lib/config";
import ProceduresPage from "./page";

vi.mock("@silo/engine/format/toast", () => ({ toast: vi.fn() }));
vi.mock("@/context/user-context", () => ({
  useUser: () => ({ isAdmin: true, hasPermission: () => true }),
}));
vi.mock("@/components/ui/loading-spinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

const procedure: GeneralProcedureDto = {
  id: "procedure-1",
  title: "Reiniciar serviço",
  category: "Infraestrutura",
  content: "## Passos\n\n1. Verifique o status.\n2. Reinicie o serviço.",
  active: true,
  userId: "user-1",
  createdAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
  attachments: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProceduresPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lista procedimento e envia a criação pelo endpoint dedicado", async () => {
    let procedures: GeneralProcedureDto[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      if (requestUrl.pathname !== new URL(config.getApiUrl("/api/procedures"), "http://localhost").pathname) {
        throw new Error(`Unexpected request ${requestUrl.pathname}`);
      }
      if ((init?.method ?? "GET") === "POST") {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body).toMatchObject({ title: "Novo procedimento", category: "Operação", active: true });
        procedures = [procedure];
        return jsonResponse({ success: true, data: { procedure } }, 201);
      }
      return jsonResponse({ success: true, data: { items: procedures } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProceduresPage />);
    await waitFor(() => expect(screen.getByText("Nenhum procedimento encontrado.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Novo procedimento" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Título/ }), { target: { value: "Novo procedimento" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Categoria" }), { target: { value: "Operação" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Conteúdo/ }), { target: { value: "## Passos" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar procedimento" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/procedures"),
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
