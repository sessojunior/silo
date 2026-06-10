"use client";

import { useState, useCallback } from "react";
import Button from "@/components/ui/button";
import { config } from "@/lib/config";

interface ExportPdfButtonProps {
  reportType: "availability" | "problems" | "executive" | "projects";
  label?: string;
  /** Parâmetros extras enviados no body da requisição POST */
  extraBody?: Record<string, unknown>;
  /** Callback chamado após exportar com sucesso */
  onExported?: (url: string, filename: string) => void;
  /** Se verdadeiro, abre o PDF em nova aba após gerar */
  openAfterExport?: boolean;
}

/**
 * Botão "Exportar PDF" que chama a API de geração de PDF e retorna a URL
 * do arquivo armazenado no volume silo-storage-data.
 *
 * Uso:
 * ```tsx
 * <ExportPdfButton reportType="availability" />
 * ```
 */
export function ExportPdfButton({
  reportType,
  label = "Exportar PDF",
  extraBody,
  onExported,
  openAfterExport = true,
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiPath = `/api/admin/reports/${reportType}/pdf`;
      const apiUrl = config.getApiUrl(apiPath);

      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBody ?? {}),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
          errBody?.error || `Erro ao gerar PDF (${response.status})`,
        );
      }

      const json = await response.json();
      if (!json.success || !json.data?.url) {
        throw new Error(json.error || "Resposta inválida da API");
      }

      const { url, filename } = json.data;

      if (onExported) {
        onExported(url, filename);
      }

      if (openAfterExport) {
        // Abre o PDF em nova aba usando a URL pública
        const publicUrl = config.getPublicPath(url);
        window.open(publicUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro desconhecido";
      console.error("❌ [EXPORT_PDF]", message);
      setError(message);

      // Limpa o erro após 5 segundos
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [reportType, extraBody, onExported, openAfterExport]);

  return (
    <div className="relative">
      <Button
        style="bordered"
        icon={
          loading
            ? "animate-spin icon-[lucide--loader-2]"
            : "icon-[lucide--file-down]"
        }
        onClick={handleExport}
        loading={loading}
        disabled={loading}
      >
        {loading ? "Gerando PDF..." : label}
      </Button>

      {error && (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <div className="flex items-start gap-2">
            <span className="icon-[lucide--alert-circle] size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
