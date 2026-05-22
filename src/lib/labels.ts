export const FUNIL_LABEL: Record<string, string> = {
  base_fria: "Base fria",
  contatado: "Contatado",
  visitado: "Visitado",
  proposta_enviada: "Proposta enviada",
  cadastrado_sem_pedido: "Cadastrado s/ pedido",
  pedido_realizado: "Pedido feito",
  positivado: "Positivado",
  perdido: "Perdido",
};

// Funil — gradiente de calor (fria → quente → fechado)
export const FUNIL_COLOR: Record<string, string> = {
  base_fria: "bg-[#6B6B6B]",
  contatado: "bg-[#1C2A35]",
  visitado: "bg-[#0091EA]",
  proposta_enviada: "bg-[#D4772C]",
  cadastrado_sem_pedido: "bg-[#FFB300]",
  pedido_realizado: "bg-[#00C853]",
  positivado: "bg-[#00897B]",
  perdido: "bg-[#BF360C]",
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
