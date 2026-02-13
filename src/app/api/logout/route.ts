import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { config as appConfig } from "@/lib/config";

// Faz logout do usuário

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    await auth.api.signOut({
      headers: await headers(),
    });

    const cookieNamesToDelete = [
      "session_token",
      "__Secure-session_token",
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
      "better-auth.session_data",
      "__Secure-better-auth.session_data",
      "better-auth.dont_remember",
      "__Secure-better-auth.dont_remember",
    ];

    for (const name of cookieNamesToDelete) {
      if (cookieStore.get(name)) cookieStore.delete(name);
    }

    return NextResponse.redirect(
      new URL(appConfig.getApiUrl("/login")),
    );
  } catch (error) {
    console.error("❌ [API_LOGOUT] Erro ao fazer logout:", { error });
    return NextResponse.redirect(
      new URL(appConfig.getApiUrl("/login")),
    );
  }
}
