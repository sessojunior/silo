"use client";

import { HTMLAttributes } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type NavContentProps = {
  children: React.ReactNode;
  className?: string;
  mode?: "viewport-scroll" | "full-no-scroll";
} & HTMLAttributes<HTMLDivElement>;

export default function NavContent({
  children,
  className,
  mode = "viewport-scroll",
  ...props
}: NavContentProps) {
  const isViewportScroll = mode === "viewport-scroll";

  return (
    <div
      className={twMerge(
        clsx("h-full min-h-0 bg-white dark:bg-zinc-800"),
        className,
      )}
      {...props}
    >
      <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
        <div
          className={twMerge(
            clsx(
              "size-full min-h-0",
              isViewportScroll ? "h-[calc(100dvh-140px)]" : "h-full",
              isViewportScroll
                ? "scrollbar overflow-y-auto"
                : "overflow-hidden",
            ),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
