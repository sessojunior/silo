import {
  getStatusLabel,
  getStatusColor,
  ProductStatus,
  getStatusClasses as getCentralizedStatusClasses,
  DEFAULT_STATUS,
} from "@/lib/productStatus";

interface TimelineItem {
  id?: string;
  date: string;
  turn: number;
  status: string;
  description?: string | null;
  category_id?: string | null;
}

interface Props {
  statuses: string[]; // array 28 itens (dia0..dia27) - DEPRECATED
  timelineData?: TimelineItem[]; // dados completos para clique
  productTurns?: string[]; // Turnos configurados do produto (ex: ['6', '12', '18', '0'])
}

// Função para obter classes CSS baseadas no status ou cor
function getStatusClasses(input: string): string {
  // Se o input é um status, converter para cor primeiro
  const color =
    input.includes("green") ||
    input.includes("orange") ||
    input.includes("red") ||
    input.includes("gray") ||
    input.includes("transparent") ||
    input.includes("blue") ||
    input.includes("violet") ||
    input.includes("yellow")
      ? (input as
          | "green"
          | "orange"
          | "red"
          | "gray"
          | "transparent"
          | "blue"
          | "violet"
          | "yellow")
      : getStatusColor(input as ProductStatus);

  return getCentralizedStatusClasses(color, "timeline"); // Variante de referência
}

export default function ProductTimeline({
  statuses,
  timelineData,
  productTurns,
}: Props) {
  // Se timelineData está disponível, usar dados completos; senão usar statuses simples
  const hasCompleteData = timelineData && timelineData.length > 0;

  if (hasCompleteData) {
    // Função para formatar data no padrão brasileiro
    const formatDateBR = (dateStr: string) => {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    };

    // Agrupar dados por data para exibir todos os turnos no tooltip
    const dataByDate = timelineData.reduce(
      (acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = [];
        }
        acc[item.date].push(item);
        return acc;
      },
      {} as Record<string, TimelineItem[]>,
    );

    /**
     * Função para garantir que apenas os turnos configurados do produto sejam exibidos no tooltip
     *
     * LÓGICA DOS TURNOS CONFIGURADOS:
     * - Usa apenas os turnos que o produto tem configurado (recebidos via timelineData)
     * - Se existe registro no banco: usa o status real do banco
     * - Se NÃO existe registro no banco: status = 'pending' (Pendente - ainda não chegou a hora)
     *
     * Isso garante que o tooltip mostre apenas os turnos configurados para o produto,
     * evitando mostrar turnos que o produto não deveria ter.
     */
    const getExpectedTurns = (
      date: string,
      existingTurns: TimelineItem[],
    ): TimelineItem[] => {
      // Usar turnos do prop ou inferir (fallback) a partir dos dados existentes
      const configuredTurns = productTurns
        ? productTurns.map(Number).sort((a, b) => a - b)
        : [...new Set(timelineData!.map((item) => item.turn))].sort(
            (a, b) => a - b,
          );
      const result: TimelineItem[] = [];

      for (const turn of configuredTurns) {
        // Busca o turno nos dados existentes, garantindo comparação numérica
        const existingTurn = existingTurns.find(
          (t) => Number(t.turn) === Number(turn),
        );
        if (existingTurn) {
          // Turno existe no banco - usar dados reais
          result.push(existingTurn);
        } else {
          // Turno não existe no banco - usar status padrão centralizado (statuspending)
          result.push({
            date,
            turn,
            status: DEFAULT_STATUS,
            description: null,
            category_id: null,
          });
        }
      }

      return result;
    };

    // Ordenar turnos por horário dentro de cada data
    Object.keys(dataByDate).forEach((date) => {
      dataByDate[date].sort((a, b) => a.turn - b.turn);
    });

    // Modo avançado com tooltip agrupado por dia
    const weeks = [0, 7, 14, 21];
    const weekClass = "flex gap-x-0.5 p-1.5";

    // Criar array de datas únicas ordenadas para exibir todos os 28 dias
    const uniqueDates = [
      ...new Set(timelineData.map((item) => item.date)),
    ].sort();

    return (
      <div className="h-auto">
        <div className="flex">
          {weeks.map((start, wIdx) => (
            <div key={wIdx} className={weekClass}>
              {uniqueDates.slice(start, start + 7).map((date, idx) => {
                // Obter turnos existentes e garantir que todos os turnos esperados sejam exibidos
                const existingTurns = dataByDate[date] || [];
                const allTurnsForDate = getExpectedTurns(date, existingTurns);

                // Construir tooltip com todos os turnos da data
                const dateFormatted = formatDateBR(date);

                // Função para truncar e limpar descrição
                const truncateDescription = (
                  desc: string | null | undefined,
                ): string => {
                  if (!desc) return "";
                  // Remove quebras de linha e caracteres inválidos
                  const cleaned = desc
                    .replace(/[\r\n\t]+/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                  // Trunca em 60 caracteres
                  return cleaned.length > 60
                    ? cleaned.substring(0, 60) + "..."
                    : cleaned;
                };

                const turnsInfo = allTurnsForDate
                  .map((turn) => {
                    const description = turn.description
                      ? truncateDescription(turn.description)
                      : "";
                    return `Turno ${turn.turn}: ${getStatusLabel(turn.status as ProductStatus)}${description ? " - " + description : ""}`;
                  })
                  .join("\n");

                // Variável final com data e todos os turnos
                const tooltipContent = `${dateFormatted}\n${turnsInfo}`;

                return (
                  <div
                    key={`${date}-${idx}`}
                    className="flex flex-col gap-0.5"
                    title={tooltipContent}
                  >
                    {allTurnsForDate.map((turn, tIdx) => (
                      <div
                        key={`${turn.date}-${turn.turn}-${tIdx}`}
                        className={`h-3 w-1.5 rounded-full ${getStatusClasses(turn.status)} hover:scale-110 transition-transform`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Modo legacy com apenas statuses
  // Não reverter - manter ordem original (mais recente → mais antigo)
  const weeks = [0, 7, 14, 21];
  const weekClass = "flex gap-x-0.5 p-1.5";
  return (
    <div className="h-auto">
      <div className="flex">
        {weeks.map((start, wIdx) => (
          <div key={wIdx} className={weekClass}>
            {statuses.slice(start, start + 7).map((s, idx) => (
              <div
                key={idx}
                className={`h-3 w-1.5 rounded-full ${getStatusClasses(s)}`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
