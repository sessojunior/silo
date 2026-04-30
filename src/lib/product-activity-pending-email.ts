import { formatDateBR } from "@/lib/date-utils";
import {
  getStatusLabel,
  STATUS_DEFINITIONS,
  type ProductStatus,
} from "@/lib/product-status";

export interface ProductActivityPendingEmailData {
  productName: string;
  date: string;
  userName?: string | null;
  turn: number | string;
  status: string;
  incidentName?: string | null;
  description?: string | null;
  intervention?: string | null;
}

const isProductStatus = (status: string): status is ProductStatus =>
  status in STATUS_DEFINITIONS;

const getStatusText = (status: string): string => {
  const normalized = status.trim();
  if (!normalized) return "Não informado";
  return isProductStatus(normalized) ? getStatusLabel(normalized) : normalized;
};

const getSectionText = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Não informado";
};

export function buildProductActivityPendingEmailSubject({
  productName,
  date,
  turn,
}: ProductActivityPendingEmailData): string {
  return `Pendências do turno - ${productName} - ${formatDateBR(date)} ${turn}h`;
}

export function buildProductActivityPendingEmailBody({
  productName,
  date,
  userName,
  turn,
  status,
  incidentName,
  description,
  intervention,
}: ProductActivityPendingEmailData): string {
  return [
    `Produto: ${productName}`,
    `Data: ${formatDateBR(date)}`,
    `Usuário: ${getSectionText(userName)}`,
    `Turno: ${turn}h`,
    `Status: ${getStatusText(status)}`,
    `Incidente: ${getSectionText(incidentName)}`,
    "",
    "Descrição de incidentes:",
    getSectionText(description),
    "",
    "Descrição da intervenção realizada:",
    getSectionText(intervention),
  ].join("\n");
}