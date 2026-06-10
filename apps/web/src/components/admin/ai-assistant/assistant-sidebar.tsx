"use client";

import { useState } from "react";
import type {
  AiAssistantRuntimeStatusDto,
  AiAssistantThreadSummaryDto,
} from "@silo/engine/contracts/dto/ai-assistant";
import Avatar from "@/components/ui/avatar";
import LoadingSpinner from "@/components/ui/loading-spinner";

type RuntimeStatusView = {
  label: string;
  title: string;
  presenceColor: string;
  labelClassName: string;
};

const formatThreadTime = (dateValue: string): string => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffInMinutes < 1) return "agora";
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const getRuntimeStatusView = (
  runtimeStatus: AiAssistantRuntimeStatusDto | null,
  isLoadingRuntimeStatus: boolean,
): RuntimeStatusView => {
  if (isLoadingRuntimeStatus) {
    return {
      label: "Verificando conexão",
      title: "Aguardando resposta do runtime do assistente.",
      presenceColor: "bg-zinc-400 animate-pulse",
      labelClassName: "text-zinc-500 dark:text-zinc-400",
    };
  }

  if (runtimeStatus?.mode === "ollama") {
    return {
      label: "IA disponível · Ollama conectado.",
      title: `Ollama conectado: ${runtimeStatus.model}`,
      presenceColor: "bg-green-400",
      labelClassName: "text-green-600 dark:text-green-300",
    };
  }

  return {
    label: "IA em fallback · Ollama indisponível.",
    title: (() => {
      const fallbackReason = runtimeStatus?.fallbackReason?.trim();
      return fallbackReason && fallbackReason.length > 0
        ? fallbackReason
        : "O assistente vai responder com fallback até o Ollama voltar.";
    })(),
    presenceColor: "bg-amber-400",
    labelClassName: "text-amber-600 dark:text-amber-300",
  };
};

type AssistantSidebarProps = {
  threads: AiAssistantThreadSummaryDto[];
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewConversation: () => void;
  isLoadingThreads: boolean;
  isCreatingConversation: boolean;
  runtimeStatus: AiAssistantRuntimeStatusDto | null;
  isLoadingRuntimeStatus: boolean;
  onDeleteThread?: (threadId: string) => void;
};

export default function AssistantSidebar({
  threads,
  selectedThreadId,
  onThreadSelect,
  onNewConversation,
  isLoadingThreads,
  isCreatingConversation,
  runtimeStatus,
  isLoadingRuntimeStatus,
  onDeleteThread,
}: AssistantSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const runtimeStatusView = getRuntimeStatusView(
    runtimeStatus,
    isLoadingRuntimeStatus,
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredConversations = threads.filter((thread) => {
    if (normalizedSearch.length === 0) return true;

    return [thread.title, thread.lastMessagePreview]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const handleConversationSelect = (threadId: string) => {
    onThreadSelect(threadId);
  };

  const handleNewConversation = () => {
    setSearchQuery("");
    onNewConversation();
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
        <div
          className="flex items-center gap-3 p-4 border-zinc-200 dark:border-zinc-700"
          title={runtimeStatusView.title}
        >
          <Avatar
            name="Assistente de IA"
            size="md"
            showPresence={true}
            presenceColor={runtimeStatusView.presenceColor}
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">
              Assistente de IA
            </h2>
            <p className={`text-xs font-medium ${runtimeStatusView.labelClassName}`}>
              {runtimeStatusView.label}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              className="flex items-center justify-center size-10 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
              aria-label="Ações do assistente"
            >
              <span className="icon-[lucide--more-vertical] size-5 text-zinc-600 dark:text-zinc-300" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex h-10 items-center gap-2">
          <div className="relative min-w-0 flex-1">
          <input
            type="text"
            placeholder="Procurar conversas..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 sm:py-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500"
          />
          <div className="pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4">
            <span className="icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          </div>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isCreatingConversation}
            title={isCreatingConversation ? "Criando conversa..." : "Nova conversa"}
            aria-label="Criar nova conversa"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span className="icon-[lucide--plus] size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700">
        {isLoadingThreads ? (
          <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
            <LoadingSpinner
              text="Carregando conversas..."
              size="xs"
              variant="horizontal"
            />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
            <span className="icon-[lucide--messages-square] w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery
                ? "Nenhuma conversa encontrada"
                : "Nenhuma conversa disponível"}
            </p>
          </div>
        ) : (
          <div>
            {filteredConversations.map((thread) => (
              <ConversationItem
                key={thread.id}
                thread={thread}
                isActive={thread.id === selectedThreadId}
                onClick={() => handleConversationSelect(thread.id)}
                onDelete={onDeleteThread}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function ConversationItem({
  thread,
  isActive,
  onClick,
  onDelete,
}: {
  thread: AiAssistantThreadSummaryDto;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (threadId: string) => void;
}) {
  const preview =
    thread.lastMessagePreview.trim().length > 0
      ? thread.lastMessagePreview
      : "Sem mensagens ainda";

  return (
    <div className={`group relative flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border-l-4 ${isActive ? "bg-blue-50 dark:bg-zinc-700 border-blue-500" : "border-transparent"}`}>
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 min-w-0 text-left"
      >
        {/* Ícone com badge flutuante */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600/10 dark:bg-blue-500/10">
            <span className="icon-[lucide--messages-square] w-5 h-5 text-blue-700 dark:text-blue-300" />
          </div>
          {thread.messageCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
              {thread.messageCount > 99 ? "+99" : thread.messageCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium text-sm truncate mb-0.5 ${isActive ? "text-blue-700 dark:text-blue-300" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {thread.title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-relaxed">
            <span className="text-zinc-400 dark:text-zinc-500">{formatThreadTime(thread.lastMessageAt)}</span>
            <span className="mx-1 text-zinc-300 dark:text-zinc-600">·</span>
            {preview}
          </p>
        </div>
      </button>

      {/* Botão Excluir direto — aparece apenas no hover */}
      {onDelete && (
        <div className="relative shrink-0 self-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(thread.id); }}
            className="flex items-center justify-center size-8 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            aria-label="Excluir conversa"
            title="Excluir conversa"
          >
            <span className="icon-[lucide--trash-2] size-4 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors" />
          </button>
        </div>
      )}
    </div>
  );
}


