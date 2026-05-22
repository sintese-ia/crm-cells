"use server";

import { db } from "@/db";
import { conta, interacao, acao, type Conta } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sugerirProximaAcao, calcularDataPrevista } from "@/lib/regras-fup";

export async function atualizarConta(
  contaId: number,
  patch: Partial<Conta>
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    await db.update(conta).set(patch).where(eq(conta.contaId, contaId));
    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/contas");
    revalidatePath("/pipeline");
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
  dados: { tipo: string; texto: string; contatoId?: number | null }
): Promise<{ ok: boolean; error?: string; acaoCriada?: { dias: number; descricao: string; regra: string } }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const autor = (session.user.name || "outro").toLowerCase().split(" ")[0];
  const autorValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian", "claude"].includes(autor)
    ? autor
    : "outro";
  try {
    await db.insert(interacao).values({
      contaId,
      tipo: dados.tipo,
      texto: dados.texto,
      contatoId: dados.contatoId ?? null,
      autor: autorValido,
    });

    // Pegar funilStage atual + responsável da conta
    const [c] = await db
      .select({ funilStage: conta.funilStage, responsavel: conta.responsavel })
      .from(conta)
      .where(eq(conta.contaId, contaId));

    // Sugerir próxima ação automaticamente
    const sugestao = sugerirProximaAcao({
      texto: dados.texto,
      tipo: dados.tipo,
      funilStage: c?.funilStage || "base_fria",
    });

    let acaoCriada: { dias: number; descricao: string; regra: string } | undefined;

    if (sugestao) {
      // Cancelar ações pendentes anteriores dessa conta — evitar empilhamento
      await db
        .update(acao)
        .set({ status: "cancelado", updatedAt: new Date() })
        .where(and(eq(acao.contaId, contaId), eq(acao.status, "pendente")));

      // Criar nova ação
      const responsavelValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian"].includes(c?.responsavel || "")
        ? (c!.responsavel as "gabriel" | "gabi" | "yasmin" | "ismael" | "lilian")
        : "gabriel";
      await db.insert(acao).values({
        contaId,
        descricao: sugestao.descricao,
        tipo: sugestao.tipo,
        dataPrevista: calcularDataPrevista(sugestao.diasAFrente),
        responsavel: responsavelValido,
        status: "pendente",
        notas: `Sugerido automaticamente pela regra: ${sugestao.regra}`,
      });
      acaoCriada = {
        dias: sugestao.diasAFrente,
        descricao: sugestao.descricao,
        regra: sugestao.regra,
      };
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/hoje");
    return { ok: true, acaoCriada };
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
    await db
      .update(acao)
      .set({ status: "feito", concluidoEm: new Date(), updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    revalidatePath("/hoje");
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
    await db
      .update(acao)
      .set({
        dataPrevista: calcularDataPrevista(diasAFrente),
        updatedAt: new Date(),
      })
      .where(eq(acao.acaoId, acaoId));
    revalidatePath("/hoje");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
