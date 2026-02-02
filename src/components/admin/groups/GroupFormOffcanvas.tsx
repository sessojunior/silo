"use client";

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";

import Offcanvas from "@/components/ui/Offcanvas";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import Label from "@/components/ui/Label";
import { Group } from "@/lib/db/schema";

interface GroupFormOffcanvasProps {
  isOpen: boolean;
  onClose: () => void;
  group?: Group | null;
  onSuccess?: () => void;
}

// Ícones disponíveis para grupos (preparação para chat)
const iconOptions = [
  { value: "icon-[lucide--users]", label: "👥 Usuários" },
  { value: "icon-[lucide--shield-check]", label: "🛡️ Administração" },
  { value: "icon-[lucide--cloud-sun]", label: "🌤️ Meteorologia" },
  { value: "icon-[lucide--microscope]", label: "🔬 Pesquisa" },
  { value: "icon-[lucide--monitor-speaker]", label: "💻 Operação" },
  { value: "icon-[lucide--headphones]", label: "🎧 Suporte" },
  { value: "icon-[lucide--user-round]", label: "👤 Visitantes" },
  { value: "icon-[lucide--settings]", label: "⚙️ Configuração" },
  { value: "icon-[lucide--briefcase]", label: "💼 Gerência" },
  { value: "icon-[lucide--graduation-cap]", label: "🎓 Estudantes" },
];

// Cores disponíveis para grupos (para futuro chat)
const colorOptions = [
  { value: "#DC2626", label: "🔴 Vermelho" },
  { value: "#2563EB", label: "🔵 Azul" },
  { value: "#059669", label: "🟢 Verde" },
  { value: "#D97706", label: "🟠 Laranja" },
  { value: "#7C3AED", label: "🟣 Roxo" },
  { value: "#6B7280", label: "⚫ Cinza" },
  { value: "#BE185D", label: "🌸 Rosa" },
  { value: "#0891B2", label: "🐟 Ciano" },
  { value: "#65A30D", label: "🌿 Verde Lima" },
  { value: "#C2410C", label: "🟤 Marrom" },
];

export default function GroupFormOffcanvas({
  isOpen,
  onClose,
  group,
  onSuccess,
}: GroupFormOffcanvasProps) {
  const [loading, setLoading] = useState(false);

  // Estados do formulário
  const [formData, setFormData] = useState({
    name: group?.name || "",
    description: group?.description || "",
    icon: group?.icon || "icon-[lucide--users]",
    color: group?.color || "#2563EB",
    active: group?.active ?? true,
    isDefault: group?.isDefault ?? false,
  });

  // Atualizar form quando grupo mudar
  useEffect(() => {
    if (group && isOpen) {
      setFormData({
        name: group.name,
        description: group.description || "",
        icon: group.icon,
        color: group.color,
        active: group.active,
        isDefault: group.isDefault,
      });
    } else if (!group && isOpen) {
      setFormData({
        name: "",
        description: "",
        icon: "icon-[lucide--users]",
        color: "#2563EB",
        active: true,
        isDefault: false,
      });
    }
  }, [group, group?.id, isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast({
        type: "error",
        title: "Nome inválido",
        description: "O nome do grupo deve ter pelo menos 2 caracteres",
      });
      return;
    }

    try {
      setLoading(true);

      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        icon: formData.icon,
        color: formData.color,
        active: formData.active,
        isDefault: formData.isDefault,
      };

      // Para edição, incluir ID
      if (group) {
        Object.assign(submitData, { id: group.id });
      }

      const method = group ? "PUT" : "POST";
      const response = await fetch(config.getApiUrl("/api/admin/groups"), {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          type: "success",
          title: group ? "Grupo atualizado" : "Grupo criado",
          description: group
            ? "O grupo foi atualizado com sucesso."
            : "O novo grupo foi criado com sucesso.",
        });

        // Resetar formulário se for criação
        if (!group) {
          setFormData({
            name: "",
            description: "",
            icon: "icon-[lucide--users]",
            color: "#2563EB",
            active: true,
            isDefault: false,
          });
        }

        // Callback de sucesso e fechar
        onSuccess?.();
        handleClose();
      } else {
        console.error("❌ [COMPONENT_GROUP_FORM] Erro na operação:", {
          error: data,
        });
        toast({
          type: "error",
          title: "Erro na operação",
          description: data.message || "Ocorreu um erro inesperado.",
        });
      }
    } catch (error) {
      console.error("❌ [COMPONENT_GROUP_FORM] Erro inesperado:", { error });
      toast({
        type: "error",
        title: "Erro inesperado",
        description: "Não foi possível processar a solicitação.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Offcanvas
      open={isOpen}
      onClose={handleClose}
      title={group ? "Editar Grupo" : "Novo Grupo"}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* Nome do Grupo */}
        <div>
          <Label htmlFor="name" required>
            Nome do Grupo
          </Label>
          <Input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            setValue={(value) => handleInputChange("name", value)}
            placeholder="Digite o nome do grupo"
            disabled={loading || group?.name === "Administradores"}
            required
          />
          {group?.name === "Administradores" && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ O nome do grupo &quot;Administradores&quot; não pode ser
              alterado.
            </p>
          )}
          {/* Nota: Alguns grupos administrativos podem ter outros nomes, mas o grupo "Administradores" é especial */}
        </div>

        {/* Descrição */}
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            setValue={(value) => handleInputChange("description", value)}
            placeholder="Descrição opcional do grupo"
            disabled={loading}
          />
        </div>

        {/* Ícone e Cor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="icon">Ícone</Label>
            <Select
              name="icon"
              id="icon"
              selected={formData.icon}
              onChange={(value) => handleInputChange("icon", value)}
              options={iconOptions}
              placeholder="Selecione um ícone"
            />
          </div>
          <div>
            <Label htmlFor="color">Cor</Label>
            <Select
              name="color"
              id="color"
              selected={formData.color}
              onChange={(value) => handleInputChange("color", value)}
              options={colorOptions}
              placeholder="Selecione uma cor"
            />
          </div>
        </div>

        {/* Preview do Ícone */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: formData.color }}
            >
              <span className={`${formData.icon} size-5 text-white`} />
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {formData.name || "Nome do Grupo"}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {formData.description || "Descrição do grupo"}
              </p>
            </div>
          </div>
        </div>

        {/* Switches */}
        <div className="space-y-4">
          <Switch
            id="active"
            name="active"
            checked={formData.active}
            onChange={(checked) => handleInputChange("active", checked)}
            title="Grupo ativo"
            description={
              group?.role === "admin"
                ? "Grupos administrativos devem sempre permanecer ativos"
                : "Grupos inativos não aparecerão para novos usuários"
            }
            disabled={loading || group?.role === "admin"}
          />

          <Switch
            id="isDefault"
            name="isDefault"
            checked={formData.isDefault}
            onChange={(checked) => handleInputChange("isDefault", checked)}
            title="Grupo padrão"
            description={
              group?.role === "admin"
                ? "Grupos administrativos não podem ser o grupo padrão do sistema"
                : group?.isDefault && formData.isDefault
                  ? "Este grupo já é padrão. Para alterar, marque outro grupo como padrão."
                  : "Novos usuários serão automaticamente atribuídos a este grupo"
            }
            disabled={
              loading ||
              group?.role === "admin" ||
              (group?.isDefault && formData.isDefault)
            }
          />
        </div>

        {/* Aviso sobre grupo padrão */}
        {group?.isDefault && formData.isDefault && group?.role !== "admin" && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="icon-[lucide--info] size-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Grupo Padrão Ativo
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Este grupo está marcado como padrão. Para alterar, marque
                  outro grupo como padrão, desta forma este grupo será
                  automaticamente desmarcado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Aviso sobre Grupos Administrativos */}
        {group?.role === "admin" && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="icon-[lucide--shield-alert] size-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  Grupo Administrativo
                </h4>
                <p className="text-sm text-red-800 dark:text-red-200">
                  Este é um grupo administrativo do sistema. Status ativo e
                  configuração de grupo padrão não podem ser alterados. O role
                  deste grupo define permissões de administrador.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Aviso sobre Grupo Padrão */}
        {!group?.isDefault && formData.isDefault && group?.role !== "admin" && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="icon-[lucide--info] size-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                  Grupo Padrão
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Ao marcar este grupo como padrão, todos os outros grupos
                  perderão essa configuração automaticamente. Apenas um grupo
                  pode ser padrão por vez.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style="bordered"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="icon-[lucide--loader-circle] animate-spin size-4" />
                {group ? "Atualizando..." : "Criando..."}
              </>
            ) : (
              <>
                <span className="icon-[lucide--save] size-4" />
                {group ? "Atualizar Grupo" : "Criar Grupo"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Offcanvas>
  );
}
