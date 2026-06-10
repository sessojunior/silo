"use client";

import { useEffect, useRef, useState } from "react";
import type { AiAssistantVisualizationMermaidDto } from "@silo/engine/contracts/dto/ai-assistant";

interface AssistantMermaidProps {
  visualization: AiAssistantVisualizationMermaidDto;
}

/**
 * Renderiza um diagrama Mermaid a partir da string de definição.
 *
 * O componente:
 * 1. Injeta a definição do diagrama em um container <div>
 * 2. Chama mermaid.run() para renderizar o SVG
 * 3. Exibe um fallback textual caso a renderização falhe
 */
export default function AssistantMermaidBlock({ visualization }: AssistantMermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        setIsRendering(true);
        setRenderError(null);

        // Import dinâmico para evitar SSR
        const mermaid = await import("mermaid");

        // Configura o mermaid
        mermaid.default.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "Inter, system-ui, sans-serif",
          themeVariables: {
            primaryColor: "#3b82f6",
            primaryTextColor: "#1f2937",
            primaryBorderColor: "#93c5fd",
            lineColor: "#6b7280",
            secondaryColor: "#f3f4f6",
            tertiaryColor: "#ffffff",
          },
        });

        // Gera um ID único para o diagrama
        const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Define o conteúdo do diagrama no container
        container.innerHTML = `<div class="mermaid" id="${diagramId}">\n${visualization.diagram}\n</div>`;

        // Renderiza
        await mermaid.default.run({
          nodes: [container.querySelector(`#${diagramId}`)!],
        });

        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro ao renderizar diagrama";
          console.error("❌ [MERMAID] Erro na renderização:", message);
          setRenderError(message);
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [visualization.diagram]);

  return (
    <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      <div className="mb-3 min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {visualization.title}
        </h4>
        {visualization.caption && (
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {visualization.caption}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
        {isRendering && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
            <span className="icon-[lucide--loader-2] size-4 animate-spin" />
            <span>Renderizando diagrama...</span>
          </div>
        )}

        {renderError && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span className="icon-[lucide--alert-triangle] size-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Não foi possível renderizar o diagrama</p>
                <p className="mt-1 text-xs opacity-80">{renderError}</p>
              </div>
            </div>
            {/* Fallback: exibe o código do diagrama */}
            <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <code>{visualization.diagram}</code>
            </pre>
          </div>
        )}

        {/* Container onde o Mermaid injeta o SVG */}
        <div
          ref={containerRef}
          className={`mermaid-container ${isRendering ? "hidden" : ""}`}
          style={{ minHeight: renderError ? 0 : 100 }}
        />
      </div>
    </div>
  );
}
