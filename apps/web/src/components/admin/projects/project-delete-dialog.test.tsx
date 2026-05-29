import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/types/projects";
import ProjectDeleteDialog from "./project-delete-dialog";

interface DialogMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
}

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

const project: Project = {
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

describe("ProjectDeleteDialog", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("confirms deletion and closes the dialog", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectDeleteDialog
        isOpen
        onClose={onClose}
        project={project}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir projeto/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("project-1");
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});