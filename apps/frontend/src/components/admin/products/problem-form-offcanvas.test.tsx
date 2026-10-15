import { render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProblemFormOffcanvas from "./problem-form-offcanvas";

let lastMarkdownEditorOptions:
  | { minHeight?: string; maxHeight?: string }
  | undefined;

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    children,
    footerActions,
  }: {
    open: boolean;
    children: ReactNode;
    footerActions?: ReactNode;
  }) {
    if (!open) return null;
    return (
      <section role="dialog">
        {children}
        {footerActions}
      </section>
    );
  },
}));

vi.mock("@/components/ui/markdown-editor", () => ({
  default: function MockMarkdownEditor({
    options,
  }: {
    options?: { minHeight?: string; maxHeight?: string };
  }) {
    lastMarkdownEditorOptions = options;
    return (
      <div
        data-testid="problem-markdown-editor"
        data-min-height={options?.minHeight}
        data-max-height={options?.maxHeight}
      />
    );
  },
}));

vi.mock("@/components/ui/input", () => ({
  default: function MockInput() {
    return <input aria-label="problem-title" />;
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
    style,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
    void style;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock("@/components/ui/select", () => ({
  default: function MockSelect() {
    return <select aria-label="problem-category" />;
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

vi.mock("@/components/ui/upload-button-local", () => ({
  default: function MockUploadButtonLocal() {
    return null;
  },
}));

vi.mock("next/image", () => ({
  default: function MockImage() {
    return null;
  },
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

describe("ProblemFormOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a compact description editor", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(
      <ProblemFormOffcanvas
        open
        onClose={vi.fn()}
        editing={null}
        formTitle=""
        setFormTitle={vi.fn()}
        formDescription=""
        setFormDescription={vi.fn()}
        formCategoryId={null}
        setFormCategoryId={vi.fn()}
        onSubmit={vi.fn()}
        formLoading={false}
        formError={null}
        form={{ field: null, message: null }}
        images={[]}
        onDeleteProblem={vi.fn()}
        deleteDialogOpen={false}
        setDeleteDialogOpen={vi.fn()}
        deleteLoading={false}
        deleteImageId={null}
        setDeleteImageId={vi.fn()}
        deleteImageLoading={false}
        lightboxOpen={false}
        setLightboxOpen={vi.fn()}
        lightboxImage={null}
        setLightboxImage={vi.fn()}
        onImagesUpdate={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByTestId("problem-markdown-editor")).toHaveAttribute(
      "data-min-height",
      "180px",
    );
    expect(screen.getByTestId("problem-markdown-editor")).toHaveAttribute(
      "data-max-height",
      "180px",
    );
  });

  it("keeps the editor options stable while the form rerenders", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const props = {
      open: true,
      onClose: vi.fn(),
      editing: null,
      formTitle: "",
      setFormTitle: vi.fn(),
      formDescription: "",
      setFormDescription: vi.fn(),
      formCategoryId: null,
      setFormCategoryId: vi.fn(),
      onSubmit: vi.fn(),
      formLoading: false,
      formError: null,
      form: { field: null, message: null },
      images: [],
      onDeleteProblem: vi.fn(),
      deleteDialogOpen: false,
      setDeleteDialogOpen: vi.fn(),
      deleteLoading: false,
      deleteImageId: null,
      setDeleteImageId: vi.fn(),
      deleteImageLoading: false,
      lightboxOpen: false,
      setLightboxOpen: vi.fn(),
      lightboxImage: null,
      setLightboxImage: vi.fn(),
      onImagesUpdate: vi.fn(async () => undefined),
    };

    const { rerender } = render(<ProblemFormOffcanvas {...props} />);
    const initialOptions = lastMarkdownEditorOptions;

    rerender(<ProblemFormOffcanvas {...props} formTitle="Er" />);

    expect(lastMarkdownEditorOptions).toBe(initialOptions);
  });
});
