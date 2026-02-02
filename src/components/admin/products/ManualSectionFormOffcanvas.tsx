import Button from "@/components/ui/Button";
import Offcanvas from "@/components/ui/Offcanvas";
import Label from "@/components/ui/Label";
import Input from "@/components/ui/Input";
import MarkdownEditor from "@/components/ui/MarkdownEditor";

interface ManualSectionFormOffcanvasProps {
  open: boolean;
  onClose: () => void;
  formMode: "section" | "chapter";
  formTitle: string;
  setFormTitle: (title: string) => void;
  formDescription: string;
  setFormDescription: (desc: string) => void;
  formContent: string;
  setFormContent: (content: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formLoading: boolean;
}

export default function ManualSectionFormOffcanvas({
  open,
  onClose,
  formMode,
  formTitle,
  setFormTitle,
  formDescription,
  setFormDescription,
  formContent,
  setFormContent,
  onSubmit,
  formLoading,
}: ManualSectionFormOffcanvasProps) {
  return (
    <Offcanvas
      open={open}
      onClose={onClose}
      title={formMode === "section" ? "Adicionar seção" : "Editar capítulo"}
      width="xl"
    >
      <form className="flex flex-col gap-6 h-full p-6" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="form-title" required>
            {formMode === "section" ? "Título da seção" : "Título do capítulo"}
          </Label>
          <Input
            id="form-title"
            type="text"
            value={formTitle}
            setValue={setFormTitle}
            required
            placeholder={
              formMode === "section"
                ? "Ex: Instalação e Configuração"
                : "Ex: Configurando o ambiente"
            }
          />
        </div>

        {formMode === "section" && (
          <div>
            <Label htmlFor="form-description">
              Descrição da seção (opcional)
            </Label>
            <textarea
              id="form-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="block w-full rounded-lg border-zinc-200 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Breve descrição sobre esta seção..."
            />
          </div>
        )}

        {formMode === "chapter" && (
          <div className="flex-1 flex flex-col min-h-0">
            <Label htmlFor="form-content" required>
              Conteúdo do capítulo
            </Label>
            <div className="flex-1 min-h-[300px] max-h-[60vh]">
              <MarkdownEditor
                value={formContent}
                onChange={(val) => setFormContent(val || "")}
                className="flex-1 h-full"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" style="bordered" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={formLoading}>
            {formLoading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Offcanvas>
  );
}
