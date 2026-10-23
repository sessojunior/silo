import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import {
  ProcedureFormOffcanvas,
  type ProcedureForm,
} from "./procedure-form-offcanvas";

let lastCheckboxProps:
  | {
      id?: string;
      name?: string;
      label?: string;
      checked?: boolean;
    }
  | undefined;

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) {
    return open ? <section role="dialog">{children}</section> : null;
  },
}));

vi.mock("@/components/ui/markdown-editor", () => ({
  default: function MockMarkdownEditor({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options?: { minHeight?: string; maxHeight?: string };
  }) {
    return (
      <textarea
        aria-label="ConteÃºdo (Markdown)"
        data-testid="procedure-markdown-editor"
        data-min-height={options?.minHeight}
        data-max-height={options?.maxHeight}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  },
}));

vi.mock("@/components/ui/input-checkbox", () => ({
  default: function MockInputCheckbox(props: {
    id: string;
    name: string;
    label: string;
    checked?: boolean;
  }) {
    lastCheckboxProps = props;
    return <span data-testid="procedure-active-checkbox" />;
  },
}));

describe("ProcedureFormOffcanvas", () => {
  it("usa o editor Markdown compartilhado e um acionador de anexo estilizado", () => {
    const form: ProcedureForm = {
      title: "",
      category: "",
      content: "",
      active: true,
    };
    const procedure: GeneralProcedureDto = {
      id: "procedure-1",
      title: "Reiniciar serviÃ§o",
      category: "Infraestrutura",
      content: "ConteÃºdo",
      active: true,
      userId: "user-1",
      createdAt: "2026-10-23T10:00:00Z",
      updatedAt: "2026-10-23T10:00:00Z",
      attachments: [],
    };

    render(
      <ProcedureFormOffcanvas
        open
        onClose={vi.fn()}
        editing={procedure}
        form={form}
        setForm={vi.fn()}
        onSubmit={vi.fn()}
        saving={false}
        canManage
        onDelete={vi.fn()}
        description=""
        setDescription={vi.fn()}
        fileInputKey={0}
        uploading={false}
        onUpload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onReprocessAttachment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("procedure-markdown-editor")).toHaveAttribute(
      "data-min-height",
      "180px",
    );
    expect(
      screen.getByRole("button", { name: "Adicionar arquivo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Choose File No file chosen"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("procedure-active-checkbox")).toBeInTheDocument();
    expect(lastCheckboxProps).toMatchObject({
      id: "procedure-active",
      name: "active",
      checked: true,
    });
  });
});
