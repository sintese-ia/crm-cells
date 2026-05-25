"use server";

import { db } from "@/db";
import {
  conta,
  contato,
  interacao,
  situacao,
  regraCadencia,
  type Conta,
} from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, sql, count, asc, lte, desc, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function fmtISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function getAutor(session: { user?: unknown } | null): string {
  const u = (session?.user || {}) as { id?: string };
  const a = (u.id || "outro").toLowerCase();
  return ["gabriel", "gabi", "yasmin", "ismael", "lilian"].includes(a) ? a : "outro";
}

// ============================================================
// atualizarConta — patch genérico de campos da conta
// ============================================================
export async function atualizarConta(
  contaId: number,
  patch: Partial<Conta>
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    await db.update(conta).set({ ...patch, updatedAt: new Date() }).where(eq(conta.contaId, contaId));
    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/acoes");
    revalidatePath("/funil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// criarInteracao — coração do CRM
// Cria UMA entrada em b2b.interacao com status=realizada e:
// - move funil se a situação tem auto_funil
// - cria PRÓXIMA interação com status=pendente (cadência)
// - cancela outras pendentes anteriores (exceto fulfillment/pos_venda)
// ============================================================
export async function criarInteracao(
  contaId: number,
  dados: {
    tipo: string;
    situacaoId?: string | null;
    texto?: string | null;
    contatoId?: number | null;
    lojaId?: number | null;
    dataPrevista?: string | null; // se preenchida, vira ação futura
    descricao?: string | null;
  }
): Promise<{
  ok: boolean;
  error?: string;
  proximaAcao?: { dataPrevista: string; descricao: string };
  funilMovido?: { de: string; para: string };
  avisos?: string[];
}> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const autor = getAutor(session);

  try {
    // 1. Determinar se essa interação é REALIZADA (data passada/hoje) ou PENDENTE (futura)
    const agora = new Date();
    const dataPrevistaDate = dados.dataPrevista ? new Date(dados.dataPrevista + "T12:00:00Z") : null;
    const ehPendente = dataPrevistaDate && dataPrevistaDate > agora;

    // Conta tentativas anteriores com a mesma situação
    let tentativaNum = 1;
    if (dados.situacaoId && !ehPendente) {
      const tents = await db.select({ n: count() }).from(interacao).where(
        and(
          eq(interacao.contaId, contaId),
          eq(interacao.situacaoId, dados.situacaoId),
          eq(interacao.status, "realizada"),
        )
      );
      tentativaNum = (tents[0]?.n ?? 0) + 1;
    }

    // 2. Inserir entrada (realizada ou pendente)
    await db.insert(interacao).values({
      contaId,
      tipo: dados.tipo,
      situacaoId: dados.situacaoId ?? null,
      contatoId: dados.contatoId ?? null,
      lojaId: dados.lojaId ?? null,
      autor,
      texto: dados.texto ?? null,
      descricao: dados.descricao ?? null,
      status: ehPendente ? "pendente" : "realizada",
      ocorridoEm: ehPendente ? null : agora,
      dataPrevista: ehPendente ? dados.dataPrevista : null,
      tentativaNum,
      origem: "manual",
    });

    if (ehPendente) {
      // Pendentes não disparam cadência — são ação manual agendada
      revalidatePath(`/contas/${contaId}`);
      revalidatePath("/acoes");
      return { ok: true };
    }

    // 3. Processar situação (auto_funil + cadência) — só pra realizadas
    const avisos: string[] = [];
    let proximaAcao: { dataPrevista: string; descricao: string } | undefined;
    let funilMovido: { de: string; para: string } | undefined;

    const [c] = await db.select({ funilStage: conta.funilStage, responsavel: conta.responsavel }).from(conta).where(eq(conta.contaId, contaId));

    if (dados.situacaoId) {
      const [s] = await db.select().from(situacao).where(eq(situacao.situacaoId, dados.situacaoId));

      // Auto-funil (SUGESTÃO, não bloqueia — filosofia GPS)
      if (s?.autoFunil && s.autoFunil !== c?.funilStage) {
        // Avisar se está pulando pra venda sem cadastro/homologação
        if (["pedido_realizado", "positivada"].includes(s.autoFunil)) {
          const [extras] = await db.select({
            requerHom: conta.requerHomologacao,
            statusHom: conta.statusHomologacao,
            requerCad: conta.requerCadastro,
          }).from(conta).where(eq(conta.contaId, contaId));
          if (extras?.requerHom && extras.statusHom !== "aprovada") avisos.push("Homologação não aprovada");
          if (extras?.requerCad) {
            const [cadOk] = await db.select({ n: count() }).from(interacao).where(
              and(eq(interacao.contaId, contaId), eq(interacao.situacaoId, "cadastro_realizado"), eq(interacao.status, "realizada"))
            );
            if ((cadOk?.n ?? 0) === 0) avisos.push("Cadastro não realizado");
          }
        }
        await db.update(conta).set({ funilStage: s.autoFunil, updatedAt: new Date() }).where(eq(conta.contaId, contaId));
        funilMovido = { de: c?.funilStage ?? "", para: s.autoFunil };
      }

      // Amostra trava FUP 7d
      if (dados.situacaoId === "amostra_enviada") {
        await db.update(conta)
          .set({ fupTravadoAte: fmtISODate(addDays(agora, 7)), updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
      }

      // Homologação propaga matriz→filhas
      if (dados.situacaoId === "homologacao_aprovada" || dados.situacaoId === "cadastro_realizado") {
        const isHom = dados.situacaoId === "homologacao_aprovada";
        if (isHom) {
          await db.update(conta).set({ statusHomologacao: "aprovada", updatedAt: new Date() }).where(eq(conta.contaId, contaId));
          // Propaga pra filhas se for matriz
          await db.update(conta).set({ statusHomologacao: "aprovada", updatedAt: new Date() }).where(eq(conta.contaMatrizId, contaId));
        }
      }

      // Cadência: cria nova interação status=pendente
      const [regra] = await db.select().from(regraCadencia).where(
        and(
          eq(regraCadencia.situacaoId, dados.situacaoId),
          eq(regraCadencia.ativa, true),
          eq(regraCadencia.versao, 1),
          lte(regraCadencia.tentativaMin, tentativaNum),
          sql`(${regraCadencia.tentativaMax} IS NULL OR ${regraCadencia.tentativaMax} >= ${tentativaNum})`,
        )
      ).orderBy(asc(regraCadencia.ordem)).limit(1);

      if (regra) {
        // Move funil se regra exige
        if (regra.moveFunilPara && regra.moveFunilPara !== c?.funilStage) {
          await db.update(conta).set({ funilStage: regra.moveFunilPara, updatedAt: new Date() }).where(eq(conta.contaId, contaId));
          funilMovido = funilMovido ?? { de: c?.funilStage ?? "", para: regra.moveFunilPara };
        }

        // Cria próxima pendente (se regra tem dias)
        if (regra.diasProximaAcao !== null) {
          // Cancela pendentes anteriores (exceto fulfillment/pos_venda)
          await db.update(interacao)
            .set({ status: "cancelada" })
            .where(and(
              eq(interacao.contaId, contaId),
              eq(interacao.status, "pendente"),
              sql`(${interacao.origem} IS NULL OR ${interacao.origem} NOT IN ('fulfillment','pos_venda'))`,
            ));

          const dataPrev = fmtISODate(addDays(agora, Number(regra.diasProximaAcao)));
          await db.insert(interacao).values({
            contaId,
            tipo: regra.tipoProximaAcao,
            descricao: regra.descricaoAcao,
            autor,
            status: "pendente",
            dataPrevista: dataPrev,
            origem: "cadencia",
          });
          proximaAcao = { dataPrevista: dataPrev, descricao: regra.descricaoAcao };
        }
      }

      // Fulfillment paralelo: pedido_realizado cria 3 pendentes
      if (dados.situacaoId === "pedido_realizado") {
        const fulfillment = [
          { d: 1, desc: "Emitir nota + boleto", tipo: "nota_boleto" },
          { d: 1, desc: "Agendar entrega", tipo: "entrega" },
          { d: 1, desc: "Despachar pedido", tipo: "despacho" },
        ];
        for (const f of fulfillment) {
          await db.insert(interacao).values({
            contaId,
            tipo: f.tipo,
            descricao: f.desc,
            autor,
            status: "pendente",
            dataPrevista: fmtISODate(addDays(agora, f.d)),
            origem: "fulfillment",
          });
        }
      }

      // Pós-venda automático: despacho_realizado cria 3 pendentes
      if (dados.situacaoId === "despacho_realizado") {
        const posVenda = [
          { d: 14, desc: "Treino sem.2 — exposição + treino", tipo: "treinamento" },
          { d: 30, desc: "Sellout — checar primeira reposição", tipo: "fup" },
          { d: 45, desc: "Degustação — agendar/realizar", tipo: "degustacao" },
        ];
        for (const p of posVenda) {
          await db.insert(interacao).values({
            contaId,
            tipo: p.tipo,
            descricao: p.desc,
            autor,
            status: "pendente",
            dataPrevista: fmtISODate(addDays(agora, p.d)),
            origem: "pos_venda",
          });
        }
      }
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/acoes");
    revalidatePath("/funil");

    return { ok: true, proximaAcao, funilMovido, avisos: avisos.length > 0 ? avisos : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// marcarAcaoFeita — marca interação pendente como feita (gera entrada realizada com mesma situacao? — não. Só vira "feita".)
// Pra disparar nova cadência, use criarInteracao com situação certa.
// ============================================================
export async function marcarAcaoFeita(interacaoId: number): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [i] = await db.select().from(interacao).where(eq(interacao.interacaoId, interacaoId));
    if (!i) return { ok: false, error: "ação não encontrada" };
    await db.update(interacao).set({ status: "feita" }).where(eq(interacao.interacaoId, interacaoId));
    revalidatePath(`/contas/${i.contaId}`);
    revalidatePath("/acoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// adiarAcao — muda data_prevista
// ============================================================
export async function adiarAcao(interacaoId: number, dias: number): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [i] = await db.select().from(interacao).where(eq(interacao.interacaoId, interacaoId));
    if (!i || !i.dataPrevista) return { ok: false, error: "ação inválida" };
    const nova = fmtISODate(addDays(new Date(i.dataPrevista), dias));
    await db.update(interacao).set({ dataPrevista: nova }).where(eq(interacao.interacaoId, interacaoId));
    revalidatePath(`/contas/${i.contaId}`);
    revalidatePath("/acoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// criarContato
// ============================================================
export async function criarContato(
  contaId: number,
  dados: { nome: string; cargo?: string | null; email?: string | null; telefone?: string | null; whatsapp?: string | null; papel?: string; ePrincipal?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    if (dados.ePrincipal) {
      await db.update(contato).set({ ePrincipal: false }).where(eq(contato.contaId, contaId));
    }
    await db.insert(contato).values({
      contaId,
      nome: dados.nome,
      cargo: dados.cargo ?? null,
      email: dados.email ?? null,
      telefone: dados.telefone ?? null,
      whatsapp: dados.whatsapp ?? null,
      papel: dados.papel ?? "decisor",
      ePrincipal: dados.ePrincipal ?? false,
    });
    revalidatePath(`/contas/${contaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// criarConta (lead novo)
// ============================================================
export async function criarConta(dados: {
  nome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  canal: string;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  site?: string | null;
  tipo?: string;
  nLojas?: number | null;
  responsavel?: string | null;
  origem?: string | null;
  comprador?: { nome: string; cargo?: string | null; telefone?: string | null; email?: string | null } | null;
}): Promise<{ ok: boolean; contaId?: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [c] = await db.insert(conta).values({
      nome: dados.nome,
      razaoSocial: dados.razaoSocial ?? null,
      cnpj: dados.cnpj ?? null,
      canal: dados.canal,
      cidade: dados.cidade ?? null,
      uf: dados.uf ?? null,
      telefoneInstitucional: dados.telefone ?? null,
      whatsappInstitucional: dados.whatsapp ?? null,
      emailInstitucional: dados.email ?? null,
      instagram: dados.instagram ?? null,
      site: dados.site ?? null,
      tipo: dados.tipo ?? "loja_unica",
      nLojas: dados.nLojas ?? 1,
      responsavel: dados.responsavel ?? null,
      origem: dados.origem ?? null,
      funilStage: "sem_contato",
    }).returning({ contaId: conta.contaId });
    const contaId = c.contaId;

    if (dados.comprador) {
      await db.insert(contato).values({
        contaId,
        nome: dados.comprador.nome,
        cargo: dados.comprador.cargo ?? "Comprador",
        telefone: dados.comprador.telefone ?? null,
        email: dados.comprador.email ?? null,
        papel: "decisor",
        ePrincipal: true,
        ativo: true,
      });
    }

    revalidatePath("/funil");
    revalidatePath("/acoes");
    return { ok: true, contaId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// getAcoesDaPessoa — Fila do Dia priorizada
// Ordem: FUPs (atrasados/hoje), reuniões (próximos 7d), frios novos
// ============================================================
export type AcaoListagem = {
  interacaoId: number;
  contaId: number;
  contaNome: string;
  contatoPrincipal: string | null;
  cidade: string | null;
  uf: string | null;
  tipo: string;
  descricao: string | null;
  dataPrevista: string;
  origem: string | null;
  tel: string | null;
  wa: string | null;
  funilStage: string;
};

export async function getAcoesDaPessoa(pessoa: string): Promise<AcaoListagem[]> {
  const r = await db.execute(sql`
    SELECT i.interacao_id, i.tipo, i.descricao, i.data_prevista, i.origem,
           c.conta_id, c.nome AS conta_nome, c.cidade, c.uf, c.funil_stage,
           c.telefone_institucional AS tel, c.whatsapp_institucional AS wa,
           (SELECT ct.nome FROM b2b.contato ct WHERE ct.conta_id=c.conta_id ORDER BY ct.e_principal DESC LIMIT 1) AS contato_principal
    FROM b2b.interacao i
    JOIN b2b.conta c ON c.conta_id = i.conta_id
    WHERE i.status = 'pendente'
      AND i.autor = ${pessoa}
      AND i.data_prevista <= CURRENT_DATE + INTERVAL '14 days'
    ORDER BY
      CASE
        WHEN i.data_prevista < CURRENT_DATE THEN 0  -- atrasada
        WHEN i.data_prevista = CURRENT_DATE THEN 1  -- hoje
        WHEN i.tipo IN ('reuniao','fup') THEN 2     -- FUPs + reuniões próximas
        ELSE 3                                       -- resto
      END,
      i.data_prevista ASC
    LIMIT 50
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[])) as Record<string, unknown>[];
  return rows.map((x) => ({
    interacaoId: Number(x.interacao_id),
    contaId: Number(x.conta_id),
    contaNome: String(x.conta_nome),
    contatoPrincipal: (x.contato_principal as string) ?? null,
    cidade: (x.cidade as string) ?? null,
    uf: (x.uf as string) ?? null,
    tipo: String(x.tipo),
    descricao: (x.descricao as string) ?? null,
    dataPrevista: String(x.data_prevista),
    origem: (x.origem as string) ?? null,
    tel: (x.tel as string) ?? null,
    wa: (x.wa as string) ?? null,
    funilStage: String(x.funil_stage),
  }));
}

// ============================================================
// getFriosDaPessoa — leads que ela nunca tocou
// ============================================================
export async function getFriosDaPessoa(pessoa: string, limit = 50): Promise<AcaoListagem[]> {
  const r = await db.execute(sql`
    SELECT c.conta_id, c.nome AS conta_nome, c.cidade, c.uf, c.funil_stage,
           c.telefone_institucional AS tel, c.whatsapp_institucional AS wa,
           (SELECT ct.nome FROM b2b.contato ct WHERE ct.conta_id=c.conta_id ORDER BY ct.e_principal DESC LIMIT 1) AS contato_principal
    FROM b2b.conta c
    WHERE c.responsavel = ${pessoa}
      AND c.funil_stage = 'sem_contato'
      AND coalesce(c.prioridade_manual, c.prioridade_calc) != 'descartar'
      AND NOT EXISTS (SELECT 1 FROM b2b.interacao i WHERE i.conta_id=c.conta_id)
    ORDER BY
      CASE coalesce(c.prioridade_manual, c.prioridade_calc)
        WHEN 'alta' THEN 0 WHEN 'media' THEN 1 WHEN 'baixa' THEN 2 ELSE 3 END ASC,
      c.conta_id
    LIMIT ${limit}
  `);
  const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[])) as Record<string, unknown>[];
  return rows.map((x) => ({
    interacaoId: 0, // não tem interação ainda
    contaId: Number(x.conta_id),
    contaNome: String(x.conta_nome),
    contatoPrincipal: (x.contato_principal as string) ?? null,
    cidade: (x.cidade as string) ?? null,
    uf: (x.uf as string) ?? null,
    tipo: "ligacao",
    descricao: "Primeira abordagem",
    dataPrevista: fmtISODate(new Date()),
    origem: "frio",
    tel: (x.tel as string) ?? null,
    wa: (x.wa as string) ?? null,
    funilStage: String(x.funil_stage),
  }));
}
