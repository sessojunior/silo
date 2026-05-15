"use client";

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

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);

    // Menos de 30 segundos: "agora"
    if (diffInSeconds < 30) {
      return "agora";
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
  ): string => {
    if (!generation) {
      return "Sem IA.";
    }

    if (generation.status === "fallback" || generation.status === "error") {
      return "Mensagem fallback.";
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

            {/* Conteúdo da mensagem */}
            {message.content && (
              <p className="text-sm whitespace-pre-wrap wrap-break-word overflow-hidden">
                {message.content}
              </p>
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
              className={`flex items-center gap-1 mt-1 text-xs ${isOwnMessageFinal ? "text-blue-200" : "text-zinc-400 dark:text-zinc-500"}`}
            >
              <span>{timeDisplay}</span>

              {/* Status de entrega/leitura */}
              <div className="flex items-center gap-1 ml-1">
                {renderReadStatus()}
                {/* Contador de leitura para grupos (apenas mensagens próprias) */}
                {isOwnMessageFinal &&
                  message.messageType === "groupMessage" &&
                  totalParticipants > 1 &&
                  readCount > 0 && (
                    <span className="text-xs opacity-75">
                      {readCount}/{totalParticipants}
                    </span>
                  )}
              </div>
            </div>

            {showAssistantFooter ? (
              <div className="mt-1 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
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
