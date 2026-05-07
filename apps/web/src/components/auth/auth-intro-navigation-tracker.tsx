"use client";

import { useEffect } from "react";

import { isLoginIntroPath, markSkipLoginIntro } from "@/lib/auth/login-intro";

type NavigationLikeEvent = Event & {
  destination?: {
    url?: string;
  };
};

type WindowWithNavigation = Window & {
  navigation?: {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => void;
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => void;
  };
};

export default function AuthIntroNavigationTracker() {
  useEffect(() => {
    const handlePopState = () => {
      if (isLoginIntroPath(window.location.pathname)) {
        markSkipLoginIntro();
      }
    };

    const handleNavigate = (event: Event) => {
      const navigationType = (event as NavigationLikeEvent & { navigationType?: string })
        .navigationType;
      if (navigationType !== "push" && navigationType !== "traverse") {
        return;
      }

      const destinationUrl = (event as NavigationLikeEvent).destination?.url;
      if (typeof destinationUrl !== "string") return;

      try {
        const pathname = new URL(destinationUrl).pathname;
        if (isLoginIntroPath(pathname)) {
          markSkipLoginIntro();
        }
      } catch {
        return;
      }
    };

    window.addEventListener("popstate", handlePopState);

    const navigation = (window as WindowWithNavigation).navigation;
    navigation?.addEventListener("navigate", handleNavigate);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      navigation?.removeEventListener("navigate", handleNavigate);
    };
  }, []);

  return null;
}