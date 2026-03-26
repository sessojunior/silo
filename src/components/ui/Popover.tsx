"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

type Position =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center"
  | "right-bottom"
  | "left-bottom";

interface PopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: Position;
  className?: string;
  onClick?: () => void;
}

const positionMap: Record<Position, string> = {
  "top-left": "bottom-full left-0 mb-2",
  "top-right": "bottom-full right-0 mb-2",
  "top-center": "bottom-full left-1/2 -translate-x-1/2 mb-2",
  "bottom-left": "top-full left-0 mt-2",
  "bottom-right": "top-full right-0 mt-2",
  "bottom-center": "top-full left-1/2 -translate-x-1/2 mt-2",
  "right-bottom": "left-full top-full ml-2",
  "left-bottom": "right-full top-full mr-2",
};

export default function Popover({
  children,
  content,
  position = "top-center",
  className,
  onClick,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleClosePopovers() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("close-popovers", handleClosePopovers);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("close-popovers", handleClosePopovers);
    };
  }, []);


  const handleClick = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setReady(false);
      if (onClick) onClick();
      return next;
    });
  };

  // Mede e posiciona o popover após renderizar
  useEffect(() => {
    if (!open) return;
    if (!buttonRef.current || !popoverRef.current) return;
    // Mede após o mount
    const popover = popoverRef.current;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const spacing = 8;
    let top = 0, left = 0;
    switch (position) {
      case "top-left":
        top = buttonRect.top - popover.offsetHeight - spacing;
        left = buttonRect.left;
        break;
      case "top-right":
        top = buttonRect.top - popover.offsetHeight - spacing;
        left = buttonRect.right - popover.offsetWidth;
        break;
      case "top-center":
        top = buttonRect.top - popover.offsetHeight - spacing;
        left = buttonRect.left + buttonRect.width / 2 - popover.offsetWidth / 2;
        break;
      case "bottom-left":
        top = buttonRect.bottom + spacing;
        left = buttonRect.left;
        break;
      case "bottom-right":
        top = buttonRect.bottom + spacing;
        left = buttonRect.right - popover.offsetWidth;
        break;
      case "bottom-center":
        top = buttonRect.bottom + spacing;
        left = buttonRect.left + buttonRect.width / 2 - popover.offsetWidth / 2;
        break;
      case "right-bottom":
        top = buttonRect.bottom;
        left = buttonRect.right + spacing;
        break;
      case "left-bottom":
        top = buttonRect.bottom;
        left = buttonRect.left - popover.offsetWidth - spacing;
        break;
      default:
        top = buttonRect.bottom + spacing;
        left = buttonRect.left;
    }
    setPopoverStyle({
      position: "absolute",
      top: Math.max(top, 8),
      left: Math.max(left, 8),
      zIndex: 1050,
      opacity: 1,
      pointerEvents: "auto",
      transition: "opacity 0.15s"
    });
    setReady(true);
    // eslint-disable-next-line
  }, [open, position, content, children]);

  return (
    <>
      <span className="inline-block" ref={buttonRef}>
        <button onClick={handleClick} className="focus:outline-none">
          {children}
        </button>
      </span>
      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={ready ? popoverStyle : { opacity: 0, pointerEvents: "none", position: "absolute" }}
          className={twMerge(
            clsx(
              "rounded-xl border bg-white shadow-md transition-opacity dark:bg-zinc-800",
              "border-zinc-200 dark:border-zinc-700",
              className,
            ),
          )}
          onClick={e => {
            // Fecha ao clicar em links ou botões
            const target = e.target as HTMLElement;
            if (
              target.closest('a,button,[role="menuitem"],[data-popover-close]')
            ) {
              setOpen(false);
            }
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
