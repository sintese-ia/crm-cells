import { db } from "@/db";
import { regraCadencia, situacao, ESTAGIOS_JORNADA, ESTAGIO_LABEL } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { CadenciasForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function CadenciasPage() {
  const situacoes = await db.select().from(situacao).where(eq(situacao.ativa, true)).orderBy(asc(situacao.estagio), asc(situacao.ordem));
  const regras = await db.select().from(regraCadencia).orderBy(asc(regraCadencia.estagio), asc(regraCadencia.situacaoId), asc(regraCadencia.tentativaMin));

  // group by estagio + situacao
  const grouped: Record<string, Record<string, { situacao: typeof situacoes[0]; regras: typeof regras }>> = {};
  for (const s of situacoes) {
    if (!grouped[s.estagio]) grouped[s.estagio] = {};
    grouped[s.estagio][s.situacaoId] = { situacao: s, regras: [] };
  }
  for (const r of regras) {
    if (r.situacaoId && grouped[r.estagio]?.[r.situacaoId]) {
      grouped[r.estagio][r.situacaoId].regras.push(r);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cadências de follow-up</h1>
        <p className="text-sm text-[#6B6B6B]">
          Configure quando o sistema sugere a próxima ação automaticamente.
          Quando alguém registra uma interação com a Situação X, o CRM cria a próxima ação na data calculada.
        </p>
      </div>

      <CadenciasForm grouped={grouped} estagios={ESTAGIOS_JORNADA as readonly string[]} estagioLabel={ESTAGIO_LABEL} />
    </div>
  );
}
