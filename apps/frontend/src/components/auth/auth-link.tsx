"use client";

import NextLink from "next/link";

import { markSkipLoginIntro, shouldSkipLoginIntroHref } from "@/lib/auth/login-intro";

export default function AuthLink({
  children,
  href = "",
  onClick = () => {},
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  // Desabilita prefetch para URLs de API para evitar ações destrutivas automáticas
  const isApiRoute = href.startsWith("/api/");
  const prefetch = isApiRoute ? false : undefined;

  return (
    <NextLink
      href={href}
      prefetch={prefetch}
      onClickCapture={() => {
        if (shouldSkipLoginIntroHref(href)) {
          markSkipLoginIntro();
        }
      }}
      onClick={onClick}
      className="font-semibold underline-offset-2 hover:underline"
    >
      {children}
    </NextLink>
  );
}
