import Image from "next/image";
import { config as appConfig } from "@/lib/config";

export default function SidebarLogo() {
  const logoHorizontalLightSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-light.png",
  );
  const logoHorizontalDarkSrc = appConfig.getPublicPath(
    "/images/logo-horizontal-dark.png",
  );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <Image
          src={logoHorizontalLightSrc}
          alt="Logo do Silo"
          width={540}
          height={258}
          className="inline-block h-10 w-auto dark:hidden"
        />
        <Image
          src={logoHorizontalDarkSrc}
          alt="Logo do Silo"
          width={540}
          height={258}
          className="hidden h-10 w-auto dark:inline-block"
        />
      </div>
      <div
        className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
        title="Versão do Silo"
      >
        v{appConfig.appVersion}
      </div>
    </div>
  );
}
