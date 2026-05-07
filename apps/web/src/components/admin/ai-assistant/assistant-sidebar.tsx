"use client";

import { useEffect, useState } from "react";
import type {
  AiAssistantExampleDto,
  AiAssistantThreadSummaryDto,
} from "@silo/engine/contracts";
import Avatar from "@/components/ui/avatar";
import LoadingSpinner from "@/components/ui/loading-spinner";

type SidebarTab = "conversations" | "examples";

const SCOPE_LABELS: Record<string, string> = {
  models: "Modelos",
  pending: "Pendências",
  reports: "Relatórios",
  problems: "Problemas",
  solutions: "Soluções",
  projects: "Projetos",
};

const getScopeLabel = (scope: string): string => {
  return SCOPE_LABELS[scope] ?? scope;
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

type AssistantSidebarProps = {
  examples: AiAssistantExampleDto[];
  threads: AiAssistantThreadSummaryDto[];
  selectedThreadId: string | null;
  onExampleSelect: (prompt: string) => void;
  onThreadSelect: (threadId: string) => void;
  onNewConversation: () => void;
  isLoadingExamples: boolean;
  isLoadingThreads: boolean;
  isCreatingConversation: boolean;
};

export default function AssistantSidebar({
  examples,
  threads,
  selectedThreadId,
  onExampleSelect,
  onThreadSelect,
  onNewConversation,
  isLoadingExamples,
  isLoadingThreads,
  isCreatingConversation,
}: AssistantSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    selectedThreadId ? "conversations" : "examples",
  );

  useEffect(() => {
    if (selectedThreadId) {
      setActiveTab("conversations");
    }
  }, [selectedThreadId]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredConversations = threads.filter((thread) => {
    if (normalizedSearch.length === 0) return true;

    return [thread.title, thread.lastMessagePreview]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const filteredExamples = examples.filter((example) => {
    if (normalizedSearch.length === 0) return true;

    return [example.title, example.description, example.prompt]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
  };

  const handleConversationSelect = (threadId: string) => {
    setActiveTab("conversations");
    onThreadSelect(threadId);
  };

  const handleExampleClick = (prompt: string) => {
    setActiveTab("conversations");
    onExampleSelect(prompt);
  };

  const handleNewConversation = () => {
    setActiveTab("conversations");
    setSearchQuery("");
    onNewConversation();
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
        <div className="flex items-center gap-3 mb-3 p-4 border-b border-zinc-200 dark:border-zinc-700">
          <Avatar
            name="Assistente de IA"
            size="md"
            showPresence={true}
            presenceColor="bg-blue-400"
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">
              Assistente de IA
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-blue-500 dark:text-blue-300">
                Só Silo
              </p>
            </div>
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

        <div className="flex mb-3 bg-white dark:bg-zinc-700 rounded-lg p-1 m-4">
          <button
            type="button"
            onClick={() => handleTabChange("conversations")}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${activeTab === "conversations" ? "bg-blue-500 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600"}`}
          >
            <span className="icon-[lucide--messages-square] w-3 h-3 inline mr-1" />
            Conversas ({threads.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("examples")}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${activeTab === "examples" ? "bg-blue-500 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600"}`}
          >
            <span className="icon-[lucide--sparkles] w-3 h-3 inline mr-1" />
            Exemplos ({examples.length})
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex h-10 items-center gap-2">
          <div className="relative min-w-0 flex-1">
          <input
            type="text"
            placeholder={
              activeTab === "conversations"
                ? "Procurar conversas..."
                : "Procurar exemplos..."
            }
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

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700">
        {activeTab === "conversations" ? (
          isLoadingThreads ? (
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
                />
              ))}
            </div>
          )
        ) : isLoadingExamples ? (
          <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
            <LoadingSpinner
              text="Carregando exemplos..."
              size="xs"
              variant="horizontal"
            />
          </div>
        ) : filteredExamples.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
            <span className="icon-[lucide--sparkles] w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery
                ? "Nenhum exemplo encontrado"
                : "Nenhum exemplo disponível"}
            </p>
          </div>
        ) : (
          <div>
            {filteredExamples.map((example) => (
              <ExampleItem
                key={example.id}
                example={example}
                onClick={() => handleExampleClick(example.prompt)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {activeTab === "conversations"
              ? `${filteredConversations.length} conversas`
              : `${filteredExamples.length} exemplos`}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Restrito
          </span>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({
  thread,
  isActive,
  onClick,
}: {
  thread: AiAssistantThreadSummaryDto;
  isActive: boolean;
  onClick: () => void;
}) {
  const preview =
    thread.lastMessagePreview.trim().length > 0
      ? thread.lastMessagePreview
      : "Sem mensagens ainda";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-l-4 ${isActive ? "bg-blue-50 dark:bg-zinc-700 border-blue-500" : "border-transparent"}`}
    >
      <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-600/10 dark:bg-blue-500/10">
        <span className="icon-[lucide--messages-square] w-5 h-5 text-blue-700 dark:text-blue-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3
            className={`font-medium text-sm truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {thread.title}
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatThreadTime(thread.lastMessageAt)}
            </span>
            {thread.messageCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {thread.messageCount > 99 ? "+99" : thread.messageCount}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {preview}
        </p>
      </div>

      <div className="shrink-0">
        {isActive && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
      </div>
    </button>
  );
}

function ExampleItem({
  example,
  onClick,
}: {
  example: AiAssistantExampleDto;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-l-4 border-transparent"
    >
      <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-600/10 dark:bg-blue-500/10">
        <span className="icon-[lucide--sparkles] w-5 h-5 text-blue-700 dark:text-blue-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm truncate text-zinc-900 dark:text-zinc-100">
            {example.title}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {getScopeLabel(example.scope)}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {example.description}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
          {example.prompt}
        </p>
      </div>

      <div className="shrink-0">
        <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0" />
      </div>
    </button>
  );
}
