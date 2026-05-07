import Image from "next/image";
import { config as appConfig } from "@/lib/config";

export default function SidebarLogo() {
  const logoHorizontalLightSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-light.png",
  );
  const logoHorizontalDarkSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-dark.png",
  );

  const VERSION = "26.3.30.1"; // Formato da versão é "Ano.Mês.Dia.Contagem"

  return (
    <div className="flex items-center gap-3">
      <Image
        src={logoHorizontalLightSrc}
        alt="Logo do Silo"
        width={540}
        height={258}
        className="block h-10 w-auto dark:hidden"
      />
      <Image
        src={logoHorizontalDarkSrc}
        alt="Logo do Silo"
        width={540}
        height={258}
        className="hidden h-10 w-auto dark:block"
      />
      <div className="text-zinc-500 dark:text-zinc-400 text-xs mt-1" title="Versão do Silo no formato Ano.Mês.Dia.Hora.Minuto.">v{VERSION}</div>
    </div>
  );
}
