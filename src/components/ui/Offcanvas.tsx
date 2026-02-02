"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import Button from "@/components/ui/Button";

const WIDTH_CLASS_MAP: Record<string, string> = {
  sm: "md:w-[320px]",
  md: "md:w-[480px]",
  lg: "md:w-[640px]",
  xl: "md:w-[800px]",
};

type OffcanvasStatus = "idle" | "loading" | "success" | "error";

interface OffcanvasProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg" | "xl" | string;
  zIndex?: number;
  status?: OffcanvasStatus;
  onEdit?: () => void;
  onAdd?: () => void;
  editLabel?: string;
  addLabel?: string;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  contentClassName?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href],button,textarea,input,select,[tabindex]:not([tabindex="-1"])';

let openCount = 0;
let bodyOverflowBackup: string | null = null;

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return nodes.filter(
    (node) =>
      !node.hasAttribute("disabled") &&
      node.getAttribute("aria-hidden") !== "true",
  );
};

export default function Offcanvas({
  open,
  onClose,
  title,
  children,
  side = "right",
  width = "md",
  zIndex = 70,
  status = "idle",
  onEdit,
  onAdd,
  editLabel = "Editar",
  addLabel = "Adicionar",
  headerActions,
  footerActions,
  contentClassName,
}: OffcanvasProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      lastFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setRendered(true);
      requestAnimationFrame(() => setActive(true));
      return;
    }
    setActive(false);
    const timeout = window.setTimeout(() => setRendered(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    openCount += 1;
    if (openCount === 1) {
      bodyOverflowBackup = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      openCount -= 1;
      if (openCount <= 0) {
        document.body.style.overflow = bodyOverflowBackup || "";
        bodyOverflowBackup = null;
        openCount = 0;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        panel.focus();
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || activeElement === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length > 0) {
        focusables[0].focus();
        return;
      }
      panelRef.current.focus();
    }
    if (!open && lastFocusedRef.current) {
      lastFocusedRef.current.focus();
    }
  }, [open]);

  if (!mounted || !rendered) return null;

  const widthClass =
    WIDTH_CLASS_MAP[width as keyof typeof WIDTH_CLASS_MAP] || width || "md:w-[480px]";

  const panelTranslateClass =
    side === "right"
      ? active
        ? "translate-x-0"
        : "translate-x-full"
      : active
        ? "translate-x-0"
        : "-translate-x-full";

  const statusConfig =
    status === "loading"
      ? {
          label: "Carregando",
          icon: "icon-[lucide--loader-2] animate-spin",
          className: "text-blue-600",
        }
      : status === "success"
        ? {
            label: "Concluído",
            icon: "icon-[lucide--check-circle]",
            className: "text-emerald-600",
          }
        : status === "error"
          ? {
              label: "Erro",
              icon: "icon-[lucide--x-circle]",
              className: "text-red-600",
            }
          : null;

  const footerContent =
    footerActions ?? (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button style="bordered" type="button" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    );

  const content = (
    <div
      className={clsx(
        "fixed inset-0 flex items-stretch",
        side === "right" ? "justify-end" : "justify-start",
      )}
      style={{ zIndex }}
    >
      <div
        ref={overlayRef}
        onClick={onClose}
        className={clsx(
          "absolute inset-0 bg-black/40 transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          "relative z-10 flex h-dvh w-full max-w-full flex-col bg-white shadow-xl outline-none transition-transform duration-300 ease-out dark:bg-zinc-800",
          widthClass,
          panelTranslateClass,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 sm:p-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title ? (
              <div
                id={titleId}
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </div>
            ) : null}
            {statusConfig ? (
              <div
                role="status"
                aria-live="polite"
                className={clsx(
                  "flex items-center gap-2 text-sm",
                  statusConfig.className,
                )}
              >
                <span className={clsx(statusConfig.icon, "size-4")} />
                <span>{statusConfig.label}</span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                aria-label={editLabel}
                className="flex items-center justify-center size-9 rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <span className="icon-[lucide--pencil] size-4" />
              </button>
            ) : null}
            {onAdd ? (
              <button
                type="button"
                onClick={onAdd}
                aria-label={addLabel}
                className="flex items-center justify-center size-9 rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <span className="icon-[lucide--plus] size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className="flex items-center justify-center size-9 rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <span className="icon-[lucide--x] size-4" />
            </button>
          </div>
        </div>
        <div
          className={clsx(
            "flex-1 min-h-0 overflow-y-auto text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 space-y-4",
            contentClassName,
          )}
        >
          {children}
        </div>
        <div className="flex items-center border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 sm:p-6 p-4 gap-4">
          {footerContent}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
