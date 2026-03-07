"use client";

import Button from "@/components/admin/nav/Button";

interface ContactsLayoutProps {
  children: React.ReactNode;
}

export default function ContactsLayout({ children }: ContactsLayoutProps) {
  return (
    <div className="flex w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex gap-x-2">
                  <Button href="/admin/contacts" active>
                    Contatos
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full pt-19">
          <div className="scrollbar h-[calc(100dvh-140px)] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
