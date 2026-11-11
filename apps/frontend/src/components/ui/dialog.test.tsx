import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Dialog from "./dialog";

describe("Dialog", () => {
  it("foca o primeiro controle, fecha pelo backdrop e expõe o título", async () => {
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose} title="Excluir item" description="Confirme a exclusão.">
        <button type="button">Excluir</button>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Excluir item" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Confirme a exclusão.");
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mantém o foco dentro, fecha com Escape e devolve o foco ao acionador", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Abrir</button>
        <Dialog open={false} onClose={onClose} title="Confirmar">
          <button type="button">Confirmar</button>
        </Dialog>
      </>,
    );

    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    rerender(
      <>
        <button type="button">Abrir</button>
        <Dialog open onClose={onClose} title="Confirmar">
          <button type="button">Confirmar</button>
        </Dialog>
      </>,
    );

    const closeButton = await screen.findByRole("button", { name: "Fechar" });
    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <button type="button">Abrir</button>
        <Dialog open={false} onClose={onClose} title="Confirmar">
          <button type="button">Confirmar</button>
        </Dialog>
      </>,
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
