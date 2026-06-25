import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { config } from "@/lib/config";
import { ChatProvider } from "@/context/chat-context";
import {
  UserProvider,
  type InitialUserData,
  type UserGroupInfo,
  type PermissionsSummary,
} from "@/context/user-context";

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
  const currentUser = await getAuthUser();
  if (!currentUser && !smokeMode) {
    redirect("/login");
  }

  // Busca dados completos do perfil (grupos, permissões) no servidor
  // para evitar depender de chamada client-side que pode falhar
  let initialData: InitialUserData | null = null;

  if (currentUser) {
    try {
      const cookieHeader = requestCookies
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const res = await fetch(config.getApiUrl("/api/users/profile"), {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });

      if (res.ok) {
        const body = (await res.json()) as {
          success: boolean;
          data?: {
            user: { id: string; name: string; email: string; isActive: boolean; emailVerified: boolean; image?: string | null };
            userProfile?: Record<string, unknown>;
            groups?: { id: string; name: string; role: string }[];
            permissions?: Record<string, string[]>;
            isAdmin?: boolean;
          };
        };

        if (body.success && body.data) {
          initialData = {
            user: {
              id: body.data.user.id,
              name: body.data.user.name,
              email: body.data.user.email,
              isActive: body.data.user.isActive,
              emailVerified: body.data.user.emailVerified,
              image: body.data.user.image || "/images/profile.png",
            },
            userGroups: (body.data.groups ?? []) as UserGroupInfo[],
            permissions: (body.data.permissions ?? {}) as PermissionsSummary,
            isAdmin: body.data.isAdmin ?? false,
            userProfile: (body.data.userProfile ?? undefined) as InitialUserData["userProfile"],
          };
        }
      }
    } catch (error) {
      console.error("❌ [ADMIN_LAYOUT] Erro ao buscar perfil no servidor:", error);
    }
  }

  // Sessão válida — passa dados iniciais para o UserContext
  return (
    <UserProvider initialData={initialData}>
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
