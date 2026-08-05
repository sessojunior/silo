"use client";

import { useEffect } from "react";
import { applySavedTheme } from "@silo/engine/format/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    // Aplicar tema salvo no localStorage quando o componente monta
    applySavedTheme();
  }, []);

  // Este componente não renderiza nada, apenas inicializa o tema
  return null;
}
