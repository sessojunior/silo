/**
 * Serviço de geração de relatórios em PDF
 *
 * Gera arquivos PDF dos relatórios do sistema e armazena no diretório
 * de uploads (silo-storage-data /app/uploads/reports/).
 * Nunca armazena blobs no PostgreSQL.
 *
 * Regras de layout:
 * - Tudo em português (rótulos, status, seções)
 * - Sem páginas em branco — footer desenhado apenas no final
 * - Design limpo com cores sóbrias e tabelas zebradas
 * - Quebra de página automática com re-cabeçalho quando necessário
 */

import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { ensureUploadDir, getUploadFilePath } from "../infra/uploads.js";

// ─── Constantes de layout ───────────────────────────────────────

const MARGIN = { top: 50, bottom: 65, left: 50, right: 50 };
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right; // 495.28
const CONTENT_TOP = MARGIN.top; // 50
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN.bottom; // 776.89
const LINE_HEIGHT = 14; // Espaçamento base entre linhas

const C = {
  primary: "#1e3a5f",
  primaryLight: "#3b6fa0",
  accent: "#d97706",
  success: "#047857",
  danger: "#b91c1c",
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
  sectionBg: "#f1f5f9",
  white: "#ffffff",
};

const F = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
};

// ─── Helpers de formatação ───────────────────────────────────────

const fmt = (n: number): string => n.toLocaleString("pt-BR");

/** Converte status interno para português */
const statusPt = (status: string): string => {
  const map: Record<string, string> = {
    active: "ativo",
    critical: "crítico",
    warning: "atenção",
    stable: "estável",
    done: "concluído",
    completed: "concluído",
    in_progress: "em andamento",
    pending: "pendente",
    paused: "pausado",
    cancelled: "cancelado",
    undefined: "indefinido",
    ok: "ok",
    delayed: "atrasado",
    offline: "offline",
    alta: "alta",
    media: "média",
    baixa: "baixa",
    normal: "normal",
  };
  return map[status.toLowerCase()] ?? status;
};

// ─── Helpers de desenho ─────────────────────────────────────────

function createDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    margins: MARGIN,
    info: {
      Title: "Relatório SILO",
      Author: "SILO",
      Subject: "Relatório gerado pelo sistema",
    },
  });
}

/** Desenha o cabeçalho no topo da página (coordenadas absolutas). */
function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  // Barra azul superior
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(C.primary);

  doc.fontSize(16).font(F.bold).fillColor(C.primary).text(title, MARGIN.left, 24, { width: CONTENT_WIDTH });
  doc.fontSize(9).font(F.regular).fillColor(C.muted).text(subtitle, MARGIN.left, 46, { width: CONTENT_WIDTH });

  doc
    .moveTo(MARGIN.left, 68)
    .lineTo(PAGE_WIDTH - MARGIN.right, 68)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke();
}

/** Desenha o rodapé no final (dentro da área de conteúdo). */
function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number): void {
  // Posiciona 6pt acima do limite inferior do conteúdo
  const y = Math.min(doc.y + 6, CONTENT_BOTTOM - 10);
  doc.fontSize(7).font(F.regular).fillColor(C.muted);
  doc.text(
    `SILO — Gerado em ${new Date().toLocaleString("pt-BR")}                                                                                                                 Página ${pageNum} de ${totalPages}`,
    MARGIN.left,
    y,
    { width: CONTENT_WIDTH, align: "left" },
  );
}

/** Avança doc.y respeitando o limite da página. Cria nova página se necessário. */
function space(doc: PDFKit.PDFDocument, times: number): void {
  for (let i = 0; i < times; i++) {
    if (doc.y + LINE_HEIGHT > CONTENT_BOTTOM) {
      doc.addPage();
      drawHeader(doc, "Relatório (continuação)", "");
      doc.y = CONTENT_TOP;
    }
    doc.y += LINE_HEIGHT;
  }
}

/** Escreve um título de seção. Quebra página se necessário. */
function section(doc: PDFKit.PDFDocument, text: string): void {
  if (doc.y + 24 > CONTENT_BOTTOM) {
    doc.addPage();
    drawHeader(doc, "Relatório (continuação)", "");
    doc.y = CONTENT_TOP;
  }
  doc.fontSize(12).font(F.bold).fillColor(C.primary).text(text, MARGIN.left, doc.y, { width: CONTENT_WIDTH });
  doc.y += 4;
}

/** Escreve um par chave:valor. Quebra página se necessário. */
function kv(doc: PDFKit.PDFDocument, key: string, value: string, color?: string): void {
  if (doc.y + LINE_HEIGHT > CONTENT_BOTTOM) {
    doc.addPage();
    drawHeader(doc, "Relatório (continuação)", "");
    doc.y = CONTENT_TOP;
  }
  doc.fontSize(9).font(F.bold).fillColor(C.text).text(key, MARGIN.left, doc.y, { width: CONTENT_WIDTH, continued: true });
  doc.font(F.regular).fillColor(color ?? C.text).text(` ${value}`, { width: CONTENT_WIDTH - doc.x + MARGIN.left });
  doc.y += 2;
}

/** Desenha uma tabela com quebra de página automática e re-cabeçalho. */
function table(
  doc: PDFKit.PDFDocument,
  headers: { label: string; width: number; align?: "left" | "center" | "right" }[],
  rows: string[][],
): void {
  if (rows.length === 0) return;

  const rowH = 16;
  const headH = 20;

  // Função auxiliar para desenhar o cabeçalho da tabela
  const drawTableHeader = (y: number): void => {
    doc.rect(MARGIN.left, y, CONTENT_WIDTH, headH).fill(C.primary);
    let hx = MARGIN.left;
    for (const h of headers) {
      doc.fontSize(7.5).font(F.bold).fillColor(C.white).text(h.label, hx + 3, y + 5, { width: h.width - 6, align: h.align ?? "left" });
      hx += h.width;
    }
  };

  // Garante espaço mínimo para header + 1 linha
  if (doc.y + headH + rowH + 8 > CONTENT_BOTTOM) {
    doc.addPage();
    drawHeader(doc, "Relatório (continuação)", "");
    doc.y = CONTENT_TOP;
  }

  drawTableHeader(doc.y);
  doc.y += headH + 2;

  for (let i = 0; i < rows.length; i++) {
    // Quebra de página antes da linha se não couber
    if (doc.y + rowH + 4 > CONTENT_BOTTOM) {
      doc.addPage();
      drawHeader(doc, "Relatório (continuação)", "");
      doc.y = CONTENT_TOP;
      drawTableHeader(doc.y);
      doc.y += headH + 2;
    }

    const rowY = doc.y;

    // Fundo zebrado (linhas pares com fundo claro)
    if (i % 2 === 0) {
      doc.rect(MARGIN.left, rowY, CONTENT_WIDTH, rowH).fill(C.sectionBg);
    }

    // Borda inferior
    doc.moveTo(MARGIN.left, rowY + rowH).lineTo(MARGIN.left + CONTENT_WIDTH, rowY + rowH).strokeColor(C.border).lineWidth(0.3).stroke();

    // Células
    let cx = MARGIN.left;
    for (let j = 0; j < rows[i].length; j++) {
      const h = headers[j];
      doc.fontSize(7.5).font(F.regular).fillColor(C.text).text(rows[i][j], cx + 3, rowY + 3, { width: h.width - 6, align: h.align ?? "left" });
      cx += h.width;
    }

    doc.y = rowY + rowH + 1;
  }

  space(doc, 1);
}

// ─── Construtores específicos ───────────────────────────────────

interface GeneratePdfParams {
  data: Record<string, unknown>;
  type: "availability" | "problems" | "executive" | "projects";
  periodLabel: string;
}

function buildAvailability(doc: PDFKit.PDFDocument, data: Record<string, unknown>): void {
  const products = (data.products as Array<Record<string, unknown>>) ?? [];
  const total = (data.totalProducts as number) ?? 0;
  const avg = (data.avgAvailability as number) ?? 0;

  section(doc, "Visão Geral");
  kv(doc, "Total de produtos:", fmt(total));
  kv(doc, "Disponibilidade média:", `${avg.toFixed(1)}%`, avg >= 90 ? C.success : avg >= 70 ? C.accent : C.danger);

  space(doc, 1);

  section(doc, "Disponibilidade por Produto");
  table(doc, [
    { label: "Produto", width: 140 },
    { label: "Disponibilidade", width: 90, align: "center" },
    { label: "Atividades", width: 70, align: "center" },
    { label: "Concluídas", width: 70, align: "center" },
    { label: "Situação", width: 80, align: "center" },
  ], products.map((p) => [
    (p.name as string) ?? "-",
    `${((p.availabilityPercentage as number) ?? 0).toFixed(1)}%`,
    fmt((p.totalActivities as number) ?? 0),
    fmt((p.completedActivities as number) ?? 0),
    statusPt((p.status as string) ?? "-"),
  ]));
}

function buildProblems(doc: PDFKit.PDFDocument, data: Record<string, unknown>): void {
  const totalProblems = (data.totalProblems as number) ?? 0;
  const avgHours = (data.avgResolutionHours as number) ?? 0;
  const categories = (data.problemsByCategory as Array<Record<string, unknown>>) ?? [];
  const topProblems = (data.topProblems as Array<Record<string, unknown>>) ?? [];

  section(doc, "Visão Geral");
  kv(doc, "Total de problemas:", fmt(totalProblems));
  kv(doc, "Tempo médio de resolução:", `${avgHours.toFixed(1)} horas`);

  space(doc, 1);

  section(doc, "Problemas por Categoria");
  table(doc, [
    { label: "Categoria", width: 160 },
    { label: "Quantidade", width: 90, align: "center" },
    { label: "Média de resolução (h)", width: 130, align: "center" },
  ], categories.map((c) => [
    (c.name as string) ?? "-",
    fmt((c.problemsCount as number) ?? 0),
    ((c.avgResolutionHours as number) ?? 0).toFixed(1),
  ]));

  if (topProblems.length > 0) {
    space(doc, 1);
    section(doc, "Principais Problemas");

    for (const p of topProblems) {
      if (doc.y + 24 > CONTENT_BOTTOM) {
        doc.addPage();
        drawHeader(doc, "Relatório (continuação)", "");
        doc.y = CONTENT_TOP;
      }

      const title = (p.title as string) ?? "-";
      const productName = ((p.product as Record<string, unknown>)?.name as string) ?? "-";
      const solCount = (p.solutionsCount as number) ?? 0;

      doc.fontSize(9).font(F.bold).fillColor(C.text).text(`• ${title}`, MARGIN.left + 6, doc.y, { width: CONTENT_WIDTH - 6 });
      doc.y += 2;
      doc.fontSize(8).font(F.regular).fillColor(C.muted).text(`   Produto: ${productName} · Soluções: ${fmt(solCount)}`, MARGIN.left + 6, doc.y);
      doc.y += 8;
    }
  }
}

function buildExecutive(doc: PDFKit.PDFDocument, data: Record<string, unknown>): void {
  const summary = (data.summary as Record<string, unknown>) ?? {};
  const kpis = (data.kpis as Record<string, unknown>) ?? {};
  const trends = (data.trends as Record<string, unknown>) ?? {};
  const productMetrics = (data.productMetrics as Array<Record<string, unknown>>) ?? [];

  section(doc, "Indicadores");
  kv(doc, "Produtos:", fmt((summary.totalProducts as number) ?? 0));
  kv(doc, "Problemas:", fmt((summary.totalProblems as number) ?? 0));
  kv(doc, "Projetos ativos:", fmt((summary.activeProjects as number) ?? 0));
  kv(doc, "Tarefas concluídas:", `${(kpis.taskCompletionRate as number) ?? 0}%`, C.success);

  space(doc, 1);

  const pt = (trends.problems as Record<string, unknown>) ?? {};
  const st = (trends.solutions as Record<string, unknown>) ?? {};

  section(doc, "Tendências (7 dias)");
  kv(doc, "Problemas:", `${fmt((pt.current as number) ?? 0)} atual · ${fmt((pt.previous as number) ?? 0)} anterior · ${((pt.change as number) ?? 0).toFixed(1)}% de variação`);
  kv(doc, "Soluções:", `${fmt((st.current as number) ?? 0)} atual · ${fmt((st.previous as number) ?? 0)} anterior · ${((st.change as number) ?? 0).toFixed(1)}% de variação`);

  space(doc, 1);

  section(doc, "Métricas por Produto");
  table(doc, [
    { label: "Produto", width: 130 },
    { label: "Prioridade", width: 70, align: "center" },
    { label: "Problemas", width: 65, align: "center" },
    { label: "Soluções", width: 65, align: "center" },
    { label: "Disponível", width: 70, align: "center" },
  ], productMetrics.map((p) => [
    (p.name as string) ?? "-",
    statusPt((p.priority as string) ?? "-"),
    fmt((p.totalProblems as number) ?? 0),
    fmt((p.totalSolutions as number) ?? 0),
    (p.available as boolean) ? "Sim" : "Não",
  ]));
}

function buildProjects(doc: PDFKit.PDFDocument, data: Record<string, unknown>): void {
  const summary = (data.summary as Record<string, unknown>) ?? {};
  const projects = (data.projectsWithProgress as Array<Record<string, unknown>>) ?? [];
  const tasksByStatus = (data.tasksByStatus as Record<string, number>) ?? {};
  const projectsByStatus = (data.projectsByStatus as Record<string, number>) ?? {};

  section(doc, "Visão Geral");
  kv(doc, "Total de projetos:", fmt((summary.totalProjects as number) ?? 0));
  kv(doc, "Total de atividades:", fmt((summary.totalActivities as number) ?? 0));
  kv(doc, "Total de tarefas:", fmt((summary.totalTasks as number) ?? 0));
  kv(doc, "Progresso médio:", `${(summary.avgProgress as number) ?? 0}%`);

  space(doc, 1);

  if (Object.keys(projectsByStatus).length > 0) {
    section(doc, "Situação dos Projetos");
    table(doc, [
      { label: "Situação", width: 150 },
      { label: "Quantidade", width: 90, align: "center" },
    ], Object.entries(projectsByStatus).map(([s, c]) => [statusPt(s), fmt(c)]));
  }

  if (Object.keys(tasksByStatus).length > 0) {
    section(doc, "Tarefas por Situação");
    table(doc, [
      { label: "Situação", width: 150 },
      { label: "Quantidade", width: 90, align: "center" },
    ], Object.entries(tasksByStatus).map(([s, c]) => [statusPt(s), fmt(c)]));
  }

  if (projects.length > 0) {
    space(doc, 1);
    section(doc, "Progresso por Projeto");
    table(doc, [
      { label: "Projeto", width: 170 },
      { label: "Progresso", width: 70, align: "center" },
      { label: "Situação", width: 80, align: "center" },
    ], projects.map((p) => [
      (p.name as string) ?? "-",
      `${(p.progress as number) ?? 0}%`,
      statusPt((p.status as string) ?? "-"),
    ]));
  }
}

// ─── Serviço principal ──────────────────────────────────────────

type Builder = (doc: PDFKit.PDFDocument, data: Record<string, unknown>) => void;

const BUILDERS: Record<string, Builder> = {
  availability: buildAvailability,
  problems: buildProblems,
  executive: buildExecutive,
  projects: buildProjects,
};

const TITLE_MAP: Record<string, string> = {
  availability: "Relatório de Disponibilidade",
  problems: "Relatório de Problemas",
  executive: "Relatório Executivo",
  projects: "Relatório de Projetos",
};

/**
 * Gera um arquivo PDF com os dados do relatório informado.
 *
 * @param params.type - Tipo: availability | problems | executive | projects
 * @param params.data  - Dados no formato retornado pelo report-service
 * @param params.periodLabel - Período para exibição no cabeçalho
 * @returns { filePath, url, filename }
 */
export async function generatePdf(
  params: GeneratePdfParams,
): Promise<{ filePath: string; url: string; filename: string }> {
  const { type, data, periodLabel } = params;
  const builder = BUILDERS[type];
  if (!builder) throw new Error(`Tipo de relatório desconhecido: ${type}`);

  const timestamp = Date.now();
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `${type}-${datePart}-${timestamp}.pdf`;

  ensureUploadDir("reports");
  const filePath = getUploadFilePath("reports", filename);
  const stream = createWriteStream(filePath);

  const doc = createDoc();
  doc.pipe(stream);

  // Contagem de páginas via evento
  let pageCount = 1;

  doc.on("pageAdded", () => {
    pageCount++;
  });

  drawHeader(doc, TITLE_MAP[type] ?? "Relatório", `Período: ${periodLabel}`);
  doc.y = 78; // posiciona o cursor de texto após o cabeçalho

  builder(doc, data);

  // Footer apenas na última página, com numeração correta
  drawFooter(doc, pageCount, pageCount);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return {
    filePath,
    url: `/uploads/serve/reports/${filename}`,
    filename,
  };
}
