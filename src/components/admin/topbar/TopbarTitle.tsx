import type { ReactNode } from "react";

export default function TopbarTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-x-2">
      <h2
        className={`inline-flex px-2 pb-1 text-lg sm:text-2xl font-medium text-zinc-800 dark:text-zinc-100 ${className ?? ""}`}
      >
        {children}
      </h2>
    </div>
  );
}
