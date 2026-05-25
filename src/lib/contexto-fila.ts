// Determina QUE botões de resultado mostrar na fila pra uma conta,
// baseado no estado da última interação + funil.
// Princípio (do doc do Gabriel): a pessoa vê só verbos do dia dela,
// nunca a palavra "situação". 4-6 botões por contexto, nunca 24.

export type ContextoFila = "frio" | "wa_enviado" | "qualificando" | "pos_reuniao" | "negociacao" | "homologacao" | "cadastro";

export type ResultadoOpcao = {
  sit: string;            // situacao_id que vai ser registrada
  label: string;          // texto do botão (verbo do dia)
  tipo: "ligacao" | "whatsapp" | "reuniao" | "proposta" | "outro";
  cor: "verde" | "amber" | "vermelho" | "azul";
};

// Mapa de cores → classes Tailwind
export const COR_BTN: Record<ResultadoOpcao["cor"], string> = {
  verde:    "bg-[#00897B] text-white hover:bg-[#00695C]",
  amber:    "bg-[#FFB300] text-[#0D0D0D] hover:bg-[#FFA000]",
  vermelho: "bg-[#BF360C] text-white hover:bg-[#8B0000]",
  azul:     "bg-[#0091EA] text-white hover:bg-[#0277BD]",
};

const OPCOES: Record<ContextoFila, ResultadoOpcao[]> = {
  frio: [
    { sit: "pc_respondeu_nao_marcou", label: "✓ Falei",     tipo: "ligacao", cor: "verde" },
    { sit: "pc_nao_atendeu",          label: "Não atendeu", tipo: "ligacao", cor: "amber" },
    { sit: "pc_caixa_postal",         label: "Cx postal",   tipo: "ligacao", cor: "amber" },
    { sit: "pc_numero_invalido",      label: "Nº errado",   tipo: "ligacao", cor: "vermelho" },
  ],
  wa_enviado: [
    { sit: "pc_respondeu_nao_marcou", label: "Respondeu",   tipo: "whatsapp", cor: "verde" },
    { sit: "pc_wa_sem_resposta",      label: "Sem resposta", tipo: "whatsapp", cor: "amber" },
  ],
  qualificando: [
    { sit: "rm_marcada",                  label: "Quer reunião",   tipo: "ligacao", cor: "verde" },
    { sit: "pc_pediu_material",           label: "Pediu material", tipo: "ligacao", cor: "azul" },
    { sit: "pc_adiou",                    label: "Adiou",          tipo: "ligacao", cor: "amber" },
    { sit: "pc_nao_tem_interesse",        label: "Sem interesse",  tipo: "ligacao", cor: "vermelho" },
  ],
  pos_reuniao: [
    { sit: "pr_positiva_aguard_proposta", label: "Pediu proposta", tipo: "reuniao", cor: "verde" },
    { sit: "amostra_enviada",             label: "Pediu amostra",  tipo: "reuniao", cor: "azul" },
    { sit: "pr_sem_definicao",            label: "Vai avaliar",    tipo: "reuniao", cor: "amber" },
    { sit: "pr_negativa",                 label: "Recuou",         tipo: "reuniao", cor: "vermelho" },
  ],
  negociacao: [
    { sit: "ca_fechou",                   label: "Fechou ✓",       tipo: "proposta", cor: "verde" },
    { sit: "pa_adiar_meses",              label: "Adiou",          tipo: "proposta", cor: "amber" },
    { sit: "pa_hard_no",                  label: "Recuou",         tipo: "proposta", cor: "vermelho" },
  ],
  homologacao: [
    { sit: "homologacao_docs_enviados",   label: "Docs enviados",  tipo: "outro", cor: "azul" },
    { sit: "homologacao_aprovada",        label: "Aprovada ✓",     tipo: "outro", cor: "verde" },
    { sit: "homologacao_reprovada",       label: "Reprovada",      tipo: "outro", cor: "vermelho" },
  ],
  cadastro: [
    { sit: "cadastro_enviado",            label: "Cadastro enviado", tipo: "outro", cor: "azul" },
    { sit: "cadastro_aprovado",           label: "Cadastro OK ✓",    tipo: "outro", cor: "verde" },
  ],
};

export function getOpcoes(contexto: ContextoFila): ResultadoOpcao[] {
  return OPCOES[contexto];
}

// Detecta contexto a partir do estado da conta + ações pendentes
export function detectarContexto(opts: {
  funilStage: string;
  ultimaSituacao: string | null;
  requerHomol: boolean;
  statusHomol: string | null;
  requerCad: boolean;
  acaoTipo?: string | null;
  acaoDescricao?: string | null;
}): ContextoFila {
  // Tarefa explícita de homologação ou cadastro (vem do bloqueio)
  if (opts.acaoDescricao?.toLowerCase().startsWith("homologar")) return "homologacao";
  if (opts.acaoDescricao?.toLowerCase().startsWith("cadastrar")) return "cadastro";

  // Sem qualquer interação → frio
  if (!opts.ultimaSituacao) return "frio";

  // Pós-reunião quente
  if (opts.ultimaSituacao.startsWith("pr_") || opts.ultimaSituacao === "rm_marcada" || opts.ultimaSituacao === "rm_confirmada") {
    return "pos_reuniao";
  }
  // Negociação (cliente ativo)
  if (opts.ultimaSituacao.startsWith("ca_") || opts.ultimaSituacao.startsWith("pa_")) {
    return "negociacao";
  }
  // WhatsApp enviado sem resposta → contexto wa
  if (opts.ultimaSituacao === "pc_wa_sem_resposta") return "wa_enviado";
  // Respondeu mas não marcou → qualificando
  if (opts.ultimaSituacao === "pc_respondeu_nao_marcou" || opts.ultimaSituacao === "pc_pediu_material") {
    return "qualificando";
  }
  // Default: frio (não atendeu, cx postal, número inválido)
  return "frio";
}
