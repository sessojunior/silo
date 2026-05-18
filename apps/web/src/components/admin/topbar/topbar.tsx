"use client";

import TopbarDropdown from "@/components/admin/topbar/topbar-dropdown";
import TopbarButton from "@/components/admin/topbar/topbar-button";
import TopbarDivider from "@/components/admin/topbar/topbar-divider";
import ChatNotificationButton from "@/components/admin/topbar/chat-notification-button";
import TopbarTitle from "@/components/admin/topbar/topbar-title";
import ServerClock from "@/components/admin/topbar/server-clock";
import { useSidebar } from "@/context/sidebar-context";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { config } from "@/lib/config";
import { postLoginRedirectPath } from "@/lib/auth/urls";
import type { ApiResponse } from "@/lib/api-response";
import { useAdminPageTitle } from "@/hooks/use-admin-page-title";

export type AccountLinkProps = {
  id: string;
  icon: string;
  title: string;
  url: string;
};

export type AccountProps = AccountLinkProps[];

export default function Topbar() {
  const { isOpenSidebar } = useSidebar();
  const pathname = usePathname();
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loadingChatEnabled, setLoadingChatEnabled] = useState(true);
  const pageTitle = useAdminPageTitle();
  const isDataFlowPage = pathname.includes("/admin/products/") && pathname.endsWith("/data-flow");

  const dataFlowSlug = (() => {
    const match = pathname.match(/\/admin\/products\/([^/]+)\/data-flow$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  })();


  // Verificar se o chat está habilitado para o usuário
  useEffect(() => {
    const checkChatEnabled = async () => {
      try {
        const response = await fetch(config.getApiUrl("/api/admin/users/preferences"));
        if (response.ok) {
          const data = (await response.json()) as ApiResponse<{
            userPreferences?: { chatEnabled?: boolean } | Record<string, never>;
          }>;
          const enabled =
            data.success && data.data?.userPreferences
              ? data.data.userPreferences.chatEnabled !== false
              : true;
          setChatEnabled(enabled);
        }
      } catch (error) {
        console.error(
          "❌ [COMPONENT_TOPBAR] Erro ao verificar preferências do chat:",
          { error },
        );
      } finally {
        setLoadingChatEnabled(false);
      }
    };

    checkChatEnabled();

    // Listener para atualização automática quando preferência de chat mudar
    const handleChatPreferenceChange = (event: CustomEvent) => {
      setChatEnabled(event.detail.chatEnabled);
    };

    window.addEventListener(
      "chatPreferenceChanged",
      handleChatPreferenceChange as EventListener,
    );

    // Cleanup do listener
    return () => {
      window.removeEventListener(
        "chatPreferenceChanged",
        handleChatPreferenceChange as EventListener,
      );
    };
  }, []);

  const dataFlowHeaderTitle = (() => {
    if (!isDataFlowPage || !dataFlowSlug) return null;

    return dataFlowSlug.toUpperCase();
  })();

  // Dados da conta para o dropdown da barra do topo
  const account: AccountProps = [
    {
      id: "0",
      icon: "icon-[lucide--settings]",
      title: "Configurações",
      url: "/admin/settings",
    },
    {
      id: "4",
      icon: "icon-[lucide--log-out]",
      title: "Sair",
      url: "/logout",
    },
  ];

  return (
    <>
      <header
        className={`sticky inset-x-0 top-0 z-40 flex h-16 w-full shrink-0 flex-wrap border-b border-b-zinc-200 bg-white py-2.5 md:flex-nowrap md:justify-start dark:border-zinc-700 dark:bg-zinc-900 ${isOpenSidebar ? "ps-65" : "lg:ps-65"}`}
      >
        <nav className="flex w-full items-center px-4">
          <div className="flex w-full items-center justify-between gap-x-2">
            <div className="flex items-center gap-x-2">
              <div className="lg:hidden">
                {/* Alternar exibir/ocultar menu lateral */}
                <TopbarButton icon="icon-[lucide--menu]" style="menu">
                  Exibir menu lateral
                </TopbarButton>
              </div>

              {/* Título dinâmico da página atual */}
              <div className="flex items-center p-2 min-w-0">
                {dataFlowHeaderTitle ? (
                  <TopbarTitle className="truncate max-w-40 sm:max-w-65 md:max-w-95 lg:max-w-125 xl:max-w-150 2xl:max-w-none">
                    {dataFlowHeaderTitle}
                  </TopbarTitle>
                ) : (
                  <TopbarTitle className="truncate max-w-40 sm:max-w-65 md:max-w-95 lg:max-w-125 xl:max-w-150 2xl:max-w-none">
                    {pageTitle}
                  </TopbarTitle>
                )}
              </div>
            </div>

            {/* Botoes, divisoria e dropdown */}
            <div className="flex flex-row items-center justify-end gap-1">
              <div className="flex items-center gap-2">
                <ServerClock apiUrl={config.getApiUrl("/api/server-time")} />
                <TopbarButton
                  href="/admin/help"
                  icon="icon-[lucide--circle-help]"
                >
                  Ajuda
                </TopbarButton>
              </div>
              <TopbarButton
                href={postLoginRedirectPath}
                icon="icon-[lucide--activity]"
              >
                Atividades
              </TopbarButton>
              <TopbarButton
                href="/admin/settings"
                icon="icon-[lucide--settings]"
              >
                Configurações
              </TopbarButton>
              {!loadingChatEnabled && chatEnabled && (
                <>
                  <TopbarDivider />
                  <ChatNotificationButton />
                  <TopbarDivider />
                </>
              )}
              <TopbarDropdown account={account} />
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}
