import {
  pgSchema,
  bigserial,
  bigint,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  integer,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const b2b = pgSchema("b2b");

// ============================================================
// b2b.conta — lead
// ============================================================
export const conta = b2b.table("conta", {
  contaId: bigserial("conta_id", { mode: "number" }).primaryKey(),
  // identidade
  nome: text("nome").notNull(),
  razaoSocial: text("razao_social"),
  cnpj: text("cnpj"),
  // estrutura
  contaMatrizId: bigint("conta_matriz_id", { mode: "number" }).references(
    (): AnyPgColumn => conta.contaId,
    { onDelete: "set null" }
  ),
  tipo: text("tipo").default("loja_unica"), // rede | franquia | loja_unica
  nLojas: integer("n_lojas"),
  // classificação
  canal: text("canal").notNull(),
  cidade: text("cidade"),
  uf: text("uf"),
  bairro: text("bairro"),
  endereco: text("endereco"),
  cep: text("cep"),
  // contato institucional
  emailInstitucional: text("email_institucional"),
  telefoneInstitucional: text("telefone_institucional"),
  whatsappInstitucional: text("whatsapp_institucional"),
  site: text("site"),
  instagram: text("instagram"),
  // origem
  origemLead: text("origem_lead").notNull().default("prospeccao_propria"),
  origemLeadDetalhe: text("origem_lead_detalhe"),
  // gestão
  responsavel: text("responsavel").default("gabriel"),
  funilStage: text("funil_stage").notNull().default("sem_contato"),
  prioridadeCalc: text("prioridade_calc"),
  prioridadeManual: text("prioridade_manual"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  // pré-requisitos (não bloqueiam, só sugerem)
  requerHomologacao: boolean("requer_homologacao").notNull().default(false),
  statusHomologacao: text("status_homologacao"),
  requerCadastro: boolean("requer_cadastro").notNull().default(false),
  fupTravadoAte: date("fup_travado_ate"),
  // inteligência (preenchida quando o lead esquenta)
  origem: text("origem"),
  marcasConcorrentes: text("marcas_concorrentes").array().default(sql`'{}'::text[]`),
  produtosVendidos: text("produtos_vendidos").array().default(sql`'{}'::text[]`),
  volumeEstimadoMensalBrl: numeric("volume_estimado_mensal_brl"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.contato — pessoas-chave da conta
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
// b2b.interacao — TUDO o que acontece (passado + futuro)
// status=realizada → entrada do histórico
// status=pendente → ação prevista (data_prevista preenchida)
// status=cancelada → cancelada pela cadência (uma nova entrada veio depois)
// status=feita → ação previamente pendente foi marcada como feita
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
  // Em redes/franquias, interação pode afetar UMA loja específica
  lojaId: bigint("loja_id", { mode: "number" }).references(
    (): AnyPgColumn => conta.contaId,
    { onDelete: "set null" }
  ),
  autor: text("autor").notNull().default("gabriel"),
  tipo: text("tipo").notNull(),                  // ligacao, whatsapp, reuniao, proposta, etc
  situacaoId: text("situacao_id"),               // detalhe da interação (catálogo)
  descricao: text("descricao"),                  // texto curto pra ação pendente ("Confirmar reunião (D-1)")
  texto: text("texto"),                          // comentário livre
  status: text("status").notNull().default("realizada"), // realizada | pendente | cancelada | feita
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).defaultNow(), // quando aconteceu (realizada)
  dataPrevista: date("data_prevista"),           // quando vai acontecer (pendente)
  tentativaNum: bigint("tentativa_num", { mode: "number" }),
  origem: text("origem").default("manual"),      // manual | cadencia | fulfillment | pos_venda
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// b2b.situacao — catálogo finito (resultado de uma interação)
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
// b2b.regra_cadencia — quando registra situação X, criar ação D+M
// ============================================================
export const regraCadencia = b2b.table("regra_cadencia", {
  regraId: bigserial("regra_id", { mode: "number" }).primaryKey(),
  estagio: text("estagio").notNull(),
  situacaoId: text("situacao_id").references(() => situacao.situacaoId, { onDelete: "cascade" }),
  tentativaMin: bigint("tentativa_min", { mode: "number" }).notNull().default(1),
  tentativaMax: bigint("tentativa_max", { mode: "number" }),
  diasProximaAcao: bigint("dias_proxima_acao", { mode: "number" }),
  tipoProximaAcao: text("tipo_proxima_acao").notNull().default("fup"),
  descricaoAcao: text("descricao_acao").notNull(),
  moveFunilPara: text("move_funil_para"),
  ativa: boolean("ativa").notNull().default(true),
  versao: integer("versao").notNull().default(1),
  ordem: bigint("ordem", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Constantes
// ============================================================
export const CANAIS = [
  "distribuidor",
  "loja_suplementos",
  "emporio_natural",
  "mercado_premium",
  "farmacia",
  "academia",
  "marketplace",
  "vending_machine",
  "outros",
] as const;

export const TIPOS_CONTA = ["rede", "franquia", "loja_unica"] as const;

export const FUNIL_STAGES = [
  "sem_contato",
  "contato_realizado",
  "reuniao",
  "em_negociacao",
  "pedido_realizado",
  "positivada",
  "negativa",
] as const;

export const RESPONSAVEIS = ["gabriel", "gabi", "yasmin", "ismael", "lilian"] as const;

export const TIPOS_INTERACAO = [
  "ligacao",
  "whatsapp",
  "email",
  "reuniao",
  "proposta",
  "cadastro",
  "amostra",
  "fup",
  "nota_boleto",
  "entrega",
  "despacho",
  "treinamento",
  "degustacao",
  "negativa",
  "visita",
  "outro",
] as const;

export const STATUS_INTERACAO = ["realizada", "pendente", "cancelada", "feita"] as const;

export type Conta = typeof conta.$inferSelect;
export type Contato = typeof contato.$inferSelect;
export type Interacao = typeof interacao.$inferSelect;
export type Situacao = typeof situacao.$inferSelect;
export type RegraCadencia = typeof regraCadencia.$inferSelect;
