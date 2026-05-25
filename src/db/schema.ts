import {
  pgSchema,
  bigserial,
  bigint,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const b2b = pgSchema("b2b");

// ============================================================
// b2b.conta — institucional
// ============================================================
export const conta = b2b.table("conta", {
  contaId: bigserial("conta_id", { mode: "number" }).primaryKey(),
  nome: text("nome").notNull(),
  razaoSocial: text("razao_social"),
  cnpj: text("cnpj"),
  contaMatrizId: bigint("conta_matriz_id", { mode: "number" }).references(
    (): AnyPgColumn => conta.contaId,
    { onDelete: "set null" }
  ),
  canal: text("canal").notNull(),
  subcanal: text("subcanal"),
  cidade: text("cidade"),
  uf: text("uf"),
  bairro: text("bairro"),
  endereco: text("endereco"),
  cep: text("cep"),
  emailInstitucional: text("email_institucional"),
  telefoneInstitucional: text("telefone_institucional"),
  whatsappInstitucional: text("whatsapp_institucional"),
  site: text("site"),
  instagram: text("instagram"),
  volumeEstimadoFaixa: text("volume_estimado_faixa"),
  volumeEstimadoMensalBrl: numeric("volume_estimado_mensal_brl"),
  origemLead: text("origem_lead").notNull().default("prospeccao_propria"),
  origemLeadDetalhe: text("origem_lead_detalhe"),
  responsavel: text("responsavel").default("gabriel"),
  funilStage: text("funil_stage").notNull().default("base_fria"),
  temperatura: text("temperatura").notNull().default("frio"),
  motivoPerda: text("motivo_perda"),
  prioridadeCalc: text("prioridade_calc"),
  prioridadeManual: text("prioridade_manual"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  requerHomologacao: boolean("requer_homologacao").notNull().default(false),
  statusHomologacao: text("status_homologacao"),
  homologacaoIniciadaEm: date("homologacao_iniciada_em"),
  homologacaoAprovadaEm: date("homologacao_aprovada_em"),
  homologacaoNotas: text("homologacao_notas"),
  requerCadastro: boolean("requer_cadastro").notNull().default(false),
  fupTravadoAte: date("fup_travado_ate"),
  notas: text("notas"),
  clickupTaskId: text("clickup_task_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.contato — pessoas-chave (N:1)
// ============================================================
export const contato = b2b.table("contato", {
  contatoId: bigserial("contato_id", { mode: "number" }).primaryKey(),
  contaId: bigint("conta_id", { mode: "number" })
    .notNull()
    .references(() => conta.contaId, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  cargo: text("cargo"),
  email: text("email"),
  telefone: text("telefone"),
  whatsapp: text("whatsapp"),
  papel: text("papel").notNull().default("outro"),
  relevancia: text("relevancia").notNull().default("media"),
  ePrincipal: boolean("e_principal").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.interacao — log cronológico
// ============================================================
export const interacao = b2b.table("interacao", {
  interacaoId: bigserial("interacao_id", { mode: "number" }).primaryKey(),
  contaId: bigint("conta_id", { mode: "number" })
    .notNull()
    .references(() => conta.contaId, { onDelete: "cascade" }),
  contatoId: bigint("contato_id", { mode: "number" }).references(
    () => contato.contatoId,
    { onDelete: "set null" }
  ),
  autor: text("autor").notNull().default("gabriel"),
  tipo: text("tipo").notNull(),
  texto: text("texto").notNull(),
  anexoUrl: text("anexo_url"),
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  situacaoId: text("situacao_id"),
  tentativaNum: bigint("tentativa_num", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.acao — follow-ups agendados
// ============================================================
export const acao = b2b.table("acao", {
  acaoId: bigserial("acao_id", { mode: "number" }).primaryKey(),
  contaId: bigint("conta_id", { mode: "number" })
    .notNull()
    .references(() => conta.contaId, { onDelete: "cascade" }),
  contatoId: bigint("contato_id", { mode: "number" }).references(
    () => contato.contatoId,
    { onDelete: "set null" }
  ),
  descricao: text("descricao").notNull(),
  tipo: text("tipo").notNull(),
  dataPrevista: date("data_prevista").notNull(),
  responsavel: text("responsavel").notNull().default("gabriel"),
  status: text("status").notNull().default("pendente"),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
  notas: text("notas"),
  origem: text("origem").default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Constantes de domínio (refletem CHECKs do SQL)
// ============================================================
export const CANAIS = [
  "academia",
  "mercado_premium",
  "especializado_natural",
  "suplementos",
  "distribuidor",
  "farma",
  "outros",
] as const;

export const FUNIL_STAGES = [
  "base_fria",
  "contatado",
  "visitado",
  "proposta_enviada",
  "cadastrado_sem_pedido",
  "pedido_realizado",
  "positivado",
  "perdido",
] as const;

export const TEMPERATURAS = ["quente", "morno", "frio", "gelado"] as const;
export const RESPONSAVEIS = ["gabriel", "gabi", "yasmin", "ismael", "lilian"] as const;
export const ORIGENS = [
  "lista_biomundo",
  "lista_mundo_verde",
  "prospeccao_propria",
  "indicacao",
  "pesquisa_gabriel",
  "feira_evento",
  "inbound",
  "base_historica_camila",
  "outro",
] as const;
export const TIPOS_INTERACAO = [
  "visita",
  "ligacao",
  "whatsapp",
  "email",
  "proposta",
  "reuniao",
  "amostra",
  "outro",
] as const;
export const TIPOS_ACAO = [
  "ligar",
  "mandar_email",
  "mandar_whatsapp",
  "enviar_proposta",
  "visitar",
  "follow_up",
  "cobrar_pedido",
  "outro",
] as const;

// ============================================================
// b2b.situacao — lista finita de situações por interação
// ============================================================
export const situacao = b2b.table("situacao", {
  situacaoId: text("situacao_id").primaryKey(),
  label: text("label").notNull(),
  estagio: text("estagio").notNull(),
  autoFunil: text("auto_funil"),
  icon: text("icon"),
  ordem: bigint("ordem", { mode: "number" }).notNull().default(0),
  ativa: boolean("ativa").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.regra_cadencia — regras editáveis pelo admin
// ============================================================
export const regraCadencia = b2b.table("regra_cadencia", {
  regraId: bigserial("regra_id", { mode: "number" }).primaryKey(),
  estagio: text("estagio").notNull(),
  situacaoId: text("situacao_id").references(() => situacao.situacaoId, { onDelete: "cascade" }),
  tentativaMin: bigint("tentativa_min", { mode: "number" }).notNull().default(1),
  tentativaMax: bigint("tentativa_max", { mode: "number" }),
  diasProximaAcao: bigint("dias_proxima_acao", { mode: "number" }),
  tipoProximaAcao: text("tipo_proxima_acao").notNull().default("follow_up"),
  descricaoAcao: text("descricao_acao").notNull(),
  moveFunilPara: text("move_funil_para"),
  ativa: boolean("ativa").notNull().default(true),
  ordem: bigint("ordem", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.auditoria_conta — log de mudanças
// ============================================================
export const auditoria = b2b.table("auditoria_conta", {
  auditoriaId: bigserial("auditoria_id", { mode: "number" }).primaryKey(),
  contaId: bigint("conta_id", { mode: "number" })
    .notNull()
    .references(() => conta.contaId, { onDelete: "cascade" }),
  usuarioId: text("usuario_id").notNull(),
  usuarioEmail: text("usuario_email").notNull(),
  usuarioNome: text("usuario_nome").notNull(),
  acao: text("acao").notNull(),
  campo: text("campo"),
  valorAntes: text("valor_antes"),
  valorDepois: text("valor_depois"),
  contexto: text("contexto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const STATUS_HOMOLOGACAO = [
  "pendente_inicio",
  "docs_enviados",
  "em_analise",
  "aprovada",
  "reprovada",
] as const;

export const STATUS_HOMOLOGACAO_LABEL: Record<string, string> = {
  pendente_inicio: "Pendente — iniciar",
  docs_enviados: "Docs enviados",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

export const ESTAGIOS_JORNADA = [
  "primeiro_contato",
  "reuniao_marcada",
  "pos_reuniao",
  "cliente_ativo",
  "parado",
] as const;

export const ESTAGIO_LABEL: Record<string, string> = {
  primeiro_contato: "Primeiro contato",
  reuniao_marcada: "Reunião marcada",
  pos_reuniao: "Pós-reunião",
  cliente_ativo: "Cliente ativo",
  parado: "Parado / exceções",
};

export type Conta = typeof conta.$inferSelect;
export type Contato = typeof contato.$inferSelect;
export type Interacao = typeof interacao.$inferSelect;
export type Acao = typeof acao.$inferSelect;
export type Situacao = typeof situacao.$inferSelect;
export type RegraCadencia = typeof regraCadencia.$inferSelect;
export type Auditoria = typeof auditoria.$inferSelect;
