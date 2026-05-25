// Temperatura é DERIVADA, não editável. Calculada a partir de:
// - última interação (recência)
// - funil (se está no fluxo quente)
//
// frio    = sem interação nos últimos 30d
// morno   = última interação 7-30d atrás
// quente  = última interação <7d atrás
// em_risco = quente parado >15d (cabeça da fila — sinaliza pro Gabriel)

export type Temperatura = "frio" | "morno" | "quente" | "em_risco";

export function calcTemperatura(
  funilStage: string,
  ultimaInteracaoEm: Date | string | null | undefined,
): Temperatura {
  if (!ultimaInteracaoEm) return "frio";
  const last = typeof ultimaInteracaoEm === "string" ? new Date(ultimaInteracaoEm) : ultimaInteracaoEm;
  const dias = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));

  // Em risco: funil quente (visitado em diante) + parado >15d
  const funilQuente = ["visitado", "proposta_enviada", "pedido_realizado", "positivado"].includes(funilStage);
  if (funilQuente && dias > 15) return "em_risco";

  if (dias < 7) return "quente";
  if (dias < 30) return "morno";
  return "frio";
}

export const TEMP_LABEL: Record<Temperatura, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  em_risco: "⚠️ Em risco",
};

export const TEMP_COR: Record<Temperatura, string> = {
  frio: "bg-[#0091EA]",
  morno: "bg-[#FFB300]",
  quente: "bg-[#D4541A]",
  em_risco: "bg-[#BF360C]",
};
