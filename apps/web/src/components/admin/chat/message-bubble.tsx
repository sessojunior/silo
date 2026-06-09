"use client";

import { useState } from "react";
import type { ChatMessage } from "@/context/chat-context";
import AssistantVisualizationBlock from "@/components/admin/chat/assistant-visualization";

type MessageBubbleProps = {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showAssistantFooter?: boolean;
  readCount?: number; // Quantos usuários leram (apenas para groupMessage)
  totalParticipants?: number; // Total de participantes do grupo (apenas para groupMessage)
};

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  showAssistantFooter = false,
  readCount = 0,
  totalParticipants = 0,
}: MessageBubbleProps) {
  // Garantir que isOwnMessage seja boolean e consistente
  // Agora recebe valor estável do MessagesList, não precisa de useMemo
  const isOwnMessageFinal = Boolean(isOwnMessage);

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const hasThinking = Boolean(message.assistantThinking);
  const isStreaming = !message.content && !message.assistantGeneration && hasThinking;
  const isError = message.assistantGeneration?.status === "error";

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
  const hasAssistantVisualization = Boolean(assistantVisualization);
  const bubbleWidthClass = hasAssistantVisualization
    ? "max-w-sm lg:max-w-lg"
    : "max-w-xs lg:max-w-md";

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

    if (generation.provider === "seed" || generation.model === "demo") {
      return "Sem IA.";
    }

    const sourceLabel =
      generation.provider === "ollama"
        ? generation.model.trim()
        : `${generation.provider.trim()}/${generation.model.trim()}`.trim();

    if (sourceLabel.length === 0) {
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
      ? `Mensagem de ${sourceLabel} · ${details.join(" · ")}`
      : `Mensagem de ${sourceLabel}`;
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

  // Erro: renderiza como mensagem de sistema, sem avatar nem balão
  if (isError && !isOwnMessageFinal) {
    return (
      <div className="flex justify-center pb-4">
        <div className="max-w-xs lg:max-w-md rounded-lg border border-red-200 bg-red-50/70 px-4 py-2 text-center dark:border-red-800 dark:bg-red-950/30">
          <p className="text-xs text-red-700 dark:text-red-300">
            ⚠️ {message.content || "Erro ao gerar resposta."}
          </p>
          {showAssistantFooter && (
            <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">
              {formatAssistantFooter(message.assistantGeneration, hasThinking)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 pb-4 ${isOwnMessageFinal ? "flex-row-reverse" : "flex-row"}`}
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
            className={`
							px-4 py-2 max-w-full wrap-break-word overflow-hidden relative
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
              <div className="text-sm text-blue-500 dark:text-blue-400 font-medium">
                {message.senderName}
              </div>
            )}

            {/* Conteúdo da mensagem ou raciocínio em streaming */}
            {message.content ? (
              <div className="text-sm whitespace-pre-wrap wrap-break-word overflow-hidden">
                {message.content.split("\n\n").map((paragraph, idx) => (
                  <p key={idx} className={idx > 0 ? "pt-2" : ""}>
                    {paragraph.split("\n").map((line, lineIdx) => (
                      <span key={lineIdx}>
                        {lineIdx > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            ) : isStreaming ? (
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="icon-[lucide--brain] size-3.5 shrink-0 text-amber-500" />
                  <span>Pensando<span className="animate-pulse">...</span></span>
                  <span className="text-zinc-400 dark:text-zinc-500">· Gerando resposta</span>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-zinc-600 dark:text-zinc-400 max-h-48 overflow-y-auto">
                  {message.assistantThinking}
                </p>
              </div>
            ) : null}

            {/* Raciocínio do modelo em accordion — só quando a resposta já chegou */}
            {hasThinking && !isStreaming && (
              <div className="mt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
                <button
                  type="button"
                  onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                  className="flex w-full items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  <span
                    className={`icon-[lucide--brain] size-3.5 shrink-0 ${isThinkingExpanded ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"}`}
                  />
                  <span>Raciocínio da IA</span>
                  <span
                    className={`icon-[lucide--chevron-down] size-3 shrink-0 transition-transform duration-200 ${
                      isThinkingExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isThinkingExpanded && (
                  <div className="mt-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2 max-h-48 overflow-y-auto">
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-amber-900/70 dark:text-amber-200/70">
                      {message.assistantThinking}
                    </p>
                  </div>
                )}
              </div>
            )}

            {assistantVisualization ? (
              <AssistantVisualizationBlock visualization={assistantVisualization} />
            ) : null}

            {/* Indicador de exclusão */}
            {message.deletedAt && (
              <div className="text-xs opacity-75 italic">
                <span className="icon-[lucide--trash-2] w-3 h-3 inline mr-1" />
                Mensagem excluída
              </div>
            )}

            {/* Timestamp e status de leitura */}
            <div
              className={`flex items-center mt-2 text-[10px] ${isOwnMessageFinal ? "text-blue-200" : "text-zinc-400 dark:text-zinc-500"}`}
            >
              <span>{timeDisplay}</span>

              {/* Status de entrega/leitura */}
              <div className="flex items-center">
                {renderReadStatus()}
                {/* Contador de leitura para grupos (apenas mensagens próprias) */}
                {isOwnMessageFinal &&
                  message.messageType === "groupMessage" &&
                  totalParticipants > 1 &&
                  readCount > 0 && (
                    <span className="opacity-75">
                      {readCount}/{totalParticipants}
                    </span>
                  )}
              </div>

              {/* Footer do assistente na mesma linha, separado por · */}
              {showAssistantFooter && !isStreaming && !isOwnMessageFinal ? (
                <span className="truncate">
                  <span className="mx-1 px-1">·</span>
                  <span>
                    {formatAssistantFooter(message.assistantGeneration, hasThinking)}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Footer separado para mensagens próprias quando aplicável */}
            {showAssistantFooter && !isStreaming && isOwnMessageFinal ? (
              <div className="mt-2 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
                {formatAssistantFooter(message.assistantGeneration, hasThinking)}
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
