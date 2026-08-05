import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/types/projects";
import ProjectFormOffcanvas from "./project-form-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

interface SelectMockProps {
  name: string;
  selected?: string | null;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}

interface MarkdownEditorMockProps {
  value: string;
  onChange: (value: string) => void;
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

vi.mock("@/components/ui/select", () => ({
  default: function MockSelect({ name, selected, options, onChange }: SelectMockProps) {
    return (
      <select
        id={name}
        aria-label={name}
        value={selected ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));

vi.mock("@/components/ui/markdown-editor", () => ({
  default: function MockMarkdownEditor({ value, onChange }: MarkdownEditorMockProps) {
    return (
      <textarea
        aria-label="Descrição Completa"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  },
}));

const baseProject: Project = {
  id: "project-1",
  name: "Projeto Alfa",
  shortDescription: "Resumo do projeto",
  description: "Descrição completa",
  startDate: "2025-05-01",
  endDate: "2025-05-10",
  priority: "medium",
  status: "active",
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

describe("ProjectFormOffcanvas", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("submits a new project through the form contract", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProjectFormOffcanvas
        isOpen
        onClose={onClose}
        project={null}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), {
      target: { value: "Projeto Beta" },
    });
    fireEvent.change(screen.getByLabelText("Descrição Resumida"), {
      target: { value: "Resumo do projeto beta" },
    });
    fireEvent.change(screen.getByLabelText("Descrição Completa"), {
      target: { value: "Descrição completa do projeto beta" },
    });
    fireEvent.change(screen.getByLabelText("status"), {
      target: { value: "paused" },
    });
    fireEvent.change(screen.getByLabelText("priority"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("Data de Início"), {
      target: { value: "2025-05-01" },
    });
    fireEvent.change(screen.getByLabelText("Data de Fim"), {
      target: { value: "2025-05-31" },
    });

    fireEvent.submit(document.getElementById("project-form") as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Projeto Beta",
      shortDescription: "Resumo do projeto beta",
      description: "Descrição completa do projeto beta",
      startDate: "2025-05-01",
      endDate: "2025-05-31",
      priority: "high",
      status: "paused",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes delete callback from the form when editing", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProjectFormOffcanvas
        isOpen
        onClose={onClose}
        project={baseProject}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));

    expect(onDelete).toHaveBeenCalledWith(baseProject);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});