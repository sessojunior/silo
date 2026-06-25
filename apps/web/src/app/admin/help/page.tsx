"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "@silo/engine/format/toast";
import { config } from "@/lib/config";
import Button from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import Offcanvas from "@/components/ui/offcanvas";
import Label from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";
import MarkdownEditor from "@/components/ui/markdown-editor";

interface HelpDoc {
  id: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeMarkdown = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");

const helpMarkdownClasses = [
  "max-w-none text-base text-zinc-700 dark:text-zinc-300",
  "[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:border-b [&_h1]:border-zinc-200 [&_h1]:pb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-zinc-950 dark:[&_h1]:border-zinc-700 dark:[&_h1]:text-zinc-50",
  "[&>h1:first-child]:mt-0",
  "[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-zinc-800 dark:[&_h3]:text-zinc-100",
  "[&_p]:my-4 [&_p]:leading-7",
  "[&_ul]:my-4 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2",
  "[&_ol]:my-4 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2",
  "[&_li]:pl-1 [&_li]:leading-7",
  "[&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100",
  "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline [&_a]:decoration-blue-300 [&_a]:underline-offset-4 [&_a:hover]:text-blue-800 dark:[&_a]:text-blue-400 dark:[&_a]:decoration-blue-700 dark:[&_a:hover]:text-blue-300",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:bg-blue-50/70 [&_blockquote]:px-4 [&_blockquote]:py-2 dark:[&_blockquote]:border-blue-700 dark:[&_blockquote]:bg-blue-950/30",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-zinc-50",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-zinc-900 dark:[&_code]:bg-zinc-800 dark:[&_code]:text-zinc-100",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-50",
  "[&_table]:my-6 [&_table]:min-w-full [&_table]:divide-y [&_table]:divide-zinc-200 [&_table]:text-sm dark:[&_table]:divide-zinc-700",
  "[&_th]:bg-zinc-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-zinc-900 dark:[&_th]:bg-zinc-800 dark:[&_th]:text-zinc-100",
  "[&_td]:border-t [&_td]:border-zinc-200 [&_td]:px-4 [&_td]:py-3 dark:[&_td]:border-zinc-700",
].join(" ");

const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table>{children}</table>
    </div>
  ),
};

export default function HelpPage() {
  const smokeMode = config.isSmokeMode;
  const [helpDoc, setHelpDoc] = useState<HelpDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formContent, setFormContent] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const uploadConfig = useMemo(
    () => ({
      enabled: true,
      showButton: true,
      uploadEndpoint: "helpImageUploader" as const,
      listEndpoint: "/api/admin/help/images",
      deleteEndpoint: "/api/admin/help/images",
      directory: "/uploads/help",
      title: "Inserir imagem da ajuda",
    }),
    [],
  );

  // Carregar documentação
  const fetchHelpDoc = async () => {
    try {
      setLoading(true);
      const response = await fetch(config.getApiUrl("/api/admin/help"));
      const data = await response.json();

      if (data.success) {
        const description = normalizeMarkdown(data.data.description || "");
        setHelpDoc({ ...data.data, description });
        setFormContent(description);
      } else {
        toast({
          type: "error",
          title: "Erro ao carregar",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao carregar documentação",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao montar
  useEffect(() => {
    if (smokeMode) {
      setLoading(false);
      return;
    }

    fetchHelpDoc();
  }, [smokeMode]);

  useEffect(() => {
    if (smokeMode) return;

    const handleOpenEditor = () => setEditorOpen(true);
    window.addEventListener("openHelpEditor", handleOpenEditor);

    return () => {
      window.removeEventListener("openHelpEditor", handleOpenEditor);
    };
  }, [smokeMode]);

  // Extrair títulos do markdown
  const extractTitles = (markdown: string) => {
    if (!markdown) return [];

    const lines = markdown.split("\n");
    const titles: Array<{ id: string; title: string; level: number }> = [];

    lines.forEach((line, index) => {
      const match = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
      if (match) {
        titles.push({
          id: `title-${index}`,
          title: match[2].trim(),
          level: match[1].length,
        });
      }
    });

    return titles;
  };

  const markdownContent = helpDoc?.description
    ? normalizeMarkdown(helpDoc.description)
    : "";

  const titles = markdownContent.trim()
    ? extractTitles(markdownContent)
    : [];

  // Scroll para título
  const scrollToTitle = (titleText: string) => {
    const elements = document.querySelectorAll("h1, h2, h3");
    for (const element of elements) {
      if (element.textContent?.includes(titleText)) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };

  // Função para obter classes de título baseadas no nível (igual ProductManualSection)
  const getTitleClasses = (level: number) => {
    switch (level) {
      case 1:
        return "text-base font-semibold text-zinc-700 dark:text-zinc-200";
      case 2:
        return "text-sm font-medium text-zinc-600 dark:text-zinc-300";
      case 3:
        return "text-sm font-normal text-zinc-600 dark:text-zinc-300";
      default:
        return "text-sm font-normal text-zinc-600 dark:text-zinc-300";
    }
  };

  // Submit do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setFormLoading(true);
      const response = await fetch(config.getApiUrl("/api/admin/help"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: formContent }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          type: "success",
          title: "Salvo com sucesso",
          description: "Documentação atualizada",
        });
        setEditorOpen(false);
        await fetchHelpDoc();
      } else {
        toast({
          type: "error",
          title: "Erro ao salvar",
          description: data.error || "Erro desconhecido",
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Erro ao salvar",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Se carregando
  if (loading) {
    return (
      <div className="w-full h-full flex flex-1 items-center justify-center p-6">
        <LoadingSpinner
          text="Carregando ajuda do sistema..."
          size="lg"
          variant="horizontal"
        />
      </div>
    );
  }

  if (smokeMode) {
    return <HelpSmokeShell />;
  }

  // Interface principal com sidebar e conteúdo (seguindo padrão ProductManualSection)
  return (
    <div className="w-full h-full flex bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar */}
      <div className="w-96 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shrink-0">
        <div className="h-full flex flex-col">
          <div className="scrollbar flex-1 overflow-y-auto p-3">
            {titles.length === 0 ? (
              <div className="text-center py-6">
                <span className="icon-[lucide--list] size-8 text-zinc-400 mx-auto mb-2 block" />
                <p className="text-xs text-zinc-500">
                  Nenhum título encontrado
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Use # ## ### para criar títulos
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {titles.map((title, index) => (
                  <button
                    key={index}
                    onClick={() => scrollToTitle(title.title)}
                    className="w-full text-left p-2 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 group"
                    style={{ paddingLeft: `${8 + (title.level - 1) * 12}px` }}
                  >
                    <div className={getTitleClasses(title.level)}>
                      {title.title}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="scrollbar flex-1 overflow-y-auto bg-white dark:bg-zinc-800">
          {markdownContent.trim() ? (
            <div className="p-8">
              {/* Conteúdo renderizado apenas como visualização */}
              <div
                id="help-content"
                className={helpMarkdownClasses}
              >
                <ReactMarkdown components={markdownComponents}>
                  {markdownContent}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <span className="icon-[lucide--book-open] size-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">
                  Documentação vazia
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  Clique em &ldquo;Editar documentação&rdquo; para criar o
                  conteúdo.
                </p>
                <Button onClick={() => setEditorOpen(true)}>
                  <span className="icon-[lucide--edit-3] size-4 mr-2" />
                  Criar documentação
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <Offcanvas
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Editor da Ajuda"
        width="xl"
        contentClassName="p-0"
        footerActions={
          <>
            <Button
              type="button"
              style="bordered"
              onClick={() => setEditorOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="help-editor-form"
              disabled={formLoading}
            >
              {formLoading ? "Salvando..." : "Salvar Documentação"}
            </Button>
          </>
        }
      >
        <form
          id="help-editor-form"
          className="flex flex-col h-full"
          onSubmit={handleSubmit}
        >
          <div className="scrollbar flex-1 min-h-0 overflow-y-auto -m-6">
            <div className="flex flex-col gap-4 p-6">
              <Label htmlFor="content" required>
                Conteúdo da Documentação (Markdown)
              </Label>
              <div className="flex-1 min-h-100">
                <MarkdownEditor
                  value={formContent}
                  onChange={(val: string) => setFormContent(val || "")}
                  className="flex-1 h-full"
                  uploadConfig={uploadConfig}
                />
              </div>
            </div>
          </div>
        </form>
      </Offcanvas>
    </div>
  );
}

function HelpSmokeShell() {
  return (
    <div className="flex w-full bg-white dark:bg-zinc-900">
      <div className="flex-1 p-8">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-700 dark:bg-zinc-800">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            Ajuda
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Conteúdo estático para o smoke.
          </p>
        </div>
      </div>

      <div
        role="dialog"
        aria-label="Editor da Ajuda"
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-6"
      >
        <div className="pointer-events-none w-full max-w-4xl rounded-2xl bg-white p-6 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Editor da Ajuda
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Shell de smoke.
          </p>
        </div>
      </div>
    </div>
  );
}
