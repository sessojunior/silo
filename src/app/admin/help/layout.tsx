"use client";

import Button from "@/components/admin/nav/Button";
import ActionButton from "@/components/ui/Button";

interface HelpLayoutProps {
  children: React.ReactNode;
}

export default function HelpLayout({ children }: HelpLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="sticky top-16 z-30 flex">
          <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex gap-x-2">
                <Button href="/admin/help" active>
                  Ajuda
                </Button>
              </div>
              <div className="flex items-center">
                <ActionButton
                  type="button"
                  style="bordered"
                  onClick={() => {
                    window.dispatchEvent(new Event("openHelpEditor"));
                  }}
                >
                  <span className="icon-[lucide--pencil] size-4 mr-1" />
                  Editar ajuda
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
