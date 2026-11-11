import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Modal from "./modal";

describe("Modal", () => {
  it("expõe semântica de diálogo, foca o primeiro controle e fecha pelo backdrop", async () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Detalhes">
        <button type="button">Confirmar</button>
      </Modal>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Detalhes" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Fechar modal" })).toHaveFocus();

    fireEvent.click(dialog.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mantém o foco dentro do modal, fecha com Escape e restaura o foco anterior", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Abrir</button>
        <Modal isOpen={false} onClose={onClose} title="Editar">
          <button type="button">Confirmar</button>
        </Modal>
      </>,
    );

    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    rerender(
      <>
        <button type="button">Abrir</button>
        <Modal isOpen onClose={onClose} title="Editar">
          <button type="button">Confirmar</button>
        </Modal>
      </>,
    );

    const closeButton = await screen.findByRole("button", { name: "Fechar modal" });
    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <button type="button">Abrir</button>
        <Modal isOpen={false} onClose={onClose} title="Editar">
          <button type="button">Confirmar</button>
        </Modal>
      </>,
    );

    await waitFor(() => expect(opener).toHaveFocus(), { timeout: 500 });
  });
});
