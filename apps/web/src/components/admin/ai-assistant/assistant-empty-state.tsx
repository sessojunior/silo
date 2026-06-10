"use client";

import type { AiAssistantExampleDto } from "@silo/engine/contracts/dto/ai-assistant";

type AssistantEmptyStateProps = {
  examples: AiAssistantExampleDto[];
  onExampleSelect: (prompt: string) => void;
};

const getVisibleExamples = (examples: AiAssistantExampleDto[]) => {
  return examples;
};

export default function AssistantEmptyState({
  examples,
  onExampleSelect,
}: AssistantEmptyStateProps) {
  const visibleExamples = getVisibleExamples(examples);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-4xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <span className="icon-[lucide--bot] h-8 w-8" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              Nova conversa
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Escolha um exemplo abaixo ou digite sua pergunta no rodapé da tela.
              O assistente continua restrito ao contexto do Silo.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleExamples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => onExampleSelect(example.prompt)}
                className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {example.title}
                  </h3>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    Exemplo
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {example.description}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {example.prompt}
                </p>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            O campo de digitação fica abaixo desta área.
          </p>
        </div>
      </div>
    </div>
  );
}