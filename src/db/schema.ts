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
  responsavel: text("responsavel").notNull().default("gabriel"),
  funilStage: text("funil_stage").notNull().default("base_fria"),
  temperatura: text("temperatura").notNull().default("frio"),
  motivoPerda: text("motivo_perda"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
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

export type Conta = typeof conta.$inferSelect;
export type Contato = typeof contato.$inferSelect;
export type Interacao = typeof interacao.$inferSelect;
export type Acao = typeof acao.$inferSelect;
