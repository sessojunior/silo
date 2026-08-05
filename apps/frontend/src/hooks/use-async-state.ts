"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// === HOOK PARA GERENCIAR ESTADOS ASSÍNCRONOS ===

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncStateOptions {
  immediate?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
}

interface UseAsyncStateReturn<T> extends AsyncState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  refetch: () => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
  setError: (error: Error | null) => void;
  setLoading: (loading: boolean) => void;
}

export function useAsyncState<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  options: UseAsyncStateOptions = {},
): UseAsyncStateReturn<T> {
  const {
    immediate = false,
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const executeRef = useRef<((...args: unknown[]) => Promise<T | null>) | null>(
    null,
  );
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Função para executar a operação assíncrona
  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      if (!isMountedRef.current) return null;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFn(...args);

        if (!isMountedRef.current) return null;

        setState((prev) => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
        }));
        onSuccess?.(result);
        retryCountRef.current = 0;

        return result;
      } catch (error) {
        if (!isMountedRef.current) return null;

        const errorObj =
          error instanceof Error ? error : new Error("Erro desconhecido");

        // Tentar novamente se houver tentativas restantes
        if (retryCountRef.current < retryCount) {
          retryCountRef.current++;
          setTimeout(() => {
            if (isMountedRef.current) {
              void executeRef.current?.(...args);
            }
          }, retryDelay);
          return null;
        }

        setState((prev) => ({ ...prev, loading: false, error: errorObj }));
        onError?.(errorObj);
        retryCountRef.current = 0;

        return null;
      }
    },
    [asyncFn, onSuccess, onError, retryCount, retryDelay],
  );

  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  // Função para refazer a operação
  const refetch = useCallback(async (): Promise<T | null> => {
    return execute();
  }, [execute]);

  // Função para resetar o estado
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
    retryCountRef.current = 0;
  }, []);

  // Funções para atualizar o estado manualmente
  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  // Executar imediatamente se solicitado
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    refetch,
    reset,
    setData,
    setError,
    setLoading,
  };
}

// === HOOK ESPECÍFICO PARA FETCH DE DADOS ===

interface UseFetchOptions extends UseAsyncStateOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
}

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions = {},
): UseAsyncStateReturn<T> {
  const { method = "GET", headers = {}, body, ...asyncOptions } = options;

  const fetchFn = useCallback(async (): Promise<T> => {
    if (!url) {
      throw new Error("URL é obrigatória");
    }

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body && method !== "GET") {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }, [url, method, headers, body]);

  return useAsyncState(fetchFn, asyncOptions);
}

// === HOOK PARA OPERAÇÕES DE MUTAÇÃO ===

interface UseMutationOptions<TData, TVariables> {
  immediate?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  retryCount?: number;
  retryDelay?: number;
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {},
): UseAsyncStateReturn<TData> & {
  mutate: (variables: TVariables) => Promise<TData | null>;
} {
  const { onSuccess, onError, ...asyncOptions } = options;

  const execute = useCallback(
    async (...args: unknown[]): Promise<TData | null> => {
      const variables = args[0] as TVariables;
      try {
        const result = await mutationFn(variables);
        onSuccess?.(result, variables);
        return result;
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error("Erro desconhecido");
        onError?.(errorObj, variables);
        throw errorObj;
      }
    },
    [mutationFn, onSuccess, onError],
  );

  const asyncState = useAsyncState(execute, asyncOptions);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      return asyncState.execute(variables);
    },
    [asyncState],
  );

  return {
    ...asyncState,
    mutate,
  };
}

// === HOOK PARA QUERIES COM CACHE ===

interface UseQueryOptions extends UseAsyncStateOptions {
  staleTime?: number; // Tempo em ms antes dos dados ficarem "stale"
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
}

export function useQuery<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: UseQueryOptions = {},
): UseAsyncStateReturn<T> & {
  invalidate: () => void;
  isStale: boolean;
} {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus = true,
    refetchInterval,
    ...asyncOptions
  } = options;

  const [lastFetch, setLastFetch] = useState<number>(0);
  const [isStale, setIsStale] = useState(false);

  const execute = useCallback(async (): Promise<T> => {
    const result = await queryFn();
    setLastFetch(Date.now());
    setIsStale(false);
    return result;
  }, [queryFn]);

  const asyncState = useAsyncState(execute, asyncOptions);

  // Verificar se os dados estão stale
  useEffect(() => {
    if (lastFetch > 0) {
      const checkStale = () => {
        const timeSinceLastFetch = Date.now() - lastFetch;
        setIsStale(timeSinceLastFetch > staleTime);
      };

      const interval = setInterval(checkStale, 1000);
      return () => clearInterval(interval);
    }
  }, [lastFetch, staleTime]);

  // Refetch automático
  useEffect(() => {
    if (refetchInterval && !asyncState.loading) {
      const interval = setInterval(() => {
        asyncState.refetch();
      }, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, asyncState]);

  // Refetch quando a janela ganha foco
  useEffect(() => {
    if (refetchOnWindowFocus && isStale) {
      const handleFocus = () => {
        asyncState.refetch();
      };

      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
    }
  }, [refetchOnWindowFocus, isStale, asyncState]);

  const invalidate = useCallback(() => {
    setIsStale(true);
    asyncState.refetch();
  }, [asyncState]);

  return {
    ...asyncState,
    invalidate,
    isStale,
  };
}
