import { promises as fs, mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config } from "@silo/engine/config";

export type UploadKind =
  | "general"
  | "avatars"
  | "contacts"
  | "incidents"
  | "problems"
  | "solutions"
  | "manual"
  | "help"
  | "projects";

const uploadKinds: ReadonlyArray<UploadKind> = [
  "general",
  "avatars",
  "contacts",
  "incidents",
  "problems",
  "solutions",
  "manual",
  "help",
  "projects",
];

export const isUploadKind = (value: string): value is UploadKind =>
  uploadKinds.includes(value as UploadKind);

const maxFileSizeBytes = 4 * 1024 * 1024;

export const getUploadsRoot = (): string =>
  config.uploadsDir;

export const ensureUploadDir = (kind: UploadKind): string => {
  const dirPath = path.join(getUploadsRoot(), kind);
  mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

export async function listUploadFiles(
  kind: UploadKind,
): Promise<Array<{ filename: string; url: string; size: number; mtime: number }>> {
  const dirPath = path.join(getUploadsRoot(), kind);

  let files: string[] = [];
  try {
    files = await fs.readdir(dirPath);
  } catch {
    return [];
  }

  const stats = await Promise.all(
    files.map(async (filename) => {
      try {
        const stat = await fs.stat(path.join(dirPath, filename));
        return {
          filename,
          url: `/uploads/${kind}/${filename}`,
          size: stat.size,
          mtime: stat.mtimeMs,
        };
      } catch {
        return null;
      }
    }),
  );

  return stats
    .filter((item): item is { filename: string; url: string; size: number; mtime: number } => item !== null)
    .sort((leftItem, rightItem) => rightItem.mtime - leftItem.mtime);
}

const createWebpFilename = (originalName: string): string => {
  const baseName = path.basename(originalName).replace(/\.[^/.]+$/, "");
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 40);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const prefix = Date.now().toString(10);
  const namePart = safeBaseName.length > 0 ? `${safeBaseName}-` : "";
  return `${prefix}-${namePart}${suffix}.webp`;
};

export type ImageProcessOptions =
  | { mode: "square"; size: number; quality: number }
  | { mode: "inside"; maxWidth: number; maxHeight: number; quality: number };

export type StoredUpload = {
  filename: string;
  originalName: string;
  size: number;
  url: string;
};

const toBuffer = async (file: File): Promise<Buffer> =>
  Buffer.from(await file.arrayBuffer());

export const storeImageAsWebp = async (params: {
  file: File;
  kind: UploadKind;
  options: ImageProcessOptions;
}): Promise<StoredUpload | { error: string }> => {
  const { file, kind, options } = params;

  if (file.size > maxFileSizeBytes) {
    return { error: "Arquivo muito grande. Máximo 4MB." };
  }

  try {
    // Dynamic import of sharp to avoid import issues
    const sharp = (await import("sharp")).default;
    const buffer = await toBuffer(file);

    // Validate format
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) {
      return { error: "Tipo de arquivo não permitido." };
    }

    const filename = createWebpFilename(file.name);
    const dirPath = ensureUploadDir(kind);
    const filePath = path.join(dirPath, filename);

    let image = sharp(buffer).rotate();
    if (options.mode === "square") {
      image = image.resize(options.size, options.size, { fit: "cover" }).webp({ quality: options.quality });
    } else {
      image = image.resize(options.maxWidth, options.maxHeight, { fit: "inside", withoutEnlargement: true }).webp({ quality: options.quality });
    }

    const processed = await image.toBuffer();
    await fs.writeFile(filePath, processed);

    const url = `/uploads/${kind}/${filename}`;
    return { filename, originalName: file.name, size: file.size, url };
  } catch {
    return { error: "Erro ao processar imagem." };
  }
};

export const getUploadFilePath = (kind: UploadKind, filename: string): string =>
  path.join(getUploadsRoot(), kind, filename);

export const storeBufferAsWebp = async (
  kind: UploadKind,
  originalName: string,
  buffer: Buffer,
  options: ImageProcessOptions = { mode: "inside", maxWidth: 1920, maxHeight: 1080, quality: 85 }
): Promise<string | { error: string }> => {
  if (buffer.length > maxFileSizeBytes) {
    return { error: "Arquivo muito grande. Máximo 4MB." };
  }
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) {
      return { error: "Tipo de arquivo não permitido." };
    }
    const filename = createWebpFilename(originalName);
    const dirPath = ensureUploadDir(kind);
    const filePath = path.join(dirPath, filename);
    let image = sharp(buffer).rotate();
    if (options.mode === "square") {
      image = image.resize(options.size, options.size, { fit: "cover" }).webp({ quality: options.quality });
    } else {
      image = image.resize(options.maxWidth, options.maxHeight, { fit: "inside", withoutEnlargement: true }).webp({ quality: options.quality });
    }
    const processed = await image.toBuffer();
    await fs.writeFile(filePath, processed);
    return filename;
  } catch {
    return { error: "Erro ao processar imagem." };
  }
};

export const deleteUploadFile = async (
  kind: UploadKind,
  filename: string,
): Promise<boolean> => {
  try {
    await fs.unlink(getUploadFilePath(kind, filename));
    return true;
  } catch {
    return false;
  }
};

export const isSafeFilename = (filename: string): boolean => {
  if (filename.includes("..")) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  return path.basename(filename) === filename;
};

export const getContentTypeFromFilename = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
};
