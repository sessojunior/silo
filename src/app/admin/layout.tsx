import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { ChatProvider } from "@/context/ChatContext";
import { UserProvider } from "@/context/UserContext";

import { SidebarProvider } from "@/context/SidebarContext";
import { LogoutProvider } from "@/context/LogoutContext";

import Sidebar from "@/components/admin/sidebar/Sidebar";
import Topbar from "@/components/admin/topbar/Topbar";
import BodyScrollLock from "@/components/admin/BodyScrollLock";
import Toast from "@/components/ui/Toast";
import ThemeInitializer from "@/components/admin/ThemeInitializer";

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
  // Verificar se o usuário está autenticado
  // Se o usuário não estiver autenticado, redireciona para a tela de login
  const currentUser = await getAuthUser();
  if (!currentUser) {
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
