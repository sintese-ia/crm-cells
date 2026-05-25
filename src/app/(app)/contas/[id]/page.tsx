import { db } from "@/db";
import { conta, contato, interacao, situacao } from "@/db/schema";
import { eq, desc, and, asc, or, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CardConta } from "./_components/card-conta";

export const dynamic = "force-dynamic";

export default async function ContaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contaId = Number(id);
  if (!Number.isInteger(contaId)) notFound();

  const [c] = await db.select().from(conta).where(eq(conta.contaId, contaId));
  if (!c) notFound();

  const contatos = await db.select().from(contato).where(eq(contato.contaId, contaId)).orderBy(desc(contato.ePrincipal), desc(contato.updatedAt));
  // Timeline: realizadas (ocorrido_em DESC) + pendentes (data_prevista ASC)
  const interacoes = await db.select().from(interacao).where(
    and(
      eq(interacao.contaId, contaId),
      or(eq(interacao.status, "realizada"), eq(interacao.status, "feita"), eq(interacao.status, "pendente")),
    )
  ).orderBy(desc(interacao.createdAt));
  const situacoes = await db.select().from(situacao).where(eq(situacao.ativa, true)).orderBy(asc(situacao.ordem));

  // Filhas (se for matriz)
  const filhas = await db.select({ contaId: conta.contaId, nome: conta.nome, cidade: conta.cidade, uf: conta.uf, funilStage: conta.funilStage })
    .from(conta).where(eq(conta.contaMatrizId, contaId)).orderBy(asc(conta.cidade));
  // Matriz (se for filha)
  let matriz: { contaId: number; nome: string } | null = null;
  if (c.contaMatrizId) {
    const [m] = await db.select({ contaId: conta.contaId, nome: conta.nome }).from(conta).where(eq(conta.contaId, c.contaMatrizId));
    matriz = m ?? null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <Link href="/funil" className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] mb-4">
        <ArrowLeft className="w-4 h-4" /> voltar
      </Link>

      <CardConta
        conta={c}
        contatos={contatos}
        interacoes={interacoes}
        situacoes={situacoes}
        filhas={filhas}
        matriz={matriz}
      />
    </div>
  );
}
