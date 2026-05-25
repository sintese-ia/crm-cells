/**
 * Regras de follow-up automático Cells B2B.
 * A partir do texto da interação + tipo + funil_stage atual, sugere
 * a próxima ação (com data e descrição).
 */

export type Sugestao = {
  diasAFrente: number;
  tipo:
    | "ligar"
    | "mandar_email"
    | "mandar_whatsapp"
    | "enviar_proposta"
    | "visitar"
    | "follow_up"
    | "cobrar_pedido"
    | "outro";
  descricao: string;
  regra: string;
};

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Tenta extrair data específica do texto.
 * Padrões reconhecidos:
 *  - "próxima semana" / "semana que vem" → +7
 *  - "daqui N dias" / "em N dias" → +N
 *  - "daqui N semanas" → +7*N
 *  - "mês que vem" / "próximo mês" → +30
 *  - "DD/MM" ou "DD/MM/AAAA" → data específica
 */
function extrairData(texto: string): number | null {
  const t = texto.toLowerCase();

  if (/pr[óo]xima semana|semana que vem|seman[ae] seguinte/i.test(t)) return 7;
  if (/m[êe]s que vem|pr[óo]ximo m[êe]s/i.test(t)) return 30;

  const dias = t.match(/(?:daqui|em)\s+(\d+)\s*dias?/);
  if (dias) return parseInt(dias[1], 10);

  const semanas = t.match(/(?:daqui|em)\s+(\d+)\s*semanas?/);
  if (semanas) return parseInt(semanas[1], 10) * 7;

  const meses = t.match(/(?:daqui|em)\s+(\d+)\s*(?:m[êe]s|meses)/);
  if (meses) return parseInt(meses[1], 10) * 30;

  // data DD/MM ou DD/MM/AAAA
  const dataMatch = t.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (dataMatch) {
    const dia = parseInt(dataMatch[1], 10);
    const mes = parseInt(dataMatch[2], 10) - 1;
    const ano = dataMatch[3]
      ? dataMatch[3].length === 2
        ? 2000 + parseInt(dataMatch[3], 10)
        : parseInt(dataMatch[3], 10)
      : new Date().getFullYear();
    const target = new Date(ano, mes, dia);
    const hoje = new Date();
    const diff = Math.round(
      (target.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff > 0 && diff < 365) return diff;
    // se a data já passou e estamos em dez/jan, considera ano que vem
    if (diff <= 0 && diff > -60) return diff + 365;
  }

  return null;
}

export function sugerirProximaAcao(input: {
  texto: string;
  tipo: string;
  funilStage: string;
}): Sugestao | null {
  const { texto, tipo, funilStage } = input;
  const t = (texto || "").toLowerCase();

  // 1. Data específica mencionada pelo cliente — respeita
  const dias = extrairData(t);
  if (dias !== null && dias > 0) {
    return {
      diasAFrente: dias,
      tipo: "follow_up",
      descricao: `Retomar conforme combinado (D+${dias})`,
      regra: "data-especifica",
    };
  }

  // 2. POSITIVADA / Fechou / Comprou → trilha onboarding
  if (
    /posit|fechou|fechad|comprou|virou cliente|ativ[aá]/i.test(t) ||
    funilStage === "positivada" ||
    funilStage === "pedido_realizado"
  ) {
    return {
      diasAFrente: 7,
      tipo: "follow_up",
      descricao: "Onboarding D+7: confirmar primeira compra + repassar materiais",
      regra: "positivado-onboarding",
    };
  }

  // 3. Reunião marcada / agendada
  if (/reuni[ãa]o\s*(?:marcad|agend)|agendou|call marcad/i.test(t)) {
    return {
      diasAFrente: 3,
      tipo: "follow_up",
      descricao: "Pós-reunião: confirmar interesse e tentar agendar nova etapa",
      regra: "reuniao-agendada",
    };
  }

  // 4. Negativa / Adiado / Não tem interesse → 45 dias
  if (
    /negativ|n[ãa]o tem interess|n[ãa]o vai fazer|n[ãa]o vamos|recus|adia(?:d|r)|tratamento m[ée]dico|momento ruim/i.test(
      t
    ) ||
    funilStage === "negativa"
  ) {
    return {
      diasAFrente: 45,
      tipo: "follow_up",
      descricao: "Retomar após 45 dias — testar novo momento",
      regra: "negativa-45d",
    };
  }

  // 5. Pediu material / Em análise / Aguardando decisão (respondeu mas não fechou)
  if (
    /pediu material|enviei material|aguardando an[áa]lise|aguardando confirma|aguardando retorno|aguardando aprova|pediu proposta|enviar proposta/i.test(
      t
    )
  ) {
    return {
      diasAFrente: 2,
      tipo: "follow_up",
      descricao: "Cobrar retorno do material/proposta enviado",
      regra: "respondeu-aguardando",
    };
  }

  // 6. Respondeu — conversa em andamento mas sem definição
  if (/respondeu|conversa[mn]?do|atendeu|falei|falamos|interess/i.test(t)) {
    return {
      diasAFrente: 2,
      tipo: "follow_up",
      descricao: "Continuar conversa — nova abordagem em 2 dias",
      regra: "respondeu-conversa",
    };
  }

  // 7. Sem resposta / Não atendeu / Mensagem enviada
  if (
    /n[ãa]o atendeu|sem resposta|enviado|aguardando|n[ãa]o respond|mensagem\s*enviada|whats?app enviado/i.test(
      t
    )
  ) {
    return {
      diasAFrente: 7,
      tipo: tipo === "whatsapp" ? "mandar_whatsapp" : "ligar",
      descricao: "Nova tentativa de contato (7 dias)",
      regra: "sem-resposta-7d",
    };
  }

  // default — follow-up genérico em 7 dias
  return {
    diasAFrente: 7,
    tipo: "follow_up",
    descricao: "Próximo contato",
    regra: "default-7d",
  };
}

export function calcularDataPrevista(diasAFrente: number, base = new Date()) {
  return fmtISODate(addDays(base, diasAFrente));
}
