import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties } from "react";

import AuthToggleTheme from "@/components/auth/auth-toggle-theme";
import AuthImageSlider from "@/components/auth/auth-image-slider";

import Toast from "@/components/ui/toast";
import { config as appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Autenticação do Silo",
  description: "Sistema de gerenciamento de produtos e tarefas.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const logoHorizontalDarkSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-dark.png",
  );
  const logoHorizontalLightSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-light.png",
  );
  const styles = {
    "--auth-bg-image": `url('${appConfig.getPublicPath("/images/background-home.svg")}')`,
  } as CSSProperties;
  return (
    <>
      <div className="flex min-h-screen justify-between">
        <div
          className="h-screen w-full before:absolute before:start-1/2 before:top-0 before:-z-1 before:size-full before:-translate-x-1/2 before:transform before:bg-(image:--auth-bg-image) before:bg-cover before:bg-top before:bg-no-repeat md:w-1/2 md:max-w-150 dark:bg-zinc-900"
          style={styles}
        >
          <div className="scrollbar size-full overflow-y-auto">
            <div className="flex h-full w-full flex-col">
              <div className="flex">
                <div className="flex items-center justify-center gap-1 px-10 pt-10">
                  <Image
                    src={logoHorizontalLightSrc}
                    alt="Logo do Silo"
                    width={540}
                    height={258}
                    className="inline-block h-10 w-auto dark:hidden sm:h-11 md:h-12"
                    unoptimized
                    priority
                  />
                  <Image
                    src={logoHorizontalDarkSrc}
                    alt="Logo do Silo"
                    width={540}
                    height={258}
                    className="hidden h-10 w-auto dark:inline-block sm:h-11 md:h-12"
                    unoptimized
                    priority
                  />
                </div>
              </div>
              <div className="flex grow items-center justify-center">
                {/* Conteúdo */}
                <div className="mx-auto w-full max-w-82.5 px-5 py-10">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide de Imagens */}
        <div className="hidden min-h-screen grow md:flex md:w-1/2 lg:w-1/2">
          <AuthImageSlider />
        </div>

        {/* Alternar modo escuro/claro */}
        <AuthToggleTheme />

        {/* Toast */}
        <Toast />
      </div>
    </>
  );
}
