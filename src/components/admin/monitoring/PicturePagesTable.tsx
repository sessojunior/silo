"use client";

import type { PicturePage } from "./PicturePagesAccordion";

type Props = {
  pages: PicturePage[];
  onEdit?: (page: PicturePage) => void;
};

export default function PicturePagesTable({ pages, onEdit }: Props) {
  if (!pages || pages.length === 0) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-300">Nenhuma pagina cadastrada.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="text-left text-zinc-600 dark:text-zinc-400 text-base">
            <th className="px-3 py-2">Página e Detalhes</th>
            <th className="px-3 py-2 text-center">Links</th>
            <th className="px-3 py-2 text-center">Atrasados</th>
            <th className="px-3 py-2 text-center">Offline</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page, index) => {
            const offline = page.offlineLinks ?? page.links.filter((l) => l.status === "offline").length;
            const delayed = page.delayedLinks ?? page.links.filter((l) => l.status === "delayed").length;

            return (
              <tr key={`${page.id}-${index}`} className="border-t border-zinc-200 dark:border-zinc-700">
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <span className="icon-[lucide--monitor] size-4 shrink-0 text-blue-500/70" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{page.name}</span>
                    </div>
                    <a
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400 break-all"
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {page.url}
                    </a>
                    {page.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {page.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">{page.links.length}</td>
                <td className="px-3 py-2 text-center">
                  <span className={delayed > 0 ? "text-red-600 font-semibold" : "text-zinc-600"}>{delayed}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={offline > 0 ? "text-red-600 font-semibold" : "text-zinc-600"}>{offline}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit?.(page)}
                    className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 transition-colors"
                    title="Editar página"
                  >
                    <span className="icon-[lucide--pencil] size-4 shrink-0" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
