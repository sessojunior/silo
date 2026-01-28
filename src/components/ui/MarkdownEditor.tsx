"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "easymde/dist/easymde.min.css";
import type { Options as SimpleMdeOptions } from "easymde";
import type EasyMDE from "easymde";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import UploadButtonLocal from "@/components/ui/UploadButtonLocal";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";
import { normalizeUploadsSrc } from "@/lib/utils";
import Image from "next/image";
import Lightbox from "@/components/ui/Lightbox";

const SimpleMdeReact = dynamic(() => import("react-simplemde-editor"), {
  ssr: false,
});

const defaultOptions: SimpleMdeOptions = {
  autofocus: true,
  spellChecker: false,
};

const markdownEditorStyles = `
.EasyMDEContainer .CodeMirror{font-size:1rem;line-height:1.6}
.EasyMDEContainer .CodeMirror .cm-header-1{font-size:1.5rem;font-weight:700}
.EasyMDEContainer .CodeMirror .cm-header-2{font-size:1.25rem;font-weight:600}
.EasyMDEContainer .CodeMirror .cm-header-3{font-size:1.125rem;font-weight:500}
.EasyMDEContainer .CodeMirror .cm-header-4{font-size:1rem;font-weight:500}
.EasyMDEContainer .CodeMirror-line{padding:0.25rem 0}
.EasyMDEContainer .editor-preview,
.EasyMDEContainer .editor-preview-side{font-size:1rem;line-height:1.6}
.EasyMDEContainer .editor-preview h1,
.EasyMDEContainer .editor-preview-side h1{font-size:1.5rem;font-weight:700;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h2,
.EasyMDEContainer .editor-preview-side h2{font-size:1.25rem;font-weight:600;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h3,
.EasyMDEContainer .editor-preview-side h3{font-size:1.125rem;font-weight:500;margin:0.5rem 0}
.EasyMDEContainer .editor-preview h4,
.EasyMDEContainer .editor-preview-side h4{font-size:1rem;font-weight:500;margin:0.5rem 0}
.EasyMDEContainer .editor-preview p,
.EasyMDEContainer .editor-preview-side p{margin:0.5rem 0}
.EasyMDEContainer .editor-preview ul,
.EasyMDEContainer .editor-preview-side ul{padding-left:1.25rem;list-style:disc}
.EasyMDEContainer .editor-preview ol,
.EasyMDEContainer .editor-preview-side ol{padding-left:1rem;list-style:decimal}
.EasyMDEContainer .editor-preview blockquote,
.EasyMDEContainer .editor-preview-side blockquote{border-left:4px solid rgb(228 228 231);padding-left:1rem;font-style:italic}
.EasyMDEContainer .editor-preview pre,
.EasyMDEContainer .editor-preview-side pre{background-color:rgb(244 244 245);padding:0.75rem;border-radius:0.5rem;overflow:auto}
.EasyMDEContainer .editor-preview code,
.EasyMDEContainer .editor-preview-side code{background-color:rgb(244 244 245);padding:0.125rem 0.25rem;border-radius:0.25rem;font-size:0.75rem}
.dark .EasyMDEContainer .editor-preview blockquote,
.dark .EasyMDEContainer .editor-preview-side blockquote{border-color:rgb(63 63 70)}
.dark .EasyMDEContainer .editor-preview pre,
.dark .EasyMDEContainer .editor-preview-side pre{background-color:rgb(39 39 42)}
.dark .EasyMDEContainer .editor-preview code,
.dark .EasyMDEContainer .editor-preview-side code{background-color:rgb(39 39 42)}
.EasyMDEContainer .editor-toolbar a.markdown-gallery{display:inline-flex;align-items:center;justify-content:center}
`;

type UploadEndpoint =
  | "general"
  | "avatarUploader"
  | "contactImageUploader"
  | "incidentImageUploader"
  | "problemImageUploader"
  | "solutionImageUploader"
  | "manualImageUploader"
  | "helpImageUploader"
  | "projectImageUploader";

type MarkdownEditorUploadConfig = {
  enabled: boolean;
  showButton?: boolean;
  uploadEndpoint: UploadEndpoint;
  listEndpoint: string;
  deleteEndpoint: string;
  directory: string;
  title?: string;
  description?: string;
};

type GalleryImage = {
  filename: string;
  url: string;
  size: number;
  mtime: number;
};

type ArrayOneOrMore<T> = [T, ...T[]];

type ToolbarButtonName =
  | "bold"
  | "italic"
  | "quote"
  | "unordered-list"
  | "ordered-list"
  | "link"
  | "image"
  | "upload-image"
  | "strikethrough"
  | "code"
  | "table"
  | "redo"
  | "heading"
  | "undo"
  | "heading-bigger"
  | "heading-smaller"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "clean-block"
  | "horizontal-rule"
  | "preview"
  | "side-by-side"
  | "fullscreen"
  | "guide";

type ToolbarIcon = {
  name: string;
  action: string | ((editor: EasyMDE) => void);
  className: string;
  title: string;
  noDisable?: boolean;
  noMobile?: boolean;
  icon?: string;
  attributes?: Record<string, string>;
};

type ToolbarDropdownIcon = {
  name: string;
  children: ArrayOneOrMore<ToolbarIcon | ToolbarButtonName>;
  className: string;
  title: string;
  noDisable?: boolean;
  noMobile?: boolean;
};

type ToolbarItem = "|" | ToolbarButtonName | ToolbarIcon | ToolbarDropdownIcon;
type ToolbarConfig = ReadonlyArray<ToolbarItem>;

const toolbarTitles: Record<string, string> = {
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título",
  quote: "Citação",
  code: "Código",
  "unordered-list": "Lista não ordenada",
  "ordered-list": "Lista ordenada",
  table: "Tabela",
  "horizontal-rule": "Linha horizontal",
  link: "Link",
  image: "Imagem",
  preview: "Visualizar",
  "side-by-side": "Lado a lado",
  fullscreen: "Tela cheia",
  "guide": "Ajuda",
  "strikethrough": "Tachado",
};

const baseToolbar: ToolbarConfig = [
  "bold",
  "italic",
  "heading",
  "|",
  "quote",
  "code",
  "unordered-list",
  "ordered-list",
  "table",
  "horizontal-rule",
  "|",
  "link",
  "image",
  "|",
  "preview",
  "side-by-side",
  "fullscreen",
];

const getToolbarItemName = (item: ToolbarItem): string | null => {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "name" in item) {
    return typeof item.name === "string" ? item.name : null;
  }
  return null;
};

const getToolbarConfig = (
  toolbar?: SimpleMdeOptions["toolbar"],
): ToolbarConfig => {
  if (toolbar === false) return [];
  if (Array.isArray(toolbar)) return toolbar;
  return baseToolbar;
};

const normalizeToolbar = (toolbar?: SimpleMdeOptions["toolbar"]): ToolbarConfig =>
  getToolbarConfig(toolbar);

const insertGalleryButton = (
  toolbar: ToolbarConfig,
  button: EasyMDE.ToolbarIcon | null,
): ReadonlyArray<ToolbarItem> => {
  if (!button) return toolbar;
  const hasButton = toolbar.some(
    (item: ToolbarItem) => getToolbarItemName(item) === "markdown-gallery",
  );
  if (hasButton) return toolbar;
  const imageIndex = toolbar.findIndex(
    (item: ToolbarItem) => getToolbarItemName(item) === "image",
  );
  if (imageIndex >= 0) {
    return [
      ...toolbar.slice(0, imageIndex + 1),
      button,
      ...toolbar.slice(imageIndex + 1),
    ] as ToolbarConfig;
  }
  const previewIndex = toolbar.findIndex(
    (item: ToolbarItem) => getToolbarItemName(item) === "preview",
  );
  if (previewIndex >= 0) {
    return [
      ...toolbar.slice(0, previewIndex),
      button,
      ...toolbar.slice(previewIndex),
    ] as ToolbarConfig;
  }
  return [...toolbar, button] as ToolbarConfig;
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  options?: SimpleMdeOptions;
  className?: string;
  uploadConfig?: MarkdownEditorUploadConfig;
}

export default function MarkdownEditor({
  value,
  onChange,
  options,
  className,
  uploadConfig,
}: MarkdownEditorProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryImage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentEditor, setCurrentEditor] = useState<EasyMDE | null>(null);

  const toPublicUploadsSrc = (input: string): string => {
    const normalized = normalizeUploadsSrc(input);
    if (normalized.startsWith("/uploads/")) return config.getPublicPath(normalized);
    return normalized;
  };

  const loadImages = useCallback(async () => {
    if (!uploadConfig) return;
    try {
      const res = await fetch(config.getApiUrl(uploadConfig.listEndpoint));
      const data = await res.json();
      if (res.ok && data?.data?.items) {
        setImages(Array.isArray(data.data.items) ? data.data.items : []);
      }
    } catch {
      toast({ type: "error", title: "Erro ao carregar imagens" });
    }
  }, [uploadConfig]);

  useEffect(() => {
    if (galleryOpen) {
      void loadImages();
    }
  }, [galleryOpen, loadImages]);

  const mergedOptions = useMemo(() => {
    const toolbarBase = normalizeToolbar(options?.toolbar);
    const showButton =
      uploadConfig?.enabled && (uploadConfig.showButton ?? true);
    const galleryButton: EasyMDE.ToolbarIcon | null = showButton
      ? {
          name: "markdown-gallery",
          className: "markdown-gallery",
          icon: '<span class="inline-block -mb-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="14" rx="2" ry="2"/><path d="m3 13 4-4a3 3 0 0 1 4 0l5 5"/><path d="m14 8 1-1a3 3 0 0 1 4 0l2 2"/><rect x="7" y="17" width="14" height="4" rx="1"/></svg></span>',
          title: "Inserir imagem da galeria",
          action: (editor: EasyMDE) => {
            setCurrentEditor(editor);
            setGalleryOpen(true);
          },
        }
      : null;
    const toolbar = insertGalleryButton(toolbarBase, galleryButton);
    return {
      ...defaultOptions,
      ...(options ?? {}),
      toolbar,
    };
  }, [options, uploadConfig]);

  useEffect(() => {
    const mapTitles: Record<string, string> = toolbarTitles;
    const applyLocalization = () => {
      const container = document.querySelector(".EasyMDEContainer");
      if (!container) return;
      const anchors = container.querySelectorAll<HTMLAnchorElement>(
        ".editor-toolbar a",
      );
      anchors.forEach((a) => {
        const name =
          a.getAttribute("aria-label") ||
          a.title ||
          a.className
            .split(" ")
            .find((cls) => cls && !cls.includes("icon-")) ||
          "";
        const key = Object.keys(mapTitles).find((k) => name.includes(k));
        if (key && mapTitles[key]) {
          a.title = mapTitles[key];
        }
      });
    };
    const id = window.setTimeout(applyLocalization, 100);
    return () => window.clearTimeout(id);
  }, [mergedOptions]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownEditorStyles }} />
      <SimpleMdeReact
        value={value}
        onChange={(val: string) => onChange(val || "")}
        options={mergedOptions}
        className={className}
      />
      {uploadConfig?.enabled && (
        <Dialog
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--images] size-5 text-blue-600" />
              <span>{uploadConfig.title ?? "Inserir imagem da galeria"}</span>
            </div>
          }
          size="xl"
        >
          <div className="flex h-full flex-col">
            {uploadConfig.description && (
              <div className="px-6 pt-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {uploadConfig.description}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Envie imagens para usar neste conteúdo
              </div>
              <UploadButtonLocal
                endpoint={uploadConfig.uploadEndpoint}
                onClientUploadComplete={async (res) => {
                  if (Array.isArray(res)) {
                    toast({
                      type: "success",
                      title: `${res.length} imagem(ns) enviada(s)`,
                    });
                    await loadImages();
                    return;
                  }
                  if (res?.url) {
                    toast({
                      type: "success",
                      title: "Imagem enviada",
                    });
                    await loadImages();
                  }
                }}
                appearance={{
                  button:
                    "inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700",
                }}
                content={{
                  button: (
                    <>
                      <span className="icon-[lucide--upload] size-4" /> Enviar
                      imagens
                    </>
                  ),
                }}
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-6">
                {images.map((img) => (
                  <div
                    key={img.filename}
                    className="relative group rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-900"
                  >
                    <button
                      type="button"
                      className="absolute inset-0"
                      onClick={() =>
                        setLightboxImage({
                          src: toPublicUploadsSrc(img.url),
                          alt: img.filename,
                        })
                      }
                      aria-label="Abrir imagem"
                    />
                    <div className="relative aspect-square w-full">
                      <Image
                        src={toPublicUploadsSrc(img.url)}
                        alt={img.filename}
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-3 h-8 rounded-full bg-white/80 text-zinc-800 text-xs hover:bg-white"
                        onClick={() => {
                          const url = img.url
                            ? toPublicUploadsSrc(img.url)
                            : toPublicUploadsSrc(
                                `${uploadConfig.directory}/${img.filename}`,
                              );
                          const markdown = `![imagem](${url})`;
                          if (currentEditor) {
                            currentEditor.codemirror.replaceSelection(markdown);
                            setGalleryOpen(false);
                          } else {
                            onChange(`${value}\n\n${markdown}`);
                            setGalleryOpen(false);
                          }
                        }}
                      >
                        <span className="icon-[lucide--check] size-4" />
                        Selecionar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full h-8 w-8 bg-white/80 text-red-600 text-xs hover:bg-white"
                        onClick={async () => {
                        setDeleteTarget(img);
                        }}
                      >
                        <span className="icon-[lucide--trash] size-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {images.length === 0 && (
                  <div className="col-span-full text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma imagem enviada ainda.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog>
      )}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <span className="icon-[lucide--trash] size-4" />
            Excluir imagem
          </div>
        }
      >
        <div className="px-6 pb-6 pt-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tem certeza que deseja excluir esta imagem? Esta ação não poderá ser
            desfeita.
          </p>
          <div className="flex gap-2 justify-end mt-6">
            <Button
              type="button"
              style="bordered"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteLoading}
              onClick={async () => {
                if (!deleteTarget || !uploadConfig) return;
                try {
                  setDeleteLoading(true);
                  const res = await fetch(
                    config.getApiUrl(uploadConfig.deleteEndpoint),
                    {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ filename: deleteTarget.filename }),
                    },
                  );
                  if (res.ok) {
                    toast({ type: "success", title: "Imagem excluída" });
                    setDeleteTarget(null);
                    await loadImages();
                    return;
                  }
                  toast({ type: "error", title: "Erro ao excluir imagem" });
                } finally {
                  setDeleteLoading(false);
                }
              }}
            >
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </div>
      </Dialog>
      {lightboxImage && (
        <Lightbox
          open={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          image={lightboxImage.src}
          alt={lightboxImage.alt}
        />
      )}
    </>
  );
}
