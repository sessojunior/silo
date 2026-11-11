import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const FOCUSABLE_SELECTOR =
  'a[href],button,textarea,input,select,[tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

// Componente de modal genérico
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "sm",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef("");
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha ao pressionar ESC
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        dialogRef.current.focus();
        e.preventDefault();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && mounted && dialogRef.current) {
      const focusableElements = getFocusableElements(dialogRef.current);
      (focusableElements[0] ?? dialogRef.current).focus();
    }
    if (!open && lastFocusedRef.current) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [open, mounted]);

  // Fecha ao clicar fora
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    // Só fecha se o clique foi realmente fora do conteúdo
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  if (!open || ! mounted) return null;

  const WIDTH_MAP: Record<NonNullable<DialogProps["size"]>, string> = {
    sm: "400px",
    md: "640px",
    lg: "800px",
    xl: "960px",
  };
  const panelWidth = WIDTH_MAP[size] ?? WIDTH_MAP.sm;

  const content = (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        ref={contentRef}
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg max-w-full w-[90vw] animate-fade-in relative flex flex-col"
        style={{ maxWidth: panelWidth }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="min-w-0">
            {title && (
              <h2
                id={titleId}
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                id={descriptionId}
                className="text-sm text-zinc-600 dark:text-zinc-400"
              >
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full flex items-center justify-center size-8 -mr-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Fechar"
          >
            <span className="icon-[lucide--x] size-4" />
          </button>
        </div>
        <div className="text-zinc-900 dark:text-zinc-100 flex-1 overflow-hidden max-h-[75vh]">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
