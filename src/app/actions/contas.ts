"use server";

import { db } from "@/db";
import { conta, interacao, type Conta } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const autor = (session.user.name || "outro").toLowerCase().split(" ")[0];
  const autorValido =
    ["gabriel", "camila", "ismael", "lilian", "claude", "yasmin"].includes(autor)
      ? autor === "yasmin"
        ? "camila"
        : autor
      : "outro";
  try {
    await db.insert(interacao).values({
      contaId,
      tipo: dados.tipo,
      texto: dados.texto,
      contatoId: dados.contatoId ?? null,
      autor: autorValido,
    });
    revalidatePath(`/contas/${contaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
