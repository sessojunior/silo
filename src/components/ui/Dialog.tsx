import React, { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
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

  // Fecha ao pressionar ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Fecha ao clicar fora
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    // Só fecha se o clique foi realmente fora do conteúdo
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  if (!open) return null;

  const WIDTH_MAP: Record<NonNullable<DialogProps["size"]>, string> = {
    sm: "400px",
    md: "640px",
    lg: "800px",
    xl: "960px",
  };
  const panelWidth = WIDTH_MAP[size] ?? WIDTH_MAP.sm;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <div
        ref={contentRef}
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg max-w-full w-[90vw] animate-fade-in relative flex flex-col"
        style={{ maxWidth: panelWidth }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
}
