import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ReactNode } from "react";
import ProductTabs from "@/components/admin/nav/product-tabs";
import Content from "@/components/admin/nav/content";
import { config } from "@/lib/config";

interface Props {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ProductsLayout({ children, params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const requestCookies = await cookies();
  const smokeMode = requestCookies.get("silo_smoke_mode")?.value === "1";

  if (smokeMode) {
    const tabs = [
      { label: "Base de conhecimento", url: `/admin/products/${slug}` },
      { label: "Problemas & soluções", url: `/admin/products/${slug}/problems` },
      { label: "Fluxo de dados", url: `/admin/products/${slug}/data-flow` },
    ];

    return (
      <div className="flex w-full flex-col bg-white dark:bg-zinc-900">
        <div className="flex flex-col">
          <div className="fixed inset-x-0 top-16 z-30">
            <div className="lg:pl-65">
              <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
                <ProductTabs modelSlug={slug} modelTurns={[]} tabs={tabs} />
              </div>
            </div>
          </div>
          <div className="pt-19">
            <Content>
              <div className="flex min-h-full w-full flex-col items-start justify-start gap-8 text-zinc-600 dark:text-zinc-200">
                {children}
              </div>
            </Content>
          </div>
        </div>
      </div>
    );
  }

  const reqHeaders = await headers();
  const res = await fetch(config.getApiUrl(`/api/products?slug=${encodeURIComponent(slug)}`), {
    cache: "no-store",
    headers: { cookie: reqHeaders.get("cookie") ?? "" },
  });
  if (!res.ok) notFound();
  const json = await res.json() as {
    success: boolean;
    data?: {
      items?: { slug: string; turns?: unknown[] }[];
      products?: { slug: string; turns?: unknown[] }[];
    };
  };
  const items =
    (Array.isArray(json?.data?.products) && json.data.products.length > 0
      ? json.data.products
      : json?.data?.items) ?? [];
  if (!items.length) notFound();
  const found = items[0];

  // Tabs dinâmicas baseadas no slug
  const tabs = [
    { label: "Base de conhecimento", url: `/admin/products/${slug}` },
    { label: "Problemas & soluções", url: `/admin/products/${slug}/problems` },
    { label: "Fluxo de dados", url: `/admin/products/${slug}/data-flow` },
  ];

  return (
    <div className="flex w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        {/* Botões */}
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <ProductTabs
                tabs={tabs}
                modelSlug={slug}
                modelTurns={
                  Array.isArray(found?.turns)
                    ? found.turns.map((turn) => String(turn))
                    : []
                }
              />
            </div>
          </div>
        </div>
        <div className="pt-19">
          {/* Conteúdo */}
          <Content>
            <div className="flex min-h-full w-full flex-col items-start justify-start gap-8 text-zinc-600 dark:text-zinc-200">
              {children}
            </div>
          </Content>
        </div>
      </div>
    </div>
  );
}
