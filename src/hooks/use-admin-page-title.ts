"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Product } from "@/lib/db/schema";
import type { Project } from "@/types/projects";
import type { ApiResponse } from "@/lib/api-response";
import { config } from "@/lib/config";
import {
  getAdminDynamicTarget,
  resolveAdminPageTitle,
} from "@/lib/navigation/pageTitle";

const productNameCache = new Map<string, string>();
const projectNameCache = new Map<string, string>();

let productsPromise: Promise<void> | null = null;
let projectsPromise: Promise<void> | null = null;

const loadProducts = async (): Promise<void> => {
  if (productsPromise) return productsPromise;

  productsPromise = (async () => {
    const response = await fetch(config.getApiUrl("/api/admin/products"));
    if (!response.ok) return;

    const payload = (await response.json()) as ApiResponse<{ items: Product[] }>;
    const items = payload.data?.items ?? [];

    items
      .filter((product) => product.available)
      .forEach((product) => productNameCache.set(product.slug, product.name));
  })().finally(() => {
    productsPromise = null;
  });

  return productsPromise;
};

const loadProjects = async (): Promise<void> => {
  if (projectsPromise) return projectsPromise;

  projectsPromise = (async () => {
    const response = await fetch(config.getApiUrl("/api/admin/projects"));
    if (!response.ok) return;

    const payload = (await response.json()) as ApiResponse<Project[]>;
    const items = Array.isArray(payload.data) ? payload.data : [];

    items.forEach((project) => projectNameCache.set(project.id, project.name));
  })().finally(() => {
    projectsPromise = null;
  });

  return projectsPromise;
};

export const useAdminPageTitle = (): string => {
  const pathname = usePathname();
  const [title, setTitle] = useState(() =>
    resolveAdminPageTitle(pathname || "/", {
      productsBySlug: productNameCache,
      projectsById: projectNameCache,
    }),
  );

  const dynamicTarget = useMemo(
    () => getAdminDynamicTarget(pathname || "/"),
    [pathname],
  );

  useEffect(() => {
    let cancelled = false;

    const updateTitle = () => {
      if (cancelled) return;
      setTitle(
        resolveAdminPageTitle(pathname || "/", {
          productsBySlug: productNameCache,
          projectsById: projectNameCache,
        }),
      );
    };

    updateTitle();

    const load = async () => {
      try {
        if (dynamicTarget === "product") {
          await loadProducts();
          updateTitle();
          return;
        }

        if (dynamicTarget === "project") {
          await loadProjects();
          updateTitle();
        }
      } catch {
        // Keep fallback title when API fails.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [pathname, dynamicTarget]);

  return title;
};
