"use server";

import { db } from "@/db";
import {
  conta,
  interacao,
  acao,
  situacao,
  regraCadencia,
  auditoria,
  type Conta,
} from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, sql, count, asc, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function fmtISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function logAuditoria(opts: {
  contaId: number;
  acao: string;
  campo?: string;
  valorAntes?: string | null;
  valorDepois?: string | null;
  contexto?: unknown;
}) {
  const session = await auth();
  if (!session?.user) return;
  const u = session.user as { id?: string; name?: string; email?: string };
  await db.insert(auditoria).values({
    contaId: opts.contaId,
    usuarioId: u.id ?? "desconhecido",
    usuarioEmail: u.email ?? "",
    usuarioNome: u.name ?? "",
    acao: opts.acao,
    campo: opts.campo ?? null,
    valorAntes: opts.valorAntes ?? null,
    valorDepois: opts.valorDepois ?? null,
    contexto: opts.contexto ? JSON.stringify(opts.contexto) : null,
  });
}

export async function atualizarConta(
  contaId: number,
  patch: Partial<Conta>
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [antes] = await db.select().from(conta).where(eq(conta.contaId, contaId));
    await db.update(conta).set(patch).where(eq(conta.contaId, contaId));

    // log diferenças
    for (const [campo, novoValor] of Object.entries(patch)) {
      const anteValor = (antes as unknown as Record<string, unknown>)[campo];
      if (String(anteValor ?? "") !== String(novoValor ?? "")) {
        await logAuditoria({
          contaId,
          acao: `mudou_${campo}`,
          campo,
          valorAntes: String(anteValor ?? ""),
          valorDepois: String(novoValor ?? ""),
        });
      }
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/contas");
    revalidatePath("/pipeline");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moverFunil(
  contaId: number,
  novoStage: string
): Promise<{ ok: boolean; error?: string }> {
  return atualizarConta(contaId, { funilStage: novoStage });
}

export async function criarInteracao(
  contaId: number,
  dados: {
    tipo: string;
    texto: string;
    situacaoId?: string | null;
    contatoId?: number | null;
    dataPersonalizada?: string | null; // YYYY-MM-DD, override do user
  }
): Promise<{
  ok: boolean;
  error?: string;
  acaoCriada?: { dias: number | null; descricao: string };
  funilMovido?: { de: string; para: string };
}> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const u = session.user as { id?: string; name?: string };
  const autor = (u.id || "outro").toLowerCase();
  const autorValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian", "claude"].includes(autor) ? autor : "outro";

  try {
    // Contar tentativas anteriores com a mesma situação (pra cadência escalada)
    let tentativaNum = 1;
    if (dados.situacaoId) {
      const tents = await db
        .select({ n: count() })
        .from(interacao)
        .where(and(eq(interacao.contaId, contaId), eq(interacao.situacaoId, dados.situacaoId)));
      tentativaNum = (tents[0]?.n ?? 0) + 1;
    }

    // Inserir interação
    await db.insert(interacao).values({
      contaId,
      tipo: dados.tipo,
      texto: dados.texto,
      contatoId: dados.contatoId ?? null,
      autor: autorValido,
      situacaoId: dados.situacaoId ?? null,
      tentativaNum,
    });

    // Audit
    await logAuditoria({
      contaId,
      acao: "criou_interacao",
      campo: "interacao",
      valorDepois: `${dados.tipo} · ${dados.situacaoId ?? "sem_situacao"} (tentativa ${tentativaNum})`,
    });

    // Pegar situação + regra
    let acaoCriada: { dias: number | null; descricao: string } | undefined;
    let funilMovido: { de: string; para: string } | undefined;

    const [c] = await db
      .select({ funilStage: conta.funilStage, responsavel: conta.responsavel })
      .from(conta)
      .where(eq(conta.contaId, contaId));

    if (dados.situacaoId) {
      // Buscar situação pra ver se auto-move funil
      const [s] = await db.select().from(situacao).where(eq(situacao.situacaoId, dados.situacaoId));
      if (s?.autoFunil && s.autoFunil !== c?.funilStage) {
        await db
          .update(conta)
          .set({ funilStage: s.autoFunil, updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
        funilMovido = { de: c?.funilStage ?? "", para: s.autoFunil };
        await logAuditoria({
          contaId,
          acao: "auto_mudou_funilStage",
          campo: "funilStage",
          valorAntes: c?.funilStage ?? "",
          valorDepois: s.autoFunil,
          contexto: { motivo: `Situação "${s.label}"` },
        });
      }

      // Buscar regra de cadência (situacaoId + tentativaNum)
      const regras = await db
        .select()
        .from(regraCadencia)
        .where(
          and(
            eq(regraCadencia.situacaoId, dados.situacaoId),
            eq(regraCadencia.ativa, true),
            lte(regraCadencia.tentativaMin, tentativaNum),
            sql`(${regraCadencia.tentativaMax} IS NULL OR ${regraCadencia.tentativaMax} >= ${tentativaNum})`
          )
        )
        .orderBy(asc(regraCadencia.ordem))
        .limit(1);

      if (regras[0]) {
        const r = regras[0];

        // se a regra move pra perdido, faz isso
        if (r.moveFunilPara) {
          await db
            .update(conta)
            .set({ funilStage: r.moveFunilPara, updatedAt: new Date() })
            .where(eq(conta.contaId, contaId));
          await logAuditoria({
            contaId,
            acao: "auto_mudou_funilStage",
            campo: "funilStage",
            valorAntes: c?.funilStage ?? "",
            valorDepois: r.moveFunilPara,
            contexto: { motivo: `Regra cadência: ${r.descricaoAcao}` },
          });
        }

        // criar nova ação (se dias_proxima_acao não é null)
        if (r.diasProximaAcao !== null) {
          // Cancela pendentes anteriores (pra não empilhar)
          await db
            .update(acao)
            .set({ status: "cancelado", updatedAt: new Date() })
            .where(and(eq(acao.contaId, contaId), eq(acao.status, "pendente")));

          const responsavelValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian"].includes(c?.responsavel || "")
            ? (c!.responsavel as "gabriel" | "gabi" | "yasmin" | "ismael" | "lilian")
            : "gabriel";

          const dataPrev = dados.dataPersonalizada || fmtISODate(addDays(new Date(), r.diasProximaAcao));

          await db.insert(acao).values({
            contaId,
            descricao: r.descricaoAcao,
            tipo: r.tipoProximaAcao,
            dataPrevista: dataPrev,
            responsavel: responsavelValido,
            status: "pendente",
            notas: `Regra: ${dados.situacaoId} · tentativa ${tentativaNum}`,
          });
          acaoCriada = { dias: r.diasProximaAcao, descricao: r.descricaoAcao };
        }
      }
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    revalidatePath("/pipeline");

    return { ok: true, acaoCriada, funilMovido };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function marcarAcaoFeita(
  acaoId: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    await db
      .update(acao)
      .set({ status: "feito", concluidoEm: new Date(), updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "marcou_acao_feita",
        campo: "acao",
        valorDepois: a.descricao,
      });
    }
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function adiarAcao(
  acaoId: number,
  diasAFrente: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    const novaData = fmtISODate(addDays(new Date(), diasAFrente));
    await db
      .update(acao)
      .set({ dataPrevista: novaData, updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "adiou_acao",
        campo: "data_prevista",
        valorAntes: a.dataPrevista,
        valorDepois: novaData,
      });
    }
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reagendarAcao(
  acaoId: number,
  dataISO: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    await db
      .update(acao)
      .set({ dataPrevista: dataISO, updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "reagendou_acao",
        campo: "data_prevista",
        valorAntes: a.dataPrevista,
        valorDepois: dataISO,
      });
    }
    revalidatePath(`/contas/${a?.contaId}`);
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

