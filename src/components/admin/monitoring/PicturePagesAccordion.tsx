"use client";

import { useEffect, useMemo, useState } from "react";

import { toast } from "@/lib/toast";

export type PictureLinkStatus = "ok" | "delayed" | "offline" | "undefined";
export type PictureCheckMode = "page" | "items";

export type PictureLink = {
  id: string;
  name: string;
  url: string;
  size: string;
  lastUpdate: string;
  delay: string;
  delayMinutes: number | null;
  status: PictureLinkStatus;
  type: string;
};

export type PicturePage = {
  id: string;
  name: string;
  url: string;
  description: string;
  checkMode: PictureCheckMode;
  status: PictureLinkStatus;
  delay: string;
  delayMinutes: number | null;
  delayedLinks: number;
  offlineLinks: number;
  onlineLinks?: number;
  links: PictureLink[];
};

type PicturePagesAccordionProps = {
  pages: PicturePage[];
  refreshToken?: number;
};

export default function PicturePagesAccordion({
  pages,
  refreshToken = 0,
}: PicturePagesAccordionProps) {
  const [openPageIndexes, setOpenPageIndexes] = useState<number[]>([]);
  const [pageItems, setPageItems] = useState<PicturePage[]>(pages);

  useEffect(() => {
    setPageItems(pages);
    setOpenPageIndexes([]);
  }, [pages, refreshToken]);

  const sortedPages = useMemo(() => {
    return pageItems
      .map((page, originalIndex) => ({ page, originalIndex }))
      .sort((a, b) => {
        const aHasIssue =
          a.page.offlineLinks > 0 ||
          a.page.delayedLinks > 0 ||
          a.page.status !== "ok";
        const bHasIssue =
          b.page.offlineLinks > 0 ||
          b.page.delayedLinks > 0 ||
          b.page.status !== "ok";

        if (aHasIssue !== bHasIssue) return aHasIssue ? -1 : 1;
        if (a.page.offlineLinks !== b.page.offlineLinks) {
          return b.page.offlineLinks - a.page.offlineLinks;
        }
        if (a.page.delayedLinks !== b.page.delayedLinks) {
          return b.page.delayedLinks - a.page.delayedLinks;
        }
        return a.page.name.localeCompare(b.page.name);
      });
  }, [pageItems]);

  function handleDeletePage(indexToDelete: number) {
    setPageItems((prev) => prev.filter((_, index) => index !== indexToDelete));
    setOpenPageIndexes((prev) =>
      prev
        .filter((index) => index !== indexToDelete)
        .map((index) => (index > indexToDelete ? index - 1 : index)),
    );

    toast({
      type: "warning",
      title: "Pagina removida",
      description: "Remocao local de exemplo. Ainda nao conectada a API.",
    });
  }

  function handleEditPage(pageName: string) {
    toast({
      type: "info",
      title: `Alterar pagina: ${pageName}`,
      description: "Acao de edicao ainda nao conectada a API.",
    });
  }

  if (pageItems.length === 0) {
    return (
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        Nenhuma pagina cadastrada.
      </div>
    );
  }

    return (
      <div className="flex flex-col gap-1 -mx-2">
        {sortedPages.map(({ page, originalIndex }, sortedIndex) => {
          const pageKey = `${page.id}-${originalIndex}-${sortedIndex}`;
          const isOpen = openPageIndexes.includes(originalIndex);

          const showOfflineBadge = page.status === "offline";
          const showDelayedBadge = page.delayedLinks > 0;
          const showOfflineCountBadge = page.offlineLinks > 0;
          const hasIssues =
            showOfflineBadge || showDelayedBadge || showOfflineCountBadge;

          return (
            <div
              key={pageKey}
              className={
                isOpen
                  ? "rounded-lg border border-zinc-200 dark:border-zinc-700"
                  : ""
              }
            >
              <button
                type="button"
                onClick={() =>
                  setOpenPageIndexes((prev) =>
                    prev.includes(originalIndex)
                      ? prev.filter((index) => index !== originalIndex)
                      : [...prev, originalIndex],
                  )
                }
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-base font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700/30"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`${isOpen ? "icon-[lucide--minus]" : "icon-[lucide--plus]"} size-5 shrink-0 text-zinc-500 dark:text-zinc-300`}
                  />
                  <span className="truncate text-sky-600 dark:text-zinc-200">
                    {page.name}
                  </span>
                  <span className="max-w-64 truncate rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
                    {page.url}
                  </span>
                  {!hasIssues && (
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-green-400 text-white">
                      <span className="icon-[lucide--check] size-2.5" />
                    </span>
                  )}
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {showOfflineBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <span className="icon-[lucide--triangle-alert] size-3" />
                      Offline
                    </span>
                  )}
                  {showDelayedBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <span className="icon-[lucide--triangle-alert] size-3" />
                      {page.delayedLinks} atrasados
                    </span>
                  )}
                  {showOfflineCountBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <span className="icon-[lucide--triangle-alert] size-3" />
                      {page.offlineLinks} offline
                    </span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-200 dark:border-zinc-700">
                  <div className="flex flex-col items-center justify-center gap-2 border-b border-zinc-200 p-4 dark:border-zinc-700 md:flex-row md:items-center md:justify-between">
                    <div className="text-base text-zinc-600 dark:text-zinc-300 md:pr-4">
                      {page.description}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        onClick={() => handleEditPage(page.name)}
                        title="Alterar pagina"
                      >
                        <span className="icon-[lucide--pencil] size-4" />
                        Alterar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        onClick={() => handleDeletePage(originalIndex)}
                        title="Apagar pagina"
                      >
                        <span className="icon-[lucide--trash-2] size-4" />
                        Apagar
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div>
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_100px_36px] gap-3 border-b border-zinc-200 pb-2 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        <span className="text-base font-medium">
                          Links da pagina
                        </span>
                        <span className="text-base font-medium">Tam.</span>
                        <span className="text-base font-medium">Data</span>
                        <span className="sr-only">Status</span>
                      </div>

                      {page.links.map((link, linkIndex) => {
                        const isOk = link.status === "ok";

                        return (
                          <div
                            key={`${pageKey}-${link.id}-${linkIndex}`}
                            className={`grid grid-cols-[minmax(0,1fr)_90px_100px_36px] gap-3 py-2 text-sm ${linkIndex < page.links.length - 1 ? "border-b border-zinc-200 dark:border-zinc-700" : ""}`}
                          >
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {link.url}
                            </a>
                            <span className="truncate text-zinc-600 dark:text-zinc-300">
                              {link.size}
                            </span>
                            <span className="truncate text-zinc-600 dark:text-zinc-300">
                              {link.lastUpdate}
                            </span>
                            <span className="inline-flex items-center">
                              {isOk ? (
                                <span className="inline-flex size-4 items-center justify-center rounded-full bg-green-400 text-white">
                                  <span className="icon-[lucide--check] size-2.5" />
                                </span>
                              ) : (
                                <span className="inline-flex size-4 items-center justify-center text-red-600 dark:text-red-400">
                                  <span className="icon-[lucide--triangle-alert] size-4" />
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
  );
}
