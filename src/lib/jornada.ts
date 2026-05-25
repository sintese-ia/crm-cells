import type { Conta, Interacao, Acao } from "@/db/schema";

export type EstadoEtapa = "concluida" | "em_andamento" | "vazia";

export type Etapa = {
  id: number;
  key: "ligacao" | "whatsapp" | "marcar_reuniao" | "realizar_reuniao" | "proposta" | "fechar";
  label: string;
  icon: string;
  tipoInteracao: string; // tipo pra pré-selecionar no modal
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
  { id: 1, key: "ligacao",          label: "Ligação",          icon: "📞", tipoInteracao: "ligacao" },
  { id: 2, key: "whatsapp",         label: "WhatsApp",         icon: "💬", tipoInteracao: "whatsapp" },
  { id: 3, key: "marcar_reuniao",   label: "Marcar reunião",   icon: "📅", tipoInteracao: "ligacao" },
  { id: 4, key: "realizar_reuniao", label: "Realizar reunião", icon: "🤝", tipoInteracao: "reuniao" },
  { id: 5, key: "proposta",         label: "Mandar proposta",  icon: "📋", tipoInteracao: "proposta" },
  { id: 6, key: "fechar",           label: "Fechar / Negativa",icon: "🎯", tipoInteracao: "outro" },
];

const SITUACOES_POS_REUNIAO = [
  "pr_positiva_vai_fechar",
  "pr_positiva_aguard_proposta",
  "pr_positiva_pediu_material",
  "pr_sem_definicao",
  "pr_negativa",
];

const SITUACOES_REUNIAO_MARCADA = ["rm_marcada", "rm_confirmada"];

export function calcularJornada(
  conta: Pick<Conta, "funilStage">,
  interacoes: Pick<Interacao, "tipo" | "situacaoId" | "texto" | "ocorridoEm">[],
  proximaAcao?: Pick<Acao, "dataPrevista" | "descricao"> | null
): Etapa[] {
  const fun = conta.funilStage;
  const intsSorted = [...interacoes].sort(
    (a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime()
  );

  // Contagens
  const ligacoes = intsSorted.filter((i) => i.tipo === "ligacao");
  const whatsapps = intsSorted.filter((i) => i.tipo === "whatsapp");
  const reuMarcadasInt = intsSorted.filter((i) => i.situacaoId && SITUACOES_REUNIAO_MARCADA.includes(i.situacaoId));
  const posReuInt = intsSorted.filter((i) => i.situacaoId && SITUACOES_POS_REUNIAO.includes(i.situacaoId));
  const propostas = intsSorted.filter((i) => i.tipo === "proposta");
  const fechadas = intsSorted.filter(
    (i) => i.situacaoId === "ca_fechou" || i.situacaoId === "ca_primeira_compra"
  );
  const perdidas = intsSorted.filter(
    (i) =>
      i.situacaoId === "pa_hard_no" ||
      i.situacaoId === "pa_sumiu" ||
      i.situacaoId === "pc_nao_tem_interesse" ||
      i.situacaoId === "pr_negativa"
  );

  // Concluído? Exige interação REAL no CRM (não basta funil_stage da planilha
  // dizer que houve proposta — sem interação registrada, mostrar etapa vazia).
  // Exceção: fechar/perdido — funil é fonte autoritária pra estado terminal.
  const concluidoLigacao = ligacoes.length > 0;
  const concluidoWA = whatsapps.length > 0;
  const concluidoMarcar = reuMarcadasInt.length > 0;
  const concluidoRealizar = posReuInt.length > 0;
  const concluidoProposta = propostas.length > 0 || intsSorted.some((i) => i.situacaoId === "pr_positiva_aguard_proposta");
  const concluidoFechar = fechadas.length > 0 || perdidas.length > 0 || ["positivado", "pedido_realizado", "perdido"].includes(fun);

  const concluidas: Record<string, boolean> = {
    ligacao: concluidoLigacao,
    whatsapp: concluidoWA,
    marcar_reuniao: concluidoMarcar,
    realizar_reuniao: concluidoRealizar,
    proposta: concluidoProposta,
    fechar: concluidoFechar,
  };

  // Determinar etapa atual (em_andamento) = primeira NÃO concluída.
  // Se ainda não teve contato algum (lig+wa zerados), começa pela ligação —
  // não pode pular pra "marcar reunião" só porque funil_stage diz contatado
  // (pode ter sido importado da planilha sem interação real no CRM).
  const teveAlgumContato = concluidoLigacao || concluidoWA;
  const ordemEtapasObrigatorias: Etapa["key"][] = ["marcar_reuniao", "realizar_reuniao", "proposta", "fechar"];
  let etapaAtual: Etapa["key"] | null = null;
  if (!teveAlgumContato) {
    etapaAtual = "ligacao";
  } else {
    for (const k of ordemEtapasObrigatorias) {
      if (!concluidas[k]) {
        etapaAtual = k;
        break;
      }
    }
  }

  return ETAPAS_BASE.map<Etapa>((base) => {
    const conc = concluidas[base.key];
    let contagem = 0;
    let ultimaInteracao: Etapa["ultimaInteracao"];

    switch (base.key) {
      case "ligacao":
        contagem = ligacoes.length;
        if (ligacoes[0]) ultimaInteracao = { texto: ligacoes[0].texto, situacaoId: ligacoes[0].situacaoId, ocorridoEm: ligacoes[0].ocorridoEm };
        break;
      case "whatsapp":
        contagem = whatsapps.length;
        if (whatsapps[0]) ultimaInteracao = { texto: whatsapps[0].texto, situacaoId: whatsapps[0].situacaoId, ocorridoEm: whatsapps[0].ocorridoEm };
        break;
      case "marcar_reuniao":
        contagem = reuMarcadasInt.length;
        if (reuMarcadasInt[0]) ultimaInteracao = { texto: reuMarcadasInt[0].texto, situacaoId: reuMarcadasInt[0].situacaoId, ocorridoEm: reuMarcadasInt[0].ocorridoEm };
        break;
      case "realizar_reuniao":
        contagem = posReuInt.length;
        if (posReuInt[0]) ultimaInteracao = { texto: posReuInt[0].texto, situacaoId: posReuInt[0].situacaoId, ocorridoEm: posReuInt[0].ocorridoEm };
        break;
      case "proposta":
        contagem = propostas.length;
        if (propostas[0]) ultimaInteracao = { texto: propostas[0].texto, situacaoId: propostas[0].situacaoId, ocorridoEm: propostas[0].ocorridoEm };
        break;
      case "fechar":
        contagem = fechadas.length + perdidas.length;
        if (fechadas[0]) ultimaInteracao = { texto: fechadas[0].texto, situacaoId: fechadas[0].situacaoId, ocorridoEm: fechadas[0].ocorridoEm };
        else if (perdidas[0]) ultimaInteracao = { texto: perdidas[0].texto, situacaoId: perdidas[0].situacaoId, ocorridoEm: perdidas[0].ocorridoEm };
        break;
    }

    const estado: EstadoEtapa = conc ? "concluida" : etapaAtual === base.key ? "em_andamento" : "vazia";

    return {
      ...base,
      estado,
      contagem,
      ultimaInteracao,
      proximaAcao: estado === "em_andamento" && proximaAcao
        ? { dataPrevista: proximaAcao.dataPrevista, descricao: proximaAcao.descricao }
        : undefined,
    };
  });
}
