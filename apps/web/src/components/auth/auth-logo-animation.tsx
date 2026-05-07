"use client";

import Image from "next/image";
import type { AnimationEvent, CSSProperties } from "react";

import { config } from "@/lib/config";

type AuthLogoAnimationProps = {
  fullScreen?: boolean;
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  onAnimationComplete?: () => void;
};

const logoImageSrc = config.getPublicPath("/images/logo-image.png");
const logoTextDarkSrc = config.getPublicPath("/images/logo-text-dark.png");
const logoTextLightSrc = config.getPublicPath("/images/logo-text-light.png");

const logoImageStartWidth = 172;
const logoImageStartHeight = 258;
const logoImageFinalWidth = 103;
const logoImageFinalHeight = 155;
const logoGroupWidth = 324;
const logoGroupHeight = 155;
const logoGroupFinalWidth = 100;
const logoGroupGap = 15;
const logoTextFinalWidth = logoGroupWidth - logoImageFinalWidth - logoGroupGap;
const logoTextFinalHeight = Math.round((logoTextFinalWidth * 152) / 338);
const logoTextFinalLeft = logoImageFinalWidth + logoGroupGap;
const logoTextStartOffsetX = 138;
const logoGroupFinalScale = logoGroupFinalWidth / logoGroupWidth;
const logoGroupCenterY = logoGroupHeight / 2;
const logoImageStartCenterX = logoGroupWidth / 2;
const logoImageFinalCenterX = logoImageFinalWidth / 2;
const logoTextCenterY = logoGroupCenterY;

const animationStyles = `
@keyframes auth-logo-animation-backdrop {
  0% {
    opacity: 1;
  }

  58% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@keyframes auth-logo-animation-icon {
  0% {
    left: var(--auth-logo-icon-start-center-x);
    top: var(--auth-logo-center-y);
    width: var(--auth-logo-icon-start-width);
    height: var(--auth-logo-icon-start-height);
    opacity: 1;
    transform: translate3d(-50%, -50%, 0);
  }

  24% {
    opacity: 1;
    left: var(--auth-logo-icon-start-center-x);
    top: var(--auth-logo-center-y);
    width: var(--auth-logo-icon-final-width);
    height: var(--auth-logo-icon-final-height);
    transform: translate3d(-50%, -50%, 0);
  }

  40% {
    opacity: 1;
    left: var(--auth-logo-icon-final-center-x);
    top: var(--auth-logo-center-y);
    width: var(--auth-logo-icon-final-width);
    height: var(--auth-logo-icon-final-height);
    transform: translate3d(-50%, -50%, 0);
  }

  100% {
    opacity: 1;
    left: var(--auth-logo-icon-final-center-x);
    top: var(--auth-logo-center-y);
    width: var(--auth-logo-icon-final-width);
    height: var(--auth-logo-icon-final-height);
    transform: translate3d(-50%, -50%, 0);
  }
}

@keyframes auth-logo-animation-text {
  0% {
    opacity: 0;
    transform: translate3d(var(--auth-logo-text-start-offset-x), 0, 0)
      rotate(-45deg) scale(0.16);
  }

  12% {
    opacity: 0.14;
    transform: translate3d(calc(var(--auth-logo-text-start-offset-x) - 8px), 0, 0)
      rotate(-40deg) scale(0.28);
  }

  28% {
    opacity: 0.74;
    transform: translate3d(calc(var(--auth-logo-text-start-offset-x) - 32px), 0, 0)
      rotate(-20deg) scale(0.72);
  }

  44% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }

  56% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
}

@keyframes auth-logo-animation-shell {
  0% {
    opacity: 1;
    left: 50%;
    top: 50%;
    transform: translate3d(-50%, -50%, 0) scale(1);
  }

  56% {
    opacity: 1;
    left: 50%;
    top: 50%;
    transform: translate3d(-50%, -50%, 0) scale(1);
  }

  100% {
    opacity: 0;
    left: 40px;
    top: 40px;
    transform: translate3d(0, 0, 0) scale(var(--auth-logo-shell-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-logo-animation,
  .auth-logo-animation *,
  .auth-logo-animation *::before,
  .auth-logo-animation *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
`;

export default function AuthLogoAnimation({
  fullScreen = false,
  className,
  logoClassName,
  textClassName,
  onAnimationComplete,
}: AuthLogoAnimationProps) {
  const stageStyles = {
    "--auth-logo-stage-width": `${logoGroupWidth}px`,
    "--auth-logo-stage-height": `${logoGroupHeight}px`,
    "--auth-logo-icon-start-width": `${logoImageStartWidth}px`,
    "--auth-logo-icon-start-height": `${logoImageStartHeight}px`,
    "--auth-logo-icon-final-width": `${logoImageFinalWidth}px`,
    "--auth-logo-icon-final-height": `${logoImageFinalHeight}px`,
    "--auth-logo-icon-start-center-x": `${logoImageStartCenterX}px`,
    "--auth-logo-icon-final-center-x": `${logoImageFinalCenterX}px`,
    "--auth-logo-center-y": `${logoGroupCenterY}px`,
    "--auth-logo-text-final-width": `${logoTextFinalWidth}px`,
    "--auth-logo-text-final-height": `${logoTextFinalHeight}px`,
    "--auth-logo-text-left": `${logoTextFinalLeft}px`,
    "--auth-logo-text-start-offset-x": `${logoTextStartOffsetX}px`,
    "--auth-logo-text-center-y": `${logoTextCenterY}px`,
    "--auth-logo-shell-scale": `${logoGroupFinalScale}`,
  } as CSSProperties;

  return (
    <>
      <style>{animationStyles}</style>

      <div
        className={`auth-logo-animation w-full ${fullScreen ? "fixed inset-0 z-9999 overflow-hidden" : "relative flex items-center justify-center"} ${className ?? ""}`}
        aria-hidden="true"
        style={stageStyles}
      >
        {fullScreen ? (
          <div
            className="absolute inset-0 bg-white dark:bg-zinc-950"
            style={{
              animation:
                "auth-logo-animation-backdrop 3000ms cubic-bezier(0.2,0.9,0.2,1) both",
            }}
          />
        ) : null}

        <div
          className={`overflow-visible ${fullScreen ? "absolute" : "relative"}`}
          style={{
            height: "var(--auth-logo-stage-height)",
            width: "var(--auth-logo-stage-width)",
            left: fullScreen ? "50%" : undefined,
            top: fullScreen ? "50%" : undefined,
            transform: fullScreen ? "translate3d(-50%, -50%, 0)" : undefined,
            transformOrigin: "top left",
            animation: fullScreen
              ? "auth-logo-animation-shell 3000ms cubic-bezier(0.2,0.9,0.2,1) both"
              : undefined,
          }}
          onAnimationEnd={(event: AnimationEvent<HTMLDivElement>) => {
            if (!fullScreen) return;
            if (event.currentTarget !== event.target) return;
            onAnimationComplete?.();
          }}
        >
          <div className="relative h-full w-full overflow-visible">
            <div
              className={`absolute overflow-visible ${logoClassName ?? ""}`}
              style={{
                zIndex: 1,
                animation:
                  "auth-logo-animation-icon 3000ms cubic-bezier(0.2,0.9,0.2,1) both",
              }}
            >
              <Image
                src={logoImageSrc}
                alt=""
                width={logoImageStartWidth}
                height={logoImageStartHeight}
                unoptimized
                priority
                draggable={false}
                sizes="172px"
                className="block h-full w-full select-none"
                style={{ objectFit: "contain" }}
              />
            </div>

            <div
              className={`absolute overflow-visible ${textClassName ?? ""}`}
              style={{
                zIndex: 2,
                left: "var(--auth-logo-text-left)",
                top: "var(--auth-logo-text-center-y)",
                width: "var(--auth-logo-text-final-width)",
                height: "var(--auth-logo-text-final-height)",
                transform: "translate3d(0, -50%, 0)",
              }}
            >
              <div
                className="absolute inset-0 overflow-visible"
                style={{
                  transformOrigin: "left center",
                  willChange: "transform, opacity",
                  backfaceVisibility: "hidden",
                  animation:
                    "auth-logo-animation-text 3000ms cubic-bezier(0.2,0.9,0.2,1) both",
                }}
              >
                <Image
                  src={logoTextDarkSrc}
                  alt=""
                  width={338}
                  height={152}
                  priority
                  draggable={false}
                  sizes="206px"
                  className="hidden h-full w-full select-none dark:block"
                  style={{ objectFit: "contain" }}
                />
                <Image
                  src={logoTextLightSrc}
                  alt=""
                  width={338}
                  height={152}
                  priority
                  draggable={false}
                  sizes="206px"
                  className="block h-full w-full select-none dark:hidden"
                  style={{ objectFit: "contain" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}