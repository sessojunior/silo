import Image from "next/image";
import { config as appConfig } from "@/lib/config";

export default function SidebarLogo() {
  const logoSrc = appConfig.getPublicPath("/images/logo.png");

  const VERSION = "26.3.14.0057"; // Formato da versão é "Ano.Mês.Dia.HoraMinuto"

  return (
    <div className="flex items-center">
      <Image
        src={logoSrc}
        alt="Logo"
        width={32}
        height={32}
        className="-ml-1 block h-8 w-8"
        unoptimized
      />
      <div
        className={`inline-block px-1 text-zinc-600 dark:text-zinc-200 text-2xl font-bold tracking-[-0.5px] flex-1 m-0 uppercase`}
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        SILO
      </div>
      <div className="text-zinc-500 dark:text-zinc-400 text-xs ml-2 mt-1" title="Versão do Silo no formato Ano.Mês.Dia.Hora.Minuto.">v{VERSION}</div>
    </div>
  );
}
