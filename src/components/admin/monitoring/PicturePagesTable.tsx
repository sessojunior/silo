"use client";

import React from "react";
import type { PicturePage } from "./PicturePagesAccordion";

type Props = { pages: PicturePage[] };

export default function PicturePagesTable({ pages }: Props) {
  if (!pages || pages.length === 0) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-300">Nenhuma pagina cadastrada.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="text-left text-zinc-600 dark:text-zinc-400">
            <th className="px-3 py-2">Pagina</th>
            <th className="px-3 py-2">URL</th>
            <th className="px-3 py-2">Descricao</th>
            <th className="px-3 py-2">Links</th>
            <th className="px-3 py-2">Atrasados</th>
            <th className="px-3 py-2">Offline</th>
            <th className="px-3 py-2">Ultima atualizacao</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => {
            const offline = page.offlineLinks ?? page.links.filter((l) => l.status === "offline").length;
            const delayed = page.delayedLinks ?? page.links.filter((l) => l.status === "delayed").length;
            const lastUpdate = page.links.reduce((acc, l) => (l.lastUpdate > acc ? l.lastUpdate : acc), "");

            return (
              <tr key={page.id} className="border-t border-zinc-200 dark:border-zinc-700">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{page.name}</td>
                <td className="px-3 py-2 truncate max-w-xs"><a className="text-blue-600 hover:underline dark:text-blue-400" href={page.url} target="_blank" rel="noreferrer">{page.url}</a></td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{page.description}</td>
                <td className="px-3 py-2">{page.links.length}</td>
                <td className="px-3 py-2">{delayed}</td>
                <td className="px-3 py-2">{offline}</td>
                <td className="px-3 py-2">{lastUpdate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
