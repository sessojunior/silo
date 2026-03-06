"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import { config } from "@/lib/config";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SETTINGS_TABS: Array<{ label: string; url: string }> = [
  { label: "Perfil", url: "/admin/settings?tab=profile" },
  { label: "Preferências", url: "/admin/settings?tab=preferences" },
  { label: "Segurança", url: "/admin/settings?tab=security" },
];

const SETTINGS_PRODUCTS_TAB = {
  label: "Produtos",
  url: "/admin/settings/products",
} as const;

const normalizePathname = (pathname: string): string => {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  const basePath = config.publicBasePath;

  const withoutBasePath =
    basePath && (path === basePath || path.startsWith(`${basePath}/`))
      ? path.slice(basePath.length) || "/"
      : path;

  if (withoutBasePath.length > 1 && withoutBasePath.endsWith("/")) {
    return withoutBasePath.slice(0, -1);
  }

  return withoutBasePath;
};

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPathname = normalizePathname(pathname || "/");
  const currentTab = searchParams.get("tab") || "";

  const isSettingsRoot = normalizedPathname === "/admin/settings";
  const isSettingsProductsPage = normalizedPathname === "/admin/settings/products";

  const isTabActive = (url: string): boolean => {
    const tab = new URLSearchParams(url.split("?")[1] || "").get("tab") || "";

    // /admin/settings sem query entra por padrão em Perfil
    if (tab === "profile") {
      return isSettingsRoot && (currentTab.length === 0 || currentTab === "profile");
    }

    return isSettingsRoot && tab.length > 0 && currentTab === tab;
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="sticky top-16 z-30 flex">
          <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex gap-x-2">
                {isSettingsProductsPage ? (
                  <Button
                    href={SETTINGS_PRODUCTS_TAB.url}
                    active={isSettingsProductsPage}
                  >
                    {SETTINGS_PRODUCTS_TAB.label}
                  </Button>
                ) : (
                  SETTINGS_TABS.map((tab) => (
                    <Button
                      key={tab.url}
                      href={tab.url}
                      active={isTabActive(tab.url)}
                    >
                      {tab.label}
                    </Button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
