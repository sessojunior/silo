import { ProductStatus } from "@/lib/productStatus";
import Link from "next/link";

type TurnProgress = {
  turn: string;
  status: ProductStatus;
  progress: number;
};

type ProductMonitoringItem = {
  productId: string;
  model: string;
  description?: string;
  turns: TurnProgress[];
};

export type MonitoringProductItem = ProductMonitoringItem;

export type MonitoringProductsFile = {
  referenceDate: string;
  products: ProductMonitoringItem[];
};

type ProductMonitoringCardsProps = {
  data: MonitoringProductsFile;
};

type VisualTurnState = "ok" | "problem" | "not_run";

const TRACK_CLASS_BY_VISUAL_STATE: Record<VisualTurnState, string> = {
  ok: "bg-green-100 dark:bg-green-950/40",
  problem: "bg-red-100 dark:bg-red-950/40",
  not_run: "bg-zinc-200 dark:bg-zinc-800",
};

const FILL_CLASS_BY_VISUAL_STATE: Record<VisualTurnState, string> = {
  ok: "bg-green-500",
  problem: "bg-red-500",
  not_run: "bg-zinc-400 dark:bg-zinc-500",
};

function toVisualState(status: ProductStatus): VisualTurnState {
  if (status === "completed") return "ok";

  if (status === "with_problems" || status === "run_again" || status === "under_support") {
    return "problem";
  }

  return "not_run";
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatTurnLabel(turn: string): string {
  return `Turno ${String(turn).padStart(2, "0")}h`;
}

function formatReferenceDate(date: string): string {
  // Espera formato YYYY-MM-DD ou similar
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export default function ProductMonitoringCards({ data }: ProductMonitoringCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {data.products.map((product, productIndex) => {
        return (
          <article
            key={`${product.productId}-${productIndex}`}
            className="rounded-xl border border-zinc-200 bg-white px-4 pt-4 pb-6 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
          >
            <header className="-mx-4 mb-4 border-b border-zinc-200 px-4 pb-3 dark:border-zinc-700">
              <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{product.model}</h4>
              {product.description ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{product.description}</p>
              ) : null}
            </header>

            <div className="space-y-3">
              {product.turns.map((turn, turnIndex) => {
                const visualState = toVisualState(turn.status);
                const turnProgress = clampProgress(turn.progress);

                return (
                  <div key={`${product.productId}-${turn.turn}-${turnIndex}`} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/products/${encodeURIComponent(product.productId)}/data-flow?date=${encodeURIComponent(data.referenceDate)}&turn=${encodeURIComponent(turn.turn)}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {formatTurnLabel(turn.turn)}
                        </Link>
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                          &middot; {formatReferenceDate(data.referenceDate)}
                        </span>
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{turnProgress}%</span>
                    </div>

                    <div className={`h-2 w-full overflow-hidden rounded-full ${TRACK_CLASS_BY_VISUAL_STATE[visualState]}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${FILL_CLASS_BY_VISUAL_STATE[visualState]}`}
                        style={{ width: `${turnProgress}%` }}
                        aria-label={`${product.model} ${formatTurnLabel(turn.turn)} ${turnProgress}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
