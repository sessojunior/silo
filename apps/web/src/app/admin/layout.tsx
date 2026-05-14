import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { ChatProvider } from "@/context/chat-context";
import { UserProvider } from "@/context/user-context";

import { SidebarProvider } from "@/context/sidebar-context";
import { LogoutProvider } from "@/context/logout-context";

import Sidebar from "@/components/admin/sidebar/sidebar";
import Topbar from "@/components/admin/topbar/topbar";
import BodyScrollLock from "@/components/admin/body-scroll-lock";
import Toast from "@/components/ui/toast";
import ThemeInitializer from "@/components/admin/theme-initializer";

export const metadata: Metadata = {
  title: "Administração do Silo",
  description: "Sistema de gerenciamento de produtos e tarefas.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestCookies = await cookies();
  const smokeMode = requestCookies.get("silo_smoke_mode")?.value === "1";

  // Verificar se o usuário está autenticado
  // Se o usuário não estiver autenticado, redireciona para a tela de login
  const currentUser = await getAuthUser();
  if (!currentUser && !smokeMode) {
    redirect("/login");
  }

  // Sessão válida - o UserContext fará a busca dos dados completos
  return (
    <UserProvider>
      <ChatProvider>
        <LogoutProvider>
          {/* Inicializador de tema */}
          <ThemeInitializer />
          <BodyScrollLock />

          <SidebarProvider>
            {/* Barra lateral */}
            <Sidebar />

            <div className="h-dvh w-full overflow-hidden">
              {/* Barra do topo */}
              <Topbar />

              {/* Conteúdo */}
              <main className="scrollbar h-[calc(100dvh-64px)] w-full overflow-x-hidden overflow-y-auto transition-all duration-300 lg:pl-65 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                {/* Contéudo da página */}
                {children}
              </main>
            </div>
          </SidebarProvider>

          {/* Toast */}
          <Toast />
        </LogoutProvider>
      </ChatProvider>
    </UserProvider>
  );
}
