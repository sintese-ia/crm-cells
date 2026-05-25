export const FUNIL_LABEL: Record<string, string> = {
  sem_contato: "Sem contato",
  contato_realizado: "Contato realizado",
  reuniao: "Reunião",
  em_negociacao: "Em negociação",
  pedido_realizado: "Pedido realizado",
  positivada: "Positivada",
  negativa: "Negativa",
};

// Funil — gradiente de calor (fria → quente → fechado)
export const FUNIL_COLOR: Record<string, string> = {
  sem_contato: "bg-[#6B6B6B]",
  contato_realizado: "bg-[#1C2A35]",
  reuniao: "bg-[#0091EA]",
  em_negociacao: "bg-[#D4772C]",
  pedido_realizado: "bg-[#00C853]",
  positivada: "bg-[#00897B]",
  negativa: "bg-[#BF360C]",
};

export const TEMP_COLOR: Record<string, string> = {
  quente: "bg-[#D4541A]",
  morno: "bg-[#FFB300]",
  frio: "bg-[#0091EA]",
  gelado: "bg-[#6B6B6B]",
};

export const CANAL_LABEL: Record<string, string> = {
  academia: "Academia",
  mercado_premium: "Mercado premium",
  especializado_natural: "Especializado natural",
  suplementos: "Suplementos",
  distribuidor: "Distribuidor",
  farma: "Farma",
  outros: "Outros",
};
