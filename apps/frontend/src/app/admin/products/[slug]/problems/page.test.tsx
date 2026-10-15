import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { ProductProblemDto } from "@silo/engine/contracts/dto/products";
import ProblemsPage from "./page";

interface ProblemFormMockProps {
  open: boolean;
  onClose: () => void;
  editing: ProductProblemDto | null;
  formTitle: string;
  setFormTitle: (value: string) => void;
  formDescription: string;
  setFormDescription: (value: string) => void;
  formCategoryId: string | null;
  setFormCategoryId: (value: string | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDeleteProblem: () => void;
}

interface SolutionFormMockProps {
  isOpen: boolean;
  editingSolution: { id: string } | null;
  onDeleteSolution: (solution: { id: string }) => void;
}

interface DeleteSolutionDialogMockProps {
  open: boolean;
  onConfirmDelete: () => Promise<void>;
}

interface SimpleMockProps {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "produto-alfa" }),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    currentUser: { id: "user-1" },
  }),
}));

vi.mock("@/components/admin/products/problem-form-offcanvas", () => ({
  default: function MockProblemFormOffcanvas({
    open,
    onClose,
    editing,
    formTitle,
    setFormTitle,
    formDescription,
    setFormDescription,
    formCategoryId,
    setFormCategoryId,
    onSubmit,
    onDeleteProblem,
  }: ProblemFormMockProps) {
    if (!open) {
      return null;
    }

    const title = editing ? "Editar problema" : "Adicionar problema";

    return (
      <section role="dialog" aria-label={title}>
        <form
          onSubmit={(event) => {
            onSubmit(event);
            onClose();
          }}
        >
          <label htmlFor="problem-title">Título</label>
          <input
            id="problem-title"
            value={formTitle}
            onChange={(event) => setFormTitle(event.target.value)}
          />

          <label htmlFor="problem-description">Descrição</label>
          <textarea
            id="problem-description"
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
          />

          <label htmlFor="problem-category">Categoria</label>
          <select
            id="problem-category"
            value={formCategoryId ?? ""}
            onChange={(event) => setFormCategoryId(event.target.value || null)}
          >
            <option value="">Selecione</option>
            <option value="category-1">Categoria 1</option>
          </select>

          <button type="submit">
            {editing ? "Salvar problema" : "Adicionar problema"}
          </button>

          {editing ? (
            <button
              type="button"
              onClick={() => {
                onDeleteProblem();
                onClose();
              }}
            >
              Excluir problema
            </button>
          ) : null}
        </form>
      </section>
    );
  },
}));

vi.mock("@/components/admin/products/solution-form-modal", () => ({
  default: function MockSolutionFormModal({
    isOpen,
    editingSolution,
    onDeleteSolution,
  }: SolutionFormMockProps) {
    if (!isOpen || !editingSolution) return null;
    return (
      <section role="dialog" aria-label="Editar solução">
        <button type="button" onClick={() => onDeleteSolution(editingSolution)}>
          Excluir resposta no modal
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/admin/products/delete-solution-dialog", () => ({
  default: function MockDeleteSolutionDialog({
    open,
    onConfirmDelete,
  }: DeleteSolutionDialogMockProps) {
    if (!open) return null;
    return (
      <button type="button" onClick={() => void onConfirmDelete()}>
        Confirmar exclusão da resposta
      </button>
    );
  },
}));

vi.mock("@/components/admin/products/problem-category-offcanvas", () => ({
  default: function MockProblemCategoryOffcanvas() {
    return null;
  },
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({ open, title, children, onClose }: SimpleMockProps) {
    if (!open) {
      return null;
    }

    return (
      <section role="dialog">
        <div>{title}</div>
        <div>{children}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

vi.mock("@/components/ui/lightbox", () => ({
  default: function MockLightbox() {
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
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (body instanceof FormData) {
    return {
      description: String(body.get("description") ?? ""),
      problemId: String(body.get("problemId") ?? ""),
      id: body.get("id") ? String(body.get("id")) : undefined,
      imageUrl: body.get("imageUrl") ? String(body.get("imageUrl")) : undefined,
    };
  }

  throw new Error("Expected JSON string or FormData body");
}

function createProblemsFetchMock(initialSolutions: Array<Record<string, unknown>> = []) {
  const problemsPathname = new URL(
    config.getApiUrl("/api/admin/products/problems"),
    "http://localhost",
  ).pathname;
  const productPathname = new URL(
    config.getApiUrl("/api/admin/products?slug=produto-alfa"),
    "http://localhost",
  ).pathname;
  const solutionsCountPathname = new URL(
    config.getApiUrl("/api/admin/products/solutions/count"),
    "http://localhost",
  ).pathname;
  const solutionsPathname = new URL(
    config.getApiUrl("/api/admin/products/solutions?problemId=problem-1"),
    "http://localhost",
  ).pathname;
  const imagesPathname = new URL(
    config.getApiUrl("/api/admin/products/images?problemId=problem-1"),
    "http://localhost",
  ).pathname;

  let problems = [
    {
      id: "problem-1",
      productId: "product-1",
      title: "Problema Alfa",
      description: "Descrição inicial do problema alfa para a suíte de testes.",
      problemCategoryId: "category-1",
      categoryName: "Categoria 1",
      categoryColor: "#2563eb",
      createdAt: "2025-05-01T00:00:00.000Z",
      updatedAt: "2025-05-01T00:00:00.000Z",
    },
  ];
  let solutions = [...initialSolutions];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname === productPathname) {
      expect(method).toBe("GET");
      expect(requestUrl.searchParams.get("slug")).toBe("produto-alfa");
      return jsonResponse({ data: { products: [{ id: "product-1" }] } });
    }

    if (requestUrl.pathname === problemsPathname && requestUrl.searchParams.get("slug") === "produto-alfa") {
      expect(method).toBe("GET");
      return jsonResponse({ items: problems });
    }

    if (requestUrl.pathname === solutionsCountPathname) {
      expect(method).toBe("POST");
      const body = parseJsonBody(init?.body);
      expect(body).toEqual({ problemIds: problems.map((problem) => problem.id) });
      const counts = Object.fromEntries(problems.map((problem) => [problem.id, 0]));
      return jsonResponse({ success: true, data: counts });
    }

    if (requestUrl.pathname === solutionsPathname) {
      if (method === "GET") {
        return jsonResponse({ items: solutions });
      }

      if (method === "DELETE") {
        const body = parseJsonBody(init?.body);
        solutions = solutions.filter((solution) => solution.id !== body.id);
        return jsonResponse({ success: true, message: "Solução excluída" });
      }
    }

    if (requestUrl.pathname === imagesPathname) {
      expect(method).toBe("GET");
      return jsonResponse({ items: [] });
    }

    if (requestUrl.pathname === problemsPathname && !requestUrl.searchParams.has("slug")) {
      if (method === "POST") {
        const body = parseJsonBody(init?.body);
        expect(body).toMatchObject({
          productId: "product-1",
          title: "Problema Beta",
          description: "Descrição beta com texto suficiente para validação.",
          problemCategoryId: "category-1",
        });

        const newProblem = {
          id: "problem-2",
          productId: "product-1",
          title: "Problema Beta",
          description: "Descrição beta com texto suficiente para validação.",
          problemCategoryId: "category-1",
          categoryName: "Categoria 1",
          categoryColor: "#2563eb",
          createdAt: "2025-05-02T00:00:00.000Z",
          updatedAt: "2025-05-02T00:00:00.000Z",
        };

        problems = [newProblem, ...problems];
        return jsonResponse({ success: true, message: "Problema cadastrado" });
      }

      if (method === "PUT") {
        const body = parseJsonBody(init?.body);
        expect(body).toMatchObject({
          id: "problem-1",
          title: "Problema Alfa Ajustado",
          description: "Descrição ajustada do problema alfa para a suíte.",
          problemCategoryId: "category-1",
        });

        problems = problems.map((problem) =>
          problem.id === "problem-1"
            ? {
                ...problem,
                title: "Problema Alfa Ajustado",
                description: "Descrição ajustada do problema alfa para a suíte.",
                updatedAt: "2025-05-03T00:00:00.000Z",
              }
            : problem,
        );

        return jsonResponse({ success: true, message: "Problema atualizado" });
      }

      if (method === "DELETE") {
        const body = parseJsonBody(init?.body);
        expect(body).toEqual({ id: "problem-1" });
        problems = problems.filter((problem) => problem.id !== "problem-1");
        return jsonResponse({ success: true, message: "Problema excluído" });
      }
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return { fetchMock };
}

describe("ProblemsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the initial problem list through the API contract", async () => {
    const { fetchMock } = createProblemsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Problema Alfa").length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("creates a problem through the JSON API contract", async () => {
    const { fetchMock } = createProblemsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Problema Alfa").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /adicionar problema/i })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Adicionar problema" });
    fireEvent.change(within(dialog).getByLabelText("Título"), {
      target: { value: "Problema Beta" },
    });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), {
      target: { value: "Descrição beta com texto suficiente para validação." },
    });
    fireEvent.change(within(dialog).getByLabelText("Categoria"), {
      target: { value: "category-1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /adicionar problema/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/products/problems"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Problema Beta").length).toBeGreaterThan(0);
    });
  });

  it("updates and deletes a problem through the JSON API contract", async () => {
    const { fetchMock } = createProblemsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Problema Alfa").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /editar problema/i }));
    const editDialog = await screen.findByRole("dialog", { name: "Editar problema" });
    fireEvent.change(within(editDialog).getByLabelText("Título"), {
      target: { value: "Problema Alfa Ajustado" },
    });
    fireEvent.change(within(editDialog).getByLabelText("Descrição"), {
      target: { value: "Descrição ajustada do problema alfa para a suíte." },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /salvar problema/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/products/problems"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Problema Alfa Ajustado").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /editar problema/i }));
    const deleteDialog = await screen.findByRole("dialog", { name: "Editar problema" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /excluir problema/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/products/problems"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(screen.queryAllByText("Problema Alfa Ajustado")).toHaveLength(0);
    });
  });

  it("deletes only a reply and closes its edit modal", async () => {
    const { fetchMock } = createProblemsFetchMock([
      {
        id: "solution-root",
        replyId: null,
        isMine: true,
        date: "2025-05-01T00:00:00.000Z",
        description: "Solução raiz",
        verified: false,
        user: { id: "user-1", name: "Usuário", image: "" },
        image: null,
        images: [],
      },
      {
        id: "solution-reply",
        replyId: "solution-root",
        date: "2025-05-02T00:00:00.000Z",
        description: "Resposta a excluir",
        verified: false,
        user: { id: "user-1", name: "Usuário", image: "" },
        image: null,
        images: [],
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemsPage />);

    await waitFor(() => {
      expect(screen.getByText("Solução raiz")).toBeInTheDocument();
      expect(screen.getByText("Resposta a excluir")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    const solutionModal = await screen.findByRole("dialog", {
      name: "Editar solução",
    });
    fireEvent.click(
      within(solutionModal).getByRole("button", {
        name: "Excluir resposta no modal",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar exclusão da resposta",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            new URL(String(url), "http://localhost").pathname ===
              new URL(
                config.getApiUrl("/api/admin/products/solutions"),
                "http://localhost",
              ).pathname &&
            init?.method === "DELETE" &&
            parseJsonBody(init.body).id === "solution-reply",
        ),
      ).toBe(true);
    });

    expect(screen.getByText("Solução raiz")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Resposta a excluir")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { name: "Editar solução" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows replies at the root level and does not allow replying to a reply", async () => {
    const { fetchMock } = createProblemsFetchMock([
      {
        id: "solution-root",
        replyId: null,
        isMine: true,
        date: "2025-05-01T00:00:00.000Z",
        description: "Solução raiz",
        verified: false,
        user: { id: "user-2", name: "Outro usuário", image: "" },
        image: null,
        images: [],
      },
      {
        id: "solution-reply",
        replyId: "solution-root",
        date: "2025-05-02T00:00:00.000Z",
        description: "Resposta direta",
        verified: false,
        user: { id: "user-1", name: "Usuário", image: "" },
        image: null,
        images: [],
      },
      {
        id: "legacy-nested-reply",
        replyId: "solution-reply",
        date: "2025-05-03T00:00:00.000Z",
        description: "Resposta legada",
        verified: false,
        user: { id: "user-1", name: "Usuário", image: "" },
        image: null,
        images: [],
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemsPage />);

    await waitFor(() => {
      expect(screen.getByText("Resposta direta")).toBeInTheDocument();
      expect(screen.getByText("Resposta legada")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("button", { name: "Responder" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(3);
  });
});
