"use server";
import { db } from "@/db";
import { regraCadencia } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function atualizarRegra(
  regraId: number,
  patch: { diasProximaAcao?: number; descricaoAcao?: string; ativa?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "admin") return { ok: false, error: "Sem permissão" };
  try {
    await db
      .update(regraCadencia)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(regraCadencia.regraId, regraId));
    revalidatePath("/admin/cadencias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
