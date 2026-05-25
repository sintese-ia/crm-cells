import type { Conta, Interacao, Acao } from "@/db/schema";

// Jornada = visão das 6 etapas do funil (alinhada com doc §1).
// Cada etapa corresponde a um funil_stage. A etapa atual = funil_stage da conta.
// Negativa é um desvio terminal (mostrado quando aplicável).
//
// sem_contato → contato_realizado → reuniao → em_negociacao → pedido_realizado → positivada
//                                                                                    ↘ negativa

export type EstadoEtapa = "concluida" | "em_andamento" | "vazia" | "desviada";

export type Etapa = {
  id: number;
  key: "sem_contato" | "contato_realizado" | "reuniao" | "em_negociacao" | "pedido_realizado" | "positivada" | "negativa";
  label: string;
  icon: string;
  estado: EstadoEtapa;
  contagem: number;
  ultimaInteracao?: {
    texto: string;
    situacaoId: string | null;
    ocorridoEm: Date;
  };
  proximaAcao?: { dataPrevista: string; descricao: string };
};

const ETAPAS_BASE: Omit<Etapa, "estado" | "contagem">[] = [
  { id: 1, key: "sem_contato",       label: "Sem contato",       icon: "📞" },
  { id: 2, key: "contato_realizado", label: "Contato realizado", icon: "✓" },
  { id: 3, key: "reuniao",           label: "Reunião",           icon: "🤝" },
  { id: 4, key: "em_negociacao",     label: "Em negociação",     icon: "📋" },
  { id: 5, key: "pedido_realizado",  label: "Pedido realizado",  icon: "📦" },
  { id: 6, key: "positivada",        label: "Positivada",        icon: "🎉" },
  { id: 7, key: "negativa",          label: "Negativa",          icon: "🚫" }, // alternativa
];

// Ordem do funil — quantas etapas "antes" do estágio atual já são consideradas concluídas
const ORDEM_FUNIL: Record<string, number> = {
  sem_contato: 0,
  contato_realizado: 1,
  reuniao: 2,
  em_negociacao: 3,
  pedido_realizado: 4,
  positivada: 5,
  negativa: -1, // tratado separado
};

export function calcularJornada(
  conta: Pick<Conta, "funilStage">,
  interacoes: Pick<Interacao, "tipo" | "situacaoId" | "texto" | "ocorridoEm">[],
  proximaAcao?: Pick<Acao, "dataPrevista" | "descricao"> | null
): Etapa[] {
  const fun = conta.funilStage;
  const intsSorted = [...interacoes].sort(
    (a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime()
  );

  const ehNegativa = fun === "negativa";
  const ordemAtual = ORDEM_FUNIL[fun] ?? 0;

  // Contagens por etapa (baseado em interações + situações)
  const ligacoes = intsSorted.filter((i) => i.tipo === "ligacao" || i.tipo === "whatsapp");
  const reunioesInt = intsSorted.filter((i) => i.tipo === "reuniao" || (i.situacaoId && (i.situacaoId.startsWith("rm_") || i.situacaoId === "reuniao_realizada" || i.situacaoId === "reuniao_adiada")));
  const negociacaoInt = intsSorted.filter((i) =>
    i.tipo === "proposta" || i.tipo === "amostra" || i.tipo === "cadastro" ||
    (i.situacaoId && (i.situacaoId.startsWith("pr_") || i.situacaoId.startsWith("amostra_") || i.situacaoId.startsWith("cadastro_") || i.situacaoId.startsWith("fup_")))
  );
  const pedidoInt = intsSorted.filter((i) =>
    i.tipo === "nota_boleto" || i.tipo === "entrega" || i.tipo === "despacho" ||
    (i.situacaoId && (i.situacaoId.startsWith("nota_boleto_") || i.situacaoId.startsWith("entrega_") || i.situacaoId.startsWith("despacho_") || i.situacaoId === "pedido_realizado"))
  );
  const positivadaInt = intsSorted.filter((i) =>
    i.tipo === "treinamento" || i.tipo === "degustacao" ||
    (i.situacaoId && (i.situacaoId.startsWith("treino_") || i.situacaoId.startsWith("degustacao_") || i.situacaoId.startsWith("fup_recompra_") || i.situacaoId === "ca_fechou"))
  );
  const negativaInt = intsSorted.filter((i) =>
    i.tipo === "negativa" || (i.situacaoId && (i.situacaoId.startsWith("negativa_") || i.situacaoId === "pa_hard_no" || i.situacaoId === "pa_sumiu" || i.situacaoId === "pc_nao_tem_interesse" || i.situacaoId === "pr_negativa"))
  );

  const ultimaPorEtapa: Record<string, Etapa["ultimaInteracao"]> = {
    sem_contato: undefined,
    contato_realizado: ligacoes[0] ? { texto: ligacoes[0].texto, situacaoId: ligacoes[0].situacaoId, ocorridoEm: ligacoes[0].ocorridoEm } : undefined,
    reuniao: reunioesInt[0] ? { texto: reunioesInt[0].texto, situacaoId: reunioesInt[0].situacaoId, ocorridoEm: reunioesInt[0].ocorridoEm } : undefined,
    em_negociacao: negociacaoInt[0] ? { texto: negociacaoInt[0].texto, situacaoId: negociacaoInt[0].situacaoId, ocorridoEm: negociacaoInt[0].ocorridoEm } : undefined,
    pedido_realizado: pedidoInt[0] ? { texto: pedidoInt[0].texto, situacaoId: pedidoInt[0].situacaoId, ocorridoEm: pedidoInt[0].ocorridoEm } : undefined,
    positivada: positivadaInt[0] ? { texto: positivadaInt[0].texto, situacaoId: positivadaInt[0].situacaoId, ocorridoEm: positivadaInt[0].ocorridoEm } : undefined,
    negativa: negativaInt[0] ? { texto: negativaInt[0].texto, situacaoId: negativaInt[0].situacaoId, ocorridoEm: negativaInt[0].ocorridoEm } : undefined,
  };

  const contagemPorEtapa: Record<string, number> = {
    sem_contato: 0,
    contato_realizado: ligacoes.length,
    reuniao: reunioesInt.length,
    em_negociacao: negociacaoInt.length,
    pedido_realizado: pedidoInt.length,
    positivada: positivadaInt.length,
    negativa: negativaInt.length,
  };

  return ETAPAS_BASE.map<Etapa>((base) => {
    const ordemEtapa = ORDEM_FUNIL[base.key] ?? 0;
    let estado: EstadoEtapa;

    if (base.key === "negativa") {
      // Negativa: aparece como desviada se a conta foi pra negativa
      estado = ehNegativa ? "em_andamento" : negativaInt.length > 0 ? "desviada" : "vazia";
    } else if (ehNegativa) {
      // Se a conta tá em negativa, etapas anteriores ficam "concluídas até onde chegou"
      // Usa contagens pra estimar — qualquer etapa com interação fica concluida
      estado = contagemPorEtapa[base.key] > 0 ? "concluida" : "vazia";
    } else if (ordemEtapa < ordemAtual) {
      estado = "concluida";
    } else if (ordemEtapa === ordemAtual) {
      estado = "em_andamento";
    } else {
      estado = "vazia";
    }

    return {
      ...base,
      estado,
      contagem: contagemPorEtapa[base.key],
      ultimaInteracao: ultimaPorEtapa[base.key],
      proximaAcao: estado === "em_andamento" && proximaAcao
        ? { dataPrevista: proximaAcao.dataPrevista, descricao: proximaAcao.descricao }
        : undefined,
    };
  });
}
