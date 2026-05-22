import { db } from "@/db";
import { conta, interacao, acao } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, sql, gte, lte, desc, asc, count, inArray, isNull, exists, notExists } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_COLOR, FUNIL_LABEL, TEMP_COLOR } from "@/lib/labels";
import { ProximaAcaoMiniBtns } from "./_components/mini-btns";

export const dynamic = "force-dynamic";

const PESSOAS = [
  { id: "gabriel", label: "Gabriel" },
  { id: "yasmin", label: "Yasmin" },
  { id: "gabi", label: "Gabi" },
];

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "gabriel";
  const sp = await searchParams;
  const ativa = sp.p && PESSOAS.find((x) => x.id === sp.p) ? sp.p! : userId;

  // Stats da semana
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [ligacoesSemana, reuMarcadas, emNeg, positivados] = await Promise.all([
    db.select({ n: count() }).from(interacao).where(and(eq(interacao.autor, ativa), eq(interacao.tipo, "ligacao"), gte(interacao.ocorridoEm, seteDiasAtras))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), eq(conta.funilStage, "visitado"))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), inArray(conta.funilStage, ["contatado", "proposta_enviada"]))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), eq(conta.funilStage, "positivado"))),
  ]);

  // Quentes: contas dessa pessoa com ação pendente <= hoje
  const quentes = await db
    .select({
      acaoId: acao.acaoId,
      descricao: acao.descricao,
      tipo: acao.tipo,
      dataPrevista: acao.dataPrevista,
      contaId: conta.contaId,
      contaNome: conta.nome,
      cidade: conta.cidade,
      uf: conta.uf,
      cnpj: conta.cnpj,
      tel: conta.telefoneInstitucional,
      wa: conta.whatsappInstitucional,
      funilStage: conta.funilStage,
      temperatura: conta.temperatura,
    })
    .from(acao)
    .innerJoin(conta, eq(acao.contaId, conta.contaId))
    .where(
      and(
        eq(acao.responsavel, ativa),
        eq(acao.status, "pendente"),
        lte(acao.dataPrevista, sql`CURRENT_DATE`)
      )
    )
    .orderBy(asc(acao.dataPrevista));

  // Frios: contas dessa pessoa em base_fria SEM nenhuma interação, ordenadas por tamanho de rede
  const frios = await db.execute(sql`
    WITH rede_extracted AS (
      SELECT c.conta_id, c.nome, c.cidade, c.uf, c.cnpj,
             c.telefone_institucional, c.whatsapp_institucional,
             (SELECT t FROM unnest(c.tags) t WHERE t LIKE 'rede:%' LIMIT 1) AS rede_tag
      FROM b2b.conta c
      WHERE c.responsavel = ${ativa}
        AND c.funil_stage = 'base_fria'
        AND NOT EXISTS (SELECT 1 FROM b2b.interacao i WHERE i.conta_id = c.conta_id)
    )
    SELECT r.conta_id, r.nome, r.cidade, r.uf, r.cnpj,
           r.telefone_institucional, r.whatsapp_institucional,
           CASE WHEN r.rede_tag IS NOT NULL THEN replace(r.rede_tag, 'rede:', '') ELSE NULL END AS rede,
           COALESCE((SELECT count(*)::int FROM b2b.conta c2 WHERE r.rede_tag = ANY(c2.tags)), 1) AS rede_size
    FROM rede_extracted r
    ORDER BY rede_size DESC NULLS LAST, conta_id
    LIMIT 10
  `);
  const friosRows = (frios as unknown as { rows?: Record<string, unknown>[] }).rows ?? (frios as unknown as Record<string, unknown>[]);

  // Última interação por conta — pra mostrar "última: ...há X dias"
  const lastInterIds = quentes.map((q) => q.contaId);
  const ultimas: Map<number, { texto: string; ocorridoEm: Date; situacao: string | null }> = new Map();
  if (lastInterIds.length > 0) {
    const us = await db
      .select({
        contaId: interacao.contaId,
        texto: interacao.texto,
        ocorridoEm: interacao.ocorridoEm,
        situacaoId: interacao.situacaoId,
      })
      .from(interacao)
      .where(inArray(interacao.contaId, lastInterIds))
      .orderBy(desc(interacao.ocorridoEm));
    for (const x of us) {
      if (!ultimas.has(x.contaId)) {
        ultimas.set(x.contaId, { texto: x.texto, ocorridoEm: x.ocorridoEm, situacao: x.situacaoId });
      }
    }
  }

  const totalQuentes = quentes.length;
  const totalFrios = friosRows.length;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            Equipe
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            {totalQuentes} {totalQuentes === 1 ? "ação quente" : "ações quentes"} · {totalFrios} frios pra primeiro contato hoje
          </p>
        </div>
        <div className="flex gap-1">
          {PESSOAS.map((p) => (
            <Link
              key={p.id}
              href={`/equipe?p=${p.id}`}
              className={`px-4 py-2 text-sm rounded-md border ${
                ativa === p.id ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white text-[#0D0D0D] border-[#E5E2DC] hover:bg-[#F2F0EC]"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats da semana */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="📞 Ligações (7d)" valor={ligacoesSemana[0]?.n ?? 0} />
        <StatCard label="📅 Reuniões marcadas" valor={reuMarcadas[0]?.n ?? 0} />
        <StatCard label="🤝 Em negociação" valor={emNeg[0]?.n ?? 0} />
        <StatCard label="🎉 Positivados" valor={positivados[0]?.n ?? 0} cor="text-[#00897B]" />
      </div>

      {/* Quentes */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#D4541A] mb-3">
          🔥 Quentes — FUP pra hoje ({totalQuentes})
        </h2>
        {quentes.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center bg-white border border-[#E5E2DC] rounded-lg">
            Nenhuma ação pendente — bom trabalho! 🚀
          </p>
        ) : (
          <div className="space-y-2">
            {quentes.map((q) => {
              const u = ultimas.get(q.contaId);
              const atrasada = q.dataPrevista < hoje;
              const diasDesdeUltima = u ? Math.floor((Date.now() - new Date(u.ocorridoEm).getTime()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={q.acaoId} className={`bg-white border rounded-lg p-4 flex items-start gap-4 ${atrasada ? "border-[#BF360C]" : "border-[#E5E2DC]"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className={`text-white px-2 py-0.5 rounded ${FUNIL_COLOR[q.funilStage] || "bg-zinc-400"}`}>
                        {FUNIL_LABEL[q.funilStage] || q.funilStage}
                      </span>
                      {atrasada && <span className="text-[#BF360C] font-semibold">⚠️ EM ATRASO</span>}
                    </div>
                    <Link href={`/contas/${q.contaId}`} className="font-semibold hover:underline">
                      {q.contaNome}
                    </Link>
                    {q.cidade && <span className="text-xs text-[#6B6B6B] ml-2">{q.cidade}/{q.uf}</span>}
                    {(q.tel || q.wa) && (
                      <div className="text-xs text-[#6B6B6B]">
                        📞 {q.tel || q.wa}
                      </div>
                    )}
                    <div className="text-sm mt-1">{q.descricao}</div>
                    {u && (
                      <div className="text-xs text-[#6B6B6B] mt-1 italic">
                        Última: "{u.texto.slice(0, 80)}{u.texto.length > 80 ? "…" : ""}"
                        {diasDesdeUltima !== null && ` · há ${diasDesdeUltima === 0 ? "<1d" : `${diasDesdeUltima}d`}`}
                      </div>
                    )}
                    <div className="text-xs text-[#6B6B6B] mt-1">
                      Próxima ação: <strong>{new Date(q.dataPrevista + "T12:00").toLocaleDateString("pt-BR")}</strong>
                    </div>
                  </div>
                  <ProximaAcaoMiniBtns acaoId={q.acaoId} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Frios */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0091EA] mb-3">
          ❄️ Frios — primeiro contato hoje (top {totalFrios} de rede grande)
        </h2>
        {friosRows.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center bg-white border border-[#E5E2DC] rounded-lg">
            Nenhum lead frio nessa fila.
          </p>
        ) : (
          <div className="space-y-2">
            {friosRows.map((f) => {
              const row = f as { conta_id: number; nome: string; cidade?: string; uf?: string; cnpj?: string; telefone_institucional?: string; whatsapp_institucional?: string; rede?: string; rede_size?: number };
              return (
                <div key={row.conta_id} className="bg-white border border-[#E5E2DC] rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span className="text-white px-2 py-0.5 rounded bg-[#6B6B6B]">Base fria</span>
                      {row.rede && (
                        <span className="text-xs bg-[#F2F0EC] px-2 py-0.5 rounded">
                          🏷️ {row.rede} ({row.rede_size} lojas)
                        </span>
                      )}
                    </div>
                    <Link href={`/contas/${row.conta_id}`} className="font-semibold hover:underline">
                      {row.nome}
                    </Link>
                    {row.cidade && <span className="text-xs text-[#6B6B6B] ml-2">{row.cidade}/{row.uf}</span>}
                    {(row.telefone_institucional || row.whatsapp_institucional) && (
                      <div className="text-xs text-[#6B6B6B]">📞 {row.telefone_institucional || row.whatsapp_institucional}</div>
                    )}
                  </div>
                  <Link
                    href={`/contas/${row.conta_id}`}
                    className="text-xs px-3 py-2 bg-[#0D0D0D] text-white rounded hover:bg-[#1A1A1A] self-center whitespace-nowrap"
                  >
                    abrir lead
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, valor, cor = "text-[#0D0D0D]" }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="bg-white border border-[#E5E2DC] rounded-lg p-4">
      <div className="text-xs text-[#6B6B6B] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
    </div>
  );
}
