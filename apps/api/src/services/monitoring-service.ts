/**
 * Monitoring Service — Funções puras para gerenciar monitoramento
 * Manipula páginas de imagens, radar groups, radares e links
 */

import { db } from "@silo/database";
import { picturePage, pictureLink, radarGroup, radar } from "@silo/database/schema";
import { eq, asc, count } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface PicturePageData {
  id: string;
  slug: string;
  name: string;
  url: string;
  description?: string | null;
  updatedAt?: Date;
}

export interface PictureLinkData {
  id: string;
  pageId: string;
  slug: string;
  name?: string | null;
  url: string;
  size?: string | null;
}

export interface RadarGroupData {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  updatedAt?: Date;
}

export interface RadarData {
  id: string;
  slug: string;
  groupId: string;
  name: string;
  description?: string | null;
  webhookUrl?: string | null;
  logUrl?: string | null;
  active: boolean;
  updatedAt?: Date;
}

/**
 * Lista todas as páginas de imagens ordenadas por nome
 */
export async function listPicturePages() {
  const items = await db.select().from(picturePage).orderBy(asc(picturePage.name));
  return items;
}

/**
 * Cria uma nova página de imagens
 */
export async function createPicturePage(data: Omit<PicturePageData, "id">) {
  const id = randomUUID();
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  await db.insert(picturePage).values({
    id,
    slug,
    name: data.name,
    url: data.url,
    description: data.description,
  });

  return { id };
}

/**
 * Atualiza ou cria uma página de imagens (upsert)
 */
export async function upsertPicturePage(data: PicturePageData) {
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  await db
    .insert(picturePage)
    .values({
      id: data.id,
      slug,
      name: data.name,
      url: data.url,
      description: data.description,
      updatedAt: data.updatedAt || new Date(),
    })
    .onConflictDoUpdate({
      target: picturePage.id,
      set: {
        slug,
        name: data.name,
        url: data.url,
        description: data.description,
        updatedAt: data.updatedAt || new Date(),
      },
    });
}

/**
 * Deleta uma página de imagens e seus links
 */
export async function deletePicturePage(id: string) {
  await db.delete(pictureLink).where(eq(pictureLink.pageId, id));
  await db.delete(picturePage).where(eq(picturePage.id, id));
}

/**
 * Atualiza ou cria um link de imagem (upsert)
 */
export async function upsertPictureLink(data: PictureLinkData) {
  await db
    .insert(pictureLink)
    .values({
      id: data.id,
      pageId: data.pageId,
      slug: data.slug,
      name: data.name,
      url: data.url,
      size: data.size,
    })
    .onConflictDoUpdate({
      target: pictureLink.id,
      set: {
        slug: data.slug,
        name: data.name,
        url: data.url,
        size: data.size,
      },
    });
}

/**
 * Deleta um link de imagem
 */
export async function deletePictureLink(id: string) {
  await db.delete(pictureLink).where(eq(pictureLink.id, id));
}

/**
 * Lista todos os radar groups ordenados por sortOrder e nome
 */
export async function listRadarGroups() {
  const groups = await db.select().from(radarGroup).orderBy(asc(radarGroup.sortOrder), asc(radarGroup.name));
  return groups;
}

/**
 * Cria um novo radar group
 */
export async function createRadarGroup(data: RadarGroupData) {
  await db.insert(radarGroup).values({
    id: data.id,
    slug: data.slug,
    name: data.name,
    sortOrder: data.sortOrder,
  });
}

/**
 * Atualiza um radar group
 */
export async function updateRadarGroup(data: RadarGroupData) {
  await db
    .update(radarGroup)
    .set({
      slug: data.slug,
      name: data.name,
      sortOrder: data.sortOrder,
      updatedAt: data.updatedAt || new Date(),
    })
    .where(eq(radarGroup.id, data.id));
}

/**
 * Deleta um radar group (verifica se tem radares vinculados)
 */
export async function deleteRadarGroup(id: string) {
  const [{ value }] = await db.select({ value: count() }).from(radar).where(eq(radar.groupId, id));

  if (Number(value) > 0) {
    throw new Error("Este grupo possui radares vinculados e não pode ser excluído.");
  }

  await db.delete(radarGroup).where(eq(radarGroup.id, id));
}

/**
 * Lista todos os radares ordenados por nome
 */
export async function listRadars() {
  const items = await db.select().from(radar).orderBy(asc(radar.name));
  return items;
}

/**
 * Atualiza ou cria um radar (upsert)
 */
export async function upsertRadar(data: RadarData) {
  await db
    .insert(radar)
    .values({
      id: data.id,
      slug: data.slug,
      groupId: data.groupId,
      name: data.name,
      description: data.description,
      webhookUrl: data.webhookUrl,
      logUrl: data.logUrl,
      active: data.active,
      updatedAt: data.updatedAt || new Date(),
    })
    .onConflictDoUpdate({
      target: radar.id,
      set: {
        slug: data.slug,
        groupId: data.groupId,
        name: data.name,
        description: data.description,
        webhookUrl: data.webhookUrl,
        logUrl: data.logUrl,
        active: data.active,
        updatedAt: data.updatedAt || new Date(),
      },
    });
}

/**
 * Deleta um radar
 */
export async function deleteRadar(id: string) {
  await db.delete(radar).where(eq(radar.id, id));
}
