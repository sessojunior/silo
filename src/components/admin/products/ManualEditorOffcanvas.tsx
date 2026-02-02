import Button from "@/components/ui/Button";
import Offcanvas from "@/components/ui/Offcanvas";
import Label from "@/components/ui/Label";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import { useMemo } from "react";

interface ManualEditorOffcanvasProps {
  open: boolean;
  onClose: () => void;
  formContent: string;
  setFormContent: (content: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formLoading: boolean;
}

export default function ManualEditorOffcanvas({
  open,
  onClose,
  formContent,
  setFormContent,
  onSubmit,
  formLoading,
}: ManualEditorOffcanvasProps) {
  const uploadConfig = useMemo(
    () => ({
      enabled: true,
      showButton: true,
      uploadEndpoint: "manualImageUploader" as const,
      listEndpoint: "/api/admin/products/manual/images",
      deleteEndpoint: "/api/admin/products/manual/images",
      directory: "/uploads/manual",
      title: "Inserir imagem da galeria",
    }),
    [],
  );

  return (
    <Offcanvas
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="icon-[lucide--edit] size-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Editor do Manual</h2>
            <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              Edite o manual completo em formato Markdown
            </p>
          </div>
        </div>
      }
      width="xl"
    >
      <form className="flex flex-col gap-6 h-full p-6" onSubmit={onSubmit}>
        <div className="flex-1 flex flex-col min-h-0">
          <Label htmlFor="form-content" required>
            Conteúdo do Manual (Markdown)
          </Label>
          <div className="flex-1 min-h-[400px] max-h-[70vh]">
            <MarkdownEditor
              value={formContent}
              onChange={(val) => setFormContent(val || "")}
              className="flex-1 h-full"
              uploadConfig={uploadConfig}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" style="bordered" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={formLoading}>
            {formLoading ? "Salvando..." : "Salvar Manual"}
          </Button>
        </div>
      </form>
    </Offcanvas>
  );
}
