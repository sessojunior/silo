"use client";

import { useCallback, useState } from "react";
import { useFocusOnFieldError } from "@/hooks/useFocusOnFieldError";

export type AuthFormState = { field: string | null; message: string };

export function useAuthFormState(
  initial: AuthFormState = { field: null, message: "" },
): {
  form: AuthFormState;
  setForm: (next: AuthFormState) => void;
  loading: boolean;
  setLoading: (next: boolean) => void;
  setFieldError: (field: string | null, message: string) => void;
  clearFieldError: () => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
} {
  const [form, setForm] = useState<AuthFormState>(initial);
  const [loading, setLoading] = useState(false);

  useFocusOnFieldError(form.field);

  const setFieldError = useCallback((field: string | null, message: string) => {
    setForm({ field, message });
  }, []);

  const clearFieldError = useCallback(() => {
    setForm({ field: null, message: "" });
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      try {
        return await fn();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    form,
    setForm,
    loading,
    setLoading,
    setFieldError,
    clearFieldError,
    withLoading,
  };
}

