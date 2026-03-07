import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { product } from "@/lib/db/schema";
import { ReactNode } from "react";
import { eq } from "drizzle-orm";
import ProductTabs from "@/components/admin/nav/ProductTabs";
import Content from "@/components/admin/nav/Content";

interface Props {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ProductsLayout({ children, params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const found = await db
    .select()
    .from(product)
    .where(eq(product.slug, slug))
    .limit(1);
  if (!found.length) notFound();

  // Tabs dinâmicas baseadas no slug
  const tabs = [
    { label: "Base de conhecimento", url: `/admin/products/${slug}` },
    { label: "Problemas & soluções", url: `/admin/products/${slug}/problems` },
    { label: "Fluxo de dados (Fake)", url: `/admin/products/${slug}/data-flow` },
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
                  Array.isArray(found[0]?.turns)
                    ? found[0].turns.map((turn) => String(turn))
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
