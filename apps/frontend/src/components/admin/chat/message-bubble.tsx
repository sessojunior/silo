"use client";

import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/context/chat-context";
import AssistantVisualizationBlock from "@/components/admin/chat/assistant-visualization";
import AssistantArtifactsBlock from "@/components/admin/chat/assistant-artifacts";
import { getSafeAssistantPdfFrameSource } from "@/lib/assistant-media-safety";

type MessageBubbleProps = {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showAssistantFooter?: boolean;
  readCount?: number;
  totalParticipants?: number;
  onDelete?: (messageId: string) => void;
  onRetry?: () => void;
};

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  showAssistantFooter = false,
  readCount = 0,
  totalParticipants = 0,
  onDelete,
  onRetry,
}: MessageBubbleProps) {
  // Garantir que isOwnMessage seja boolean e consistente
  // Agora recebe valor estável do MessagesList, não precisa de useMemo
  const isOwnMessageFinal = Boolean(isOwnMessage);

  // O campo assistantThinking representa apenas o status transitório do stream.
  // Depois que há conteúdo ou generation, não o apresente como raciocínio da LLM.
  const isStreaming = !message.content && !message.assistantGeneration;
  const isError = message.assistantGeneration?.status === "error";
  const isFallback = message.assistantGeneration?.status === "fallback";

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);

    // Menos de 30 segundos: "agora"
    if (diffInSeconds < 30) {
      return "Agora";
    }

    // Menos de 60 segundos: "Xs atrás"
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s atrás`;
    }

    // Menos de 60 minutos: "Xm atrás"
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m atrás`;
    }

    // Mesmo ano: "dd/mm, HH:mm"
    if (date.getFullYear() === now.getFullYear()) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}/${month}, ${hours}:${minutes}`;
    }

    // Outro ano: "dd/mm/YYYY, HH:mm"
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };

  // Formatar timestamp - formato apropriado para chat
  const messageDate = new Date(message.createdAt);
  const timeDisplay = formatMessageTime(messageDate);

  // Avatar baseado no nome do usuário (primeira letra)
  const avatarLetter = message.senderName?.charAt(0).toUpperCase() || "?";
  const assistantVisualization =
    !isOwnMessageFinal && message.assistantVisualization
      ? message.assistantVisualization
      : null;
  const assistantVisualizationPdfSrc =
    assistantVisualization?.kind === "image"
      ? getSafeAssistantPdfFrameSource(assistantVisualization.src)
      : null;
  const assistantArtifacts = (() => {
    if (
      isOwnMessageFinal ||
      !message.assistantArtifacts ||
      message.assistantArtifacts.length === 0
    ) {
      return null;
    }

    const filteredArtifacts = message.assistantArtifacts.filter((artifact) => {
      const safePdfSrc = getSafeAssistantPdfFrameSource(artifact.url);
      if (!safePdfSrc) {
        return false;
      }

      return safePdfSrc !== assistantVisualizationPdfSrc;
    });

    return filteredArtifacts.length > 0 ? filteredArtifacts : null;
  })();
  const hasAssistantVisualization = Boolean(assistantVisualization);
  const hasAssistantArtifacts = Boolean(assistantArtifacts);
  const bubbleWidthClass = hasAssistantVisualization || hasAssistantArtifacts
    ? "max-w-sm lg:max-w-lg"
    : isOwnMessageFinal
      ? "max-w-xs lg:max-w-md"
      : "max-w-2xl";

  const formatTokenCount = (tokenCount: number): string => {
    const normalizedCount = tokenCount.toLocaleString("pt-BR");
    return `${normalizedCount} ${tokenCount === 1 ? "token" : "tokens"}`;
  };

  const formatThinkingTime = (thinkingTimeMs: number): string => {
    if (thinkingTimeMs < 1000) {
      return `${thinkingTimeMs}ms`;
    }

    const seconds = thinkingTimeMs / 1000;
    const normalizedSeconds = seconds.toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    });

    return `${normalizedSeconds}s`;
  };

  const formatAssistantFooter = (
    generation: ChatMessage["assistantGeneration"],
    hasThinkingText?: boolean,
  ): string => {
    if (!generation) {
      // Durante streaming, o balão já mostra o raciocínio — não repetir "Pensando..." no footer
      return hasThinkingText ? "" : "Pensando...";
    }

    if (generation.status === "error") {
      return generation.errorMessage || "Erro ao gerar resposta.";
    }

    if (generation.status === "fallback") {
      return "Resposta provisória";
    }

    if (generation.provider === "seed" || generation.model === "demo") {
      return "Sem IA.";
    }

    const details: string[] = [];

    if (typeof generation.generatedTokens === "number") {
      details.push(formatTokenCount(generation.generatedTokens));
    }

    if (typeof generation.thinkingTimeMs === "number") {
      details.push(`pensou por ${formatThinkingTime(generation.thinkingTimeMs)}`);
    }

    return details.length > 0
      ? `Mensagem de IA · ${details.join(" · ")}`
      : `Mensagem de IA`;
  };

  // Renderizar ícone de status de leitura
  const renderReadStatus = () => {
    // APENAS para mensagens próprias (como no WhatsApp)
    if (!isOwnMessageFinal) return null;

    // MENSAGENS PRÓPRIAS: Status de entrega/leitura pelo destinatário
    // Para userMessage, usar readAt para determinar status
    if (message.messageType === "userMessage") {
      if (message.readAt) {
        // 2 checks verdes: Lido pelo destinatário (estilo WhatsApp)
        return (
          <span className="icon-[lucide--check-check] w-3 h-3 text-green-500" />
        );
      } else {
        // 2 checks cinzas: Entregue mas não lido
        return (
          <span className="icon-[lucide--check-check] w-3 h-3 text-zinc-400 dark:text-zinc-500" />
        );
      }
    }

    // Para groupMessage, usar readAt para determinar status
    if (message.messageType === "groupMessage") {
      if (message.readAt) {
        // 2 checks verdes: Lido por pelo menos um membro do grupo
        return (
          <span className="icon-[lucide--check-check] w-3 h-3 text-green-500" />
        );
      } else {
        // 2 checks cinzas: Entregue mas não lido
        return (
          <span className="icon-[lucide--check-check] w-3 h-3 text-zinc-400 dark:text-zinc-500" />
        );
      }
    }

    // Fallback para casos não cobertos
    return (
      <span className="icon-[lucide--check-check] w-3 h-3 text-zinc-400 dark:text-zinc-500" />
    );
  };

  // Falha do assistente: mostra contexto curto e uma ação de recuperação.
  if (isError && !isOwnMessageFinal) {
    const failureMessage =
      message.assistantGeneration?.errorMessage ||
      "Não foi possível obter a resposta do modelo de IA.";

    return (
      <div className="flex justify-start gap-2 pt-3 pb-4" role="alert">
        <div className="w-8 h-8 shrink-0 rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300 flex items-center justify-center">
          <span className="icon-[lucide--triangle-alert] size-4" aria-hidden="true" />
        </div>
        <div className="w-full max-w-sm rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 shadow-sm dark:border-red-900/80 dark:bg-red-950/35">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            Não foi possível obter a resposta
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
            {failureMessage}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/60"
            >
              <span className="icon-[lucide--refresh-cw] size-3.5" aria-hidden="true" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-3 pb-5 ${isOwnMessageFinal ? "flex-row-reverse" : "flex-row"} ${isStreaming && !isOwnMessageFinal ? "pt-4" : ""}`}
    >
      {/* Avatar (apenas para mensagens de outros usuários) */}
      {showAvatar && !isOwnMessageFinal && (
        <div className="shrink-0">
          <div className="w-8 h-8 rounded-full bg-zinc-500 flex items-center justify-center text-white text-sm font-medium">
            {avatarLetter}
          </div>
        </div>
      )}

      {/* Espaçador invisível para alinhamento quando não há avatar */}
      {!showAvatar && !isOwnMessageFinal && (
        <div className="shrink-0 w-8 h-8" />
      )}

      {/* Conteúdo da mensagem */}
      <div
        className={`flex flex-col ${bubbleWidthClass} ${isOwnMessageFinal ? "items-end" : "items-start"}`}
      >
        {/* Container do bubble com setinha */}
        <div
          className={`relative ${isOwnMessageFinal ? "flex-row-reverse" : "flex-row"}`}
        >
          {/* Bubble da mensagem */}
          <div
            data-testid={!isOwnMessageFinal ? "assistant-message-bubble" : undefined}
            className={`
							max-w-full wrap-break-word overflow-hidden relative
							${isOwnMessageFinal ? "px-4 py-3" : "px-5 py-4"}
							${isOwnMessageFinal
                ? "bg-blue-600 text-white rounded-b-xl rounded-l-xl"
                : showAvatar
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-b-xl rounded-r-xl"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl"
              }
						`}
          >
            {/* Nome do remetente (dentro do bubble, apenas para mensagens de outros usuários) */}
            {!isOwnMessageFinal && showAvatar && (
              <div className="text-sm font-semibold text-blue-500 dark:text-blue-400">
                {message.senderName}
              </div>
            )}

            {/* Conteúdo da mensagem ou raciocínio em streaming */}
            {message.content ? (
              <div className={`${!isOwnMessageFinal ? "mt-2" : ""} text-sm leading-7 wrap-break-word overflow-hidden`}>
                {isOwnMessageFinal ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-sm prose-zinc max-w-none leading-7 dark:prose-invert">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ) : isStreaming ? (
              <div className="mt-4 min-w-0" data-testid="assistant-streaming-status">
                {/* Indicador animado de pensamento */}
                <div className="flex items-center gap-2.5 rounded-lg bg-zinc-100/80 px-3 py-2.5 text-xs dark:bg-zinc-700/50">
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/40 duration-1000" />
                    <span className="icon-[lucide--brain] size-4 relative text-amber-500 animate-[spin_3s_linear_infinite]" />
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    Processando
                  </span>
                  <span className="flex gap-0.5 mt-1.5">
                    <span className="size-1 animate-bounce rounded-full bg-amber-500 [animation-delay:0ms]" />
                    <span className="size-1 animate-bounce rounded-full bg-amber-500 [animation-delay:150ms]" />
                    <span className="size-1 animate-bounce rounded-full bg-amber-500 [animation-delay:300ms]" />
                  </span>
                  <span className="sr-only">Aguardando resultado</span>
                </div>
              </div>
            ) : null}

            {/* Visualização (gráfico/imagem) — renderiza ANTES do raciocínio */}
            {!isOwnMessageFinal && message.assistantCitations?.length ? (
              <div
                className="mt-5 space-y-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-700/60"
                data-testid="assistant-citations"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Fontes consultadas
                </p>
                {message.assistantCitations.slice(0, 3).map((citation, index) => (
                  <div key={`${citation.sourceId ?? citation.label}-${index}`} className="text-xs">
                    <p className="font-medium text-zinc-700 dark:text-zinc-200">
                      {citation.label}
                      {citation.sourceId ? ` · ${citation.sourceId}` : ""}
                    </p>
                    {citation.snippet ? (
                      <p className="text-zinc-500 dark:text-zinc-400">{citation.snippet}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {assistantVisualization ? (
              <AssistantVisualizationBlock visualization={assistantVisualization} />
            ) : null}

            {assistantArtifacts ? (
              <AssistantArtifactsBlock artifacts={assistantArtifacts} />
            ) : null}

            {isFallback && !isOwnMessageFinal ? (
              <div className="mt-5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-800/70 dark:bg-amber-950/25">
                <div className="flex items-start gap-2">
                  <span
                    className="icon-[lucide--info] mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Resposta provisória
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80">
                      {message.assistantGeneration?.errorMessage ||
                        "O modelo de IA não pôde ser acessado."}
                    </p>
                  </div>
                </div>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60"
                  >
                    <span className="icon-[lucide--refresh-cw] size-3.5" aria-hidden="true" />
                    Tentar novamente
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Indicador de exclusão */}
            {message.deletedAt && (
              <div className="text-xs opacity-75 italic">
                <span className="icon-[lucide--trash-2] w-3 h-3 inline mr-1" />
                Mensagem excluída
              </div>
            )}

            {/* Timestamp e ações — linha única */}
            <div
              className={`flex items-center justify-between mt-4 text-[10px] ${isOwnMessageFinal ? "text-blue-200" : "text-zinc-400 dark:text-zinc-500"}`}
            >
              {/* Lado esquerdo: timestamp + status */}
              <div className="flex items-center">
                <span>{timeDisplay}</span>
                <span className="ml-1">{renderReadStatus()}</span>

                {/* Footer do assistente na mesma linha */}
                {showAssistantFooter && !isStreaming && !isOwnMessageFinal ? (
                  <span className="truncate ml-1 px-1">
                    · <span>{formatAssistantFooter(message.assistantGeneration)}</span>
                  </span>
                ) : null}
              </div>

              {/* Lado direito: botão Excluir (só para mensagens do usuário) */}
              <div className="flex items-center gap-1">
                {onDelete && isOwnMessageFinal && !isStreaming && !message.deletedAt ? (
                  <button
                    type="button"
                    onClick={() => onDelete(message.id)}
                    className={`text-[10px] transition-all flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:scale-105 ${isOwnMessageFinal ? "text-blue-200 hover:text-red-300" : "text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"}`}
                    title="Excluir mensagem e respostas seguintes"
                  >
                    <span className="icon-[lucide--trash-2] size-3" />
                    <span>Excluir</span>
                  </button>
                ) : null}

                {/* Status de leitura para grupos */}
                {isOwnMessageFinal &&
                  message.messageType === "groupMessage" &&
                  totalParticipants > 1 &&
                  readCount > 0 && (
                    <span className="opacity-75 ml-1">
                      {readCount}/{totalParticipants}
                    </span>
                  )}
              </div>
            </div>

            {/* Footer separado para mensagens próprias com info do assistente */}
            {showAssistantFooter && !isStreaming && isOwnMessageFinal ? (
              <div className="mt-2 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
                {formatAssistantFooter(message.assistantGeneration)}
              </div>
            ) : null}
          </div>

          {/* Setinha reta em cima (estilo WhatsApp) - apenas quando há avatar */}
          {!isOwnMessageFinal && showAvatar && (
            <div
              className={`
							absolute w-0 h-0 border-solid
							border-l-8 border-l-transparent 
							border-r-8 border-r-transparent 
							border-t-8 border-t-white dark:border-t-zinc-800
                -left-2 top-0
						`}
            />
          )}

          {/* Setinha para mensagens próprias - sempre aparece */}
          {isOwnMessageFinal && (
            <div
              className={`
							absolute w-0 h-0 border-solid
							border-r-8 border-r-transparent 
							border-l-8 border-l-transparent 
							border-t-8 border-t-blue-600
                -right-2 top-0
						`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
