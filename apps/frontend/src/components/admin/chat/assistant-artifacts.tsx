"use client";

import { useCallback, useMemo, useState } from "react";

import type { AiAssistantArtifactDto } from "@silo/engine/contracts/dto/ai-assistant";
import {
  getSafeAssistantPdfFrameSource,
  resolveAssistantBrowserUrl,
} from "@/lib/assistant-media-safety";

type AssistantArtifactsProps = {
  artifacts: AiAssistantArtifactDto[];
};

type PreviewState = {
  src: string;
  title: string;
} | null;

type SafePdfArtifact = {
  artifact: AiAssistantArtifactDto;
  safePdfSrc: string;
  dedupeKey: string;
};

const formatByteSize = (byteSize: number | null | undefined): string | null => {
  if (typeof byteSize !== "number" || !Number.isFinite(byteSize) || byteSize <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = byteSize;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const normalized = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${normalized} ${units[unitIndex]}`;
};

const getArtifactTitle = (artifact: AiAssistantArtifactDto): string =>
  artifact.title?.trim() || artifact.filename;

const PdfArtifactCard = ({
  artifact,
  safePdfSrc,
  onPreview,
}: {
  artifact: AiAssistantArtifactDto;
  safePdfSrc: string;
  onPreview: (src: string, title: string) => void;
}) => {
  const browserSrc = resolveAssistantBrowserUrl(safePdfSrc);
  const title = getArtifactTitle(artifact);
  const sizeLabel = formatByteSize(artifact.byteSize);
  const reportLabel = artifact.reportType ? `Relatório ${artifact.reportType}` : "Anexo PDF";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <span className="icon-[lucide--file-text] size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {reportLabel}
              {sizeLabel ? ` · ${sizeLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={browserSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <span className="icon-[lucide--download] size-4" />
            Baixar PDF
          </a>
          <button
            type="button"
            onClick={() => onPreview(browserSrc, title)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <span className="icon-[lucide--eye] size-4" />
            Visualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AssistantArtifactsBlock({ artifacts }: AssistantArtifactsProps) {
  const [preview, setPreview] = useState<PreviewState>(null);

  const safeArtifacts = useMemo<SafePdfArtifact[]>(() => {
    const seen = new Set<string>();

    return artifacts.flatMap((artifact) => {
      if (artifact.kind !== "pdf") {
        return [];
      }

      const safePdfSrc = getSafeAssistantPdfFrameSource(artifact.url);
      if (!safePdfSrc) {
        return [];
      }

      const dedupeKey = `${safePdfSrc}::${artifact.filename}`;
      if (seen.has(dedupeKey)) {
        return [];
      }

      seen.add(dedupeKey);
      return [{ artifact, safePdfSrc, dedupeKey }];
    });
  }, [artifacts]);

  const openPreview = useCallback((src: string, title: string) => {
    setPreview({ src, title });
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  if (safeArtifacts.length === 0) {
    return (
      <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
        <div className="flex min-h-32 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Conteúdo indisponível.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closePreview}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closePreview();
            }
          }}
          role="presentation"
        >
          <button
            type="button"
            onClick={closePreview}
            className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Fechar"
          >
            <span className="icon-[lucide--x] size-6" />
          </button>
          <iframe
            src={preview.src}
            className="h-[90vh] w-full max-w-4xl rounded-lg bg-white"
            title={preview.title}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {safeArtifacts.map((item) => (
          <PdfArtifactCard
            key={item.dedupeKey}
            artifact={item.artifact}
            safePdfSrc={item.safePdfSrc}
            onPreview={openPreview}
          />
        ))}
      </div>
    </div>
  );
}
