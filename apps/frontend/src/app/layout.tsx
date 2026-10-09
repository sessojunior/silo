import type { Metadata } from "next";
import "@/app/globals.css";

import AuthIntroNavigationTracker from "@/components/auth/auth-intro-navigation-tracker";

export const metadata: Metadata = {
  title: "Silo",
  description: "Sistema de gerenciamento de produtos e tarefas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className="antialiased bg-white dark:bg-zinc-900">
        <AuthIntroNavigationTracker />
        {children}
      </body>
    </html>
  );
}
