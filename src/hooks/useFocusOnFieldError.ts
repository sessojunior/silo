"use client";

import { useEffect } from "react";

const focusIfPossible = (value: Element | null): boolean => {
  if (!value) return false;
  const maybeFocusable = value as unknown as { focus?: unknown };
  if (typeof maybeFocusable.focus !== "function") return false;
  (maybeFocusable.focus as () => void)();
  return true;
};

export function useFocusOnFieldError(field: string | null) {
  useEffect(() => {
    if (!field) return;
    const el = document.getElementById(field);
    if (!el) return;
    if (focusIfPossible(el)) return;

    const focusable = el.querySelector<HTMLElement>(
      "input, textarea, select, button, [tabindex]:not([tabindex='-1'])",
    );
    focusIfPossible(focusable);
  }, [field]);
}
