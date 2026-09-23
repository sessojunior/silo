import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import SolutionFormModal from "./solution-form-modal";

vi.mock("@/components/ui/modal", () => ({
  default: function MockModal({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: ReactNode;
  }) {
    if (!isOpen) return null;
    return (
      <section role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </section>
    );
  },
}));

vi.mock("@/components/ui/label", () => ({
  default: function MockLabel({ children }: { children: ReactNode }) {
    return <label>{children}</label>;
  },
}));

vi.mock("@/components/ui/button", () => ({
  default: function MockButton({
    children,
    style: _style,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
    return <button {...props}>{children}</button>;
  },
}));

vi.mock("@/components/ui/markdown-editor", () => ({
  default: function MockMarkdownEditor({
    value,
  }: {
    value: string;
  }) {
    return <textarea aria-label="Descrição da solução" value={value} readOnly />;
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  default: function MockDialog() {
    return null;
  },
}));

vi.mock("@/components/ui/lightbox", () => ({
  default: function MockLightbox() {
    return null;
  },
}));

vi.mock("next/image", () => ({
  default: function MockImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
    return <img {...props} />;
  },
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

interface UploadMockProps {
  onClientUploadComplete?: (
    result:
      | { url: string }
      | { url: string }[],
  ) => void;
  content?: { button?: ReactNode };
}

vi.mock("@/components/ui/upload-button-local", () => ({
  default: function MockUploadButtonLocal({
    onClientUploadComplete,
    content,
  }: UploadMockProps) {
    return (
      <button
        type="button"
        onClick={() =>
          onClientUploadComplete?.([{ url: "/uploads/solutions/example.webp" }])
        }
      >
        {content?.button ?? "Adicionar"}
      </button>
    );
  },
}));

function renderModal(
  overrides: Partial<React.ComponentProps<typeof SolutionFormModal>> = {},
) {
  return render(
    <SolutionFormModal
      isOpen
      onClose={vi.fn()}
      mode="create"
      editingSolution={null}
      solutionDescription="Descrição"
      setSolutionDescription={vi.fn()}
      setSolutionImage={vi.fn()}
      solutionImagePreview={null}
      setSolutionImagePreview={vi.fn()}
      solutionLoading={false}
      solutionError={null}
      setSolutionError={vi.fn()}
      onSubmit={vi.fn(async () => undefined)}
      onDeleteSolution={vi.fn()}
      onUpdateSolutions={vi.fn(async () => undefined)}
      onUpdateEditingSolution={vi.fn()}
      problemId="problem-1"
      solutionImages={[]}
      onSolutionImagesUpdate={vi.fn(async () => undefined)}
      deleteImageId={null}
      setDeleteImageId={vi.fn()}
      deleteImageLoading={false}
      lightboxOpen={false}
      setLightboxOpen={vi.fn()}
      lightboxImage={null}
      setLightboxImage={vi.fn()}
      {...overrides}
    />,
  );
}

describe("SolutionFormModal", () => {
  it("exibe o uploader ao criar uma solução e guarda a imagem enviada", () => {
    const setSolutionImagePreview = vi.fn();

    renderModal({ setSolutionImagePreview });

    expect(screen.getByText("Imagem da solução")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /adicionar/i })[0]);

    expect(setSolutionImagePreview).toHaveBeenCalledWith(
      "/uploads/solutions/example.webp",
    );
  });

  it("mantém a galeria de imagens disponível ao editar uma solução", () => {
    renderModal({
      mode: "edit",
      editingSolution: {
        id: "solution-1",
        replyId: null,
        date: new Date(),
        description: "Descrição",
        verified: false,
        user: { id: "user-1", name: "Usuário", image: "" },
        image: null,
        images: [],
        isMine: true,
      },
    });

    expect(screen.getByText("Imagens da solução")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adicionar/i })).toBeInTheDocument();
  });
});
