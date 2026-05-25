import { db } from "@/db";
import { conta, interacao, acao, situacao } from "@/db/schema";
import { sql, count, gte, eq, and, inArray, asc } from "drizzle-orm";
import { FUNIL_LABEL, FUNIL_COLOR, CANAL_LABEL } from "@/lib/labels";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PESSOAS = ["gabriel", "yasmin", "gabi"];

export default async function DashboardPage() {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [funilStats, canalStats, intercSemana, acoesAtraso] = await Promise.all([
    db.select({ stage: conta.funilStage, n: count() }).from(conta).groupBy(conta.funilStage),
    db.select({ canal: conta.canal, n: count() }).from(conta).groupBy(conta.canal).orderBy(sql`count(*) desc`),
    db.select({ n: count() }).from(interacao).where(gte(interacao.ocorridoEm, seteDiasAtras)),
    db.select({ n: count() }).from(acao).where(and(eq(acao.status, "pendente"), sql`${acao.dataPrevista} < CURRENT_DATE`)),
  ]);

  // Por pessoa
  const statsPorPessoa = await Promise.all(
    PESSOAS.map(async (p) => {
      const [total, ligs, reus, neg, pos, fechados7d] = await Promise.all([
        db.select({ n: count() }).from(conta).where(eq(conta.responsavel, p)),
        db.select({ n: count() }).from(interacao).where(and(eq(interacao.autor, p), eq(interacao.tipo, "ligacao"), gte(interacao.ocorridoEm, seteDiasAtras))),
        db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, p), eq(conta.funilStage, "reuniao"))),
        db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, p), inArray(conta.funilStage, ["contato_realizado", "em_negociacao"]))),
        db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, p), eq(conta.funilStage, "positivada"))),
        // positivações nos últimos 30 dias = nova interação com situacaoId='ca_fechou' na janela
        db.select({ n: count() }).from(interacao).where(and(eq(interacao.autor, p), eq(interacao.situacaoId, "ca_fechou"), gte(interacao.ocorridoEm, trintaDiasAtras))),
      ]);
      return {
        pessoa: p,
        total: total[0]?.n ?? 0,
        ligacoes: ligs[0]?.n ?? 0,
        reunioes: reus[0]?.n ?? 0,
        negociacao: neg[0]?.n ?? 0,
        positivados: pos[0]?.n ?? 0,
        fechados30d: fechados7d[0]?.n ?? 0,
      };
    })
  );

  // Funil-shape conversão
  const f: Record<string, number> = {};
  for (const fs of funilStats) f[fs.stage] = fs.n;
  const taxaContatadoVisitado = f["contato_realizado"] ? Math.round((f["reuniao"] / f["contato_realizado"]) * 100) : 0;
  const taxaVisitadoProposta = f["reuniao"] ? Math.round((f["em_negociacao"] / f["reuniao"]) * 100) : 0;
  const taxaPropostaPositivado = f["em_negociacao"] ? Math.round((f["positivada"] / f["em_negociacao"]) * 100) : 0;

  const totalContas = funilStats.reduce((a, x) => a + x.n, 0);
  const positivadosTot = f["positivada"] ?? 0;
  const propostasTot = f["em_negociacao"] ?? 0;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-bold mb-1" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Dashboard</h1>
      <p className="text-sm text-[#6B6B6B] mb-4 lg:mb-6">Visão operacional do B2B Cells</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-6 lg:mb-8">
        <Stat label="Total de contas" valor={totalContas} />
        <Stat label="Positivadas" valor={positivadosTot} cor="text-[#00897B]" />
        <Stat label="Propostas enviadas" valor={propostasTot} cor="text-[#D4541A]" />
        <Stat label="Interações 7d" valor={intercSemana[0]?.n ?? 0} cor="text-[#0091EA]" />
      </div>

      {/* Performance por pessoa */}
      <section className="bg-white border border-[#E5E2DC] rounded-lg p-6 mb-6">
        <h2 className="font-bold mb-4" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
          Performance por pessoa (últimos 7 dias)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#6B6B6B]">
              <tr className="border-b border-[#E5E2DC]">
                <th className="text-left pb-2 font-medium">Pessoa</th>
                <th className="text-right pb-2 font-medium">Carteira</th>
                <th className="text-right pb-2 font-medium">📞 Ligações</th>
                <th className="text-right pb-2 font-medium">📅 Reuniões</th>
                <th className="text-right pb-2 font-medium">🤝 Em neg.</th>
                <th className="text-right pb-2 font-medium">🎉 Positiv.</th>
                <th className="text-right pb-2 font-medium">Fechou 30d</th>
              </tr>
            </thead>
            <tbody>
              {statsPorPessoa.map((s) => (
                <tr key={s.pessoa} className="border-b border-[#F2F0EC] last:border-0">
                  <td className="py-2 capitalize font-medium">{s.pessoa}</td>
                  <td className="py-2 text-right">{s.total}</td>
                  <td className="py-2 text-right">{s.ligacoes}</td>
                  <td className="py-2 text-right">{s.reunioes}</td>
                  <td className="py-2 text-right">{s.negociacao}</td>
                  <td className="py-2 text-right text-[#00897B] font-semibold">{s.positivados}</td>
                  <td className="py-2 text-right">{s.fechados30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
          <h2 className="font-bold mb-4">Funil</h2>
          <div className="space-y-2">
            {funilStats.map((fst) => (
              <Link
                key={fst.stage}
                href={`/contas?funil=${fst.stage}`}
                className="flex items-center justify-between hover:bg-[#F2F0EC] -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${FUNIL_COLOR[fst.stage] || "bg-zinc-400"}`} />
                  {FUNIL_LABEL[fst.stage] || fst.stage}
                </div>
                <span className="text-sm font-mono">{fst.n}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
          <h2 className="font-bold mb-4">Taxas de conversão</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Contatado → Reunião marcada</span>
              <span className="font-semibold">{taxaContatadoVisitado}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Reunião → Proposta</span>
              <span className="font-semibold">{taxaVisitadoProposta}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B]">Proposta → Fechou</span>
              <span className="font-semibold text-[#00897B]">{taxaPropostaPositivado}%</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#E5E2DC]">
              <span className="text-[#6B6B6B]">Ações em atraso</span>
              <span className={`font-semibold ${(acoesAtraso[0]?.n ?? 0) > 0 ? "text-[#BF360C]" : ""}`}>
                {acoesAtraso[0]?.n ?? 0}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
          <h2 className="font-bold mb-4">Por canal</h2>
          <div className="grid grid-cols-1 gap-1">
            {canalStats.map((c) => (
              <Link key={c.canal} href={`/contas?canal=${c.canal}`} className="flex items-center justify-between hover:bg-[#F2F0EC] -mx-2 px-2 py-1 rounded text-sm">
                <span>{CANAL_LABEL[c.canal] || c.canal}</span>
                <span className="font-mono">{c.n}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
          <h2 className="font-bold mb-4">Distribuição por última Situação registrada</h2>
          <SituacaoStats />
        </section>
      </div>
    </div>
  );
}

async function SituacaoStats() {
  const stats = await db.execute(sql`
    SELECT s.label, s.icon, s.estagio, count(distinct ult.conta_id) as n
    FROM b2b.situacao s
    LEFT JOIN (
      SELECT DISTINCT ON (conta_id) conta_id, situacao_id
      FROM b2b.interacao
      WHERE situacao_id IS NOT NULL
      ORDER BY conta_id, ocorrido_em DESC
    ) ult ON ult.situacao_id = s.situacao_id
    GROUP BY s.situacao_id, s.label, s.icon, s.estagio, s.ordem
    HAVING count(distinct ult.conta_id) > 0
    ORDER BY count(distinct ult.conta_id) DESC
  `);
  const rows = (stats as unknown as { rows?: Record<string, unknown>[] }).rows ?? (stats as unknown as Record<string, unknown>[]);
  return (
    <div className="space-y-1 max-h-80 overflow-auto">
      {rows.map((r) => {
        const row = r as { label: string; icon: string; estagio: string; n: number };
        return (
          <div key={row.label} className="flex items-center justify-between text-sm px-2 py-1 hover:bg-[#F2F0EC] rounded">
            <span className="truncate">{row.icon} {row.label}</span>
            <span className="font-mono ml-2">{row.n}</span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, valor, cor = "text-[#0D0D0D]" }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="bg-white border border-[#E5E2DC] rounded-lg p-5">
      <div className="text-xs text-[#6B6B6B] mb-1">{label}</div>
      <div className={`text-3xl font-bold ${cor}`} style={{ fontFamily: "'Alias Extended', sans-serif" }}>
        {valor}
      </div>
    </div>
  );
}
