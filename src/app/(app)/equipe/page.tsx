import { db } from "@/db";
import { conta, interacao, acao } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, sql, gte, lte, desc, asc, count, inArray } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_COLOR, FUNIL_LABEL } from "@/lib/labels";
import { ProximaAcaoMiniBtns } from "./_components/mini-btns";
import { QuickActions } from "@/components/quick-actions";

export const dynamic = "force-dynamic";

const PESSOAS = [
  { id: "gabriel", label: "Gabriel" },
  { id: "yasmin", label: "Yasmin" },
  { id: "gabi", label: "Gabi" },
];

type DataAcao = {
  acaoId: number;
  descricao: string;
  tipo: string;
  dataPrevista: string;
  contaId: number;
  contaNome: string;
  cidade: string | null;
  uf: string | null;
  tel: string | null;
  wa: string | null;
  funilStage: string;
};

async function pegarAcoesAteSeteDias(pessoa: string): Promise<DataAcao[]> {
  const seteDiasFrente = new Date();
  seteDiasFrente.setDate(seteDiasFrente.getDate() + 7);
  const dataFim = seteDiasFrente.toISOString().slice(0, 10);

  return await db
    .select({
      acaoId: acao.acaoId,
      descricao: acao.descricao,
      tipo: acao.tipo,
      dataPrevista: acao.dataPrevista,
      contaId: conta.contaId,
      contaNome: conta.nome,
      cidade: conta.cidade,
      uf: conta.uf,
      tel: conta.telefoneInstitucional,
      wa: conta.whatsappInstitucional,
      funilStage: conta.funilStage,
    })
    .from(acao)
    .innerJoin(conta, eq(acao.contaId, conta.contaId))
    .where(
      and(
        eq(acao.responsavel, pessoa),
        eq(acao.status, "pendente"),
        lte(acao.dataPrevista, dataFim)
      )
    )
    .orderBy(asc(acao.dataPrevista));
}

async function pegarFrios(pessoa: string) {
  const frios = await db.execute(sql`
    WITH rede_extracted AS (
      SELECT c.conta_id, c.nome, c.cidade, c.uf, c.cnpj,
             c.telefone_institucional, c.whatsapp_institucional,
             (SELECT t FROM unnest(c.tags) t WHERE t LIKE 'rede:%' LIMIT 1) AS rede_tag
      FROM b2b.conta c
      WHERE c.responsavel = ${pessoa}
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
  return (frios as unknown as { rows?: Record<string, unknown>[] }).rows ?? (frios as unknown as Record<string, unknown>[]);
}

export default async function EquipePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "gabriel";
  const sp = await searchParams;
  const pParam = sp.p;
  const ativa = pParam === "todos" ? "todos" : (PESSOAS.find((x) => x.id === pParam)?.id ?? userId);

  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hoje = new Date().toISOString().slice(0, 10);

  // VIEW CONSOLIDADA
  if (ativa === "todos") {
    const acoesPorPessoa: Record<string, DataAcao[]> = {};
    for (const p of PESSOAS) acoesPorPessoa[p.id] = await pegarAcoesAteSeteDias(p.id);

    return (
      <div className="p-4 lg:p-8 max-w-[1500px] mx-auto">
        <Header ativa="todos" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PESSOAS.map((p) => {
            const acoes = acoesPorPessoa[p.id];
            const atrasadas = acoes.filter((a) => a.dataPrevista < hoje);
            const hojeAcoes = acoes.filter((a) => a.dataPrevista === hoje);
            const proximas = acoes.filter((a) => a.dataPrevista > hoje);
            return (
              <div key={p.id} className="bg-white border border-[#E5E2DC] rounded-lg p-4 self-start">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E5E2DC]">
                  <div>
                    <div className="font-bold text-lg" style={{ fontFamily: "'Alias Extended', sans-serif" }}>{p.label}</div>
                    <div className="text-xs">
                      {atrasadas.length > 0 && <span className="text-[#BF360C]">{atrasadas.length} atrasadas · </span>}
                      <span className="text-[#D4541A]">{hojeAcoes.length} hoje</span>
                      {proximas.length > 0 && <span className="text-[#6B6B6B]"> · {proximas.length} próximos 7d</span>}
                    </div>
                  </div>
                  <Link href={`/equipe?p=${p.id}`} className="text-xs px-2 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC]">abrir →</Link>
                </div>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {atrasadas.length > 0 && <MiniGrupo label="⚠️ Atrasadas" cor="text-[#BF360C]" acoes={atrasadas} hoje={hoje} />}
                  {hojeAcoes.length > 0 && <MiniGrupo label="🔥 Hoje" cor="text-[#D4541A]" acoes={hojeAcoes} hoje={hoje} />}
                  {proximas.length > 0 && <MiniGrupo label="📅 Próximos 7 dias" cor="text-[#6B6B6B]" acoes={proximas} hoje={hoje} />}
                  {acoes.length === 0 && <p className="text-xs text-[#6B6B6B] py-4 text-center">Sem ações</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // VIEW POR PESSOA
  const [ligacoesSemana, reuMarcadas, emNeg, positivados] = await Promise.all([
    db.select({ n: count() }).from(interacao).where(and(eq(interacao.autor, ativa), eq(interacao.tipo, "ligacao"), gte(interacao.ocorridoEm, seteDiasAtras))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), eq(conta.funilStage, "visitado"))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), inArray(conta.funilStage, ["contatado", "proposta_enviada"]))),
    db.select({ n: count() }).from(conta).where(and(eq(conta.responsavel, ativa), eq(conta.funilStage, "positivado"))),
  ]);

  const todasAcoes = await pegarAcoesAteSeteDias(ativa);
  const atrasadas = todasAcoes.filter((a) => a.dataPrevista < hoje);
  const hojeAcoes = todasAcoes.filter((a) => a.dataPrevista === hoje);
  const proximas = todasAcoes.filter((a) => a.dataPrevista > hoje);
  const friosRows = await pegarFrios(ativa);

  const lastInterIds = todasAcoes.map((q) => q.contaId);
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
      if (!ultimas.has(x.contaId)) ultimas.set(x.contaId, { texto: x.texto, ocorridoEm: x.ocorridoEm, situacao: x.situacaoId });
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <Header ativa={ativa} totalAcoes={todasAcoes.length} totalFrios={friosRows.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-6 lg:mb-8">
        <StatCard label="📞 Ligações 7d" valor={ligacoesSemana[0]?.n ?? 0} />
        <StatCard label="📅 Reuniões marcadas" valor={reuMarcadas[0]?.n ?? 0} />
        <StatCard label="🤝 Em negociação" valor={emNeg[0]?.n ?? 0} />
        <StatCard label="🎉 Positivados" valor={positivados[0]?.n ?? 0} cor="text-[#00897B]" />
      </div>

      {atrasadas.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#BF360C] mb-3">
            ⚠️ Atrasadas ({atrasadas.length})
          </h2>
          <div className="space-y-2">
            {atrasadas.map((q) => <CardAcao key={q.acaoId} q={q} hoje={hoje} ultima={ultimas.get(q.contaId)} />)}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#D4541A] mb-3">
          🔥 Hoje ({hojeAcoes.length})
        </h2>
        {hojeAcoes.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center bg-white border border-[#E5E2DC] rounded-lg">
            Nenhuma ação pra hoje 🚀
          </p>
        ) : (
          <div className="space-y-2">
            {hojeAcoes.map((q) => <CardAcao key={q.acaoId} q={q} hoje={hoje} ultima={ultimas.get(q.contaId)} />)}
          </div>
        )}
      </section>

      {proximas.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0091EA] mb-3">
            📅 Próximos 7 dias ({proximas.length})
          </h2>
          <div className="space-y-2">
            {proximas.map((q) => <CardAcao key={q.acaoId} q={q} hoje={hoje} ultima={ultimas.get(q.contaId)} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#6B6B6B] mb-3">
          ❄️ Frios — primeiro contato hoje (top {friosRows.length})
        </h2>
        {friosRows.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6 text-center bg-white border border-[#E5E2DC] rounded-lg">
            Sem frios pendentes.
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
                      {row.rede && <span className="text-xs bg-[#F2F0EC] px-2 py-0.5 rounded">🏷️ {row.rede} ({row.rede_size} lojas)</span>}
                    </div>
                    <Link href={`/contas/${row.conta_id}`} className="font-semibold hover:underline">{row.nome}</Link>
                    {row.cidade && <span className="text-xs text-[#6B6B6B] ml-2">{row.cidade}/{row.uf}</span>}
                    <div className="mt-2">
                      <QuickActions telefone={row.telefone_institucional} whatsapp={row.whatsapp_institucional} />
                    </div>
                  </div>
                  <Link href={`/contas/${row.conta_id}`} className="text-xs px-3 py-2 bg-[#0D0D0D] text-white rounded hover:bg-[#1A1A1A] self-center whitespace-nowrap">abrir →</Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CardAcao({ q, hoje, ultima }: { q: DataAcao; hoje: string; ultima?: { texto: string; ocorridoEm: Date; situacao: string | null } }) {
  const atrasada = q.dataPrevista < hoje;
  const ehHoje = q.dataPrevista === hoje;
  const diasDesdeUltima = ultima ? Math.floor((Date.now() - new Date(ultima.ocorridoEm).getTime()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <div className={`bg-white border rounded-lg p-4 flex items-start gap-4 ${atrasada ? "border-[#BF360C]" : ehHoje ? "border-[#D4541A]" : "border-[#E5E2DC]"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 text-xs">
          <span className={`text-white px-2 py-0.5 rounded ${FUNIL_COLOR[q.funilStage] || "bg-zinc-400"}`}>
            {FUNIL_LABEL[q.funilStage] || q.funilStage}
          </span>
          {atrasada && <span className="text-[#BF360C] font-semibold">⚠️ ATRASADA</span>}
        </div>
        <Link href={`/contas/${q.contaId}`} className="font-semibold hover:underline">{q.contaNome}</Link>
        {q.cidade && <span className="text-xs text-[#6B6B6B] ml-2">{q.cidade}/{q.uf}</span>}
        <div className="text-sm mt-1">{q.descricao}</div>
        {ultima && (
          <div className="text-xs text-[#6B6B6B] mt-1 italic">
            Última: &quot;{ultima.texto.slice(0, 80)}{ultima.texto.length > 80 ? "…" : ""}&quot;
            {diasDesdeUltima !== null && ` · há ${diasDesdeUltima === 0 ? "<1d" : `${diasDesdeUltima}d`}`}
          </div>
        )}
        <div className="text-xs text-[#6B6B6B] mt-1">
          {ehHoje ? "HOJE" : `Em ${new Date(q.dataPrevista + "T12:00").toLocaleDateString("pt-BR")}`}
        </div>
        <div className="mt-2">
          <QuickActions telefone={q.tel} whatsapp={q.wa} />
        </div>
      </div>
      <ProximaAcaoMiniBtns acaoId={q.acaoId} />
    </div>
  );
}

function MiniGrupo({ label, cor, acoes, hoje }: { label: string; cor: string; acoes: DataAcao[]; hoje: string }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-bold ${cor} mb-1.5`}>{label}</div>
      <div className="space-y-1.5">
        {acoes.map((a) => {
          const atrasada = a.dataPrevista < hoje;
          return (
            <div key={a.acaoId} className={`p-2 rounded border ${atrasada ? "border-[#BF360C] bg-[#FFF7F0]" : "border-[#E5E2DC]"}`}>
              <Link href={`/contas/${a.contaId}`} className="text-xs font-medium hover:underline line-clamp-1">{a.contaNome}</Link>
              <div className="text-[10px] text-[#0D0D0D] line-clamp-1">{a.descricao}</div>
              {(a.tel || a.wa) && <div className="mt-1"><QuickActions telefone={a.tel} whatsapp={a.wa} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ ativa, totalAcoes, totalFrios }: { ativa: string; totalAcoes?: number; totalFrios?: number }) {
  return (
    <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
          {ativa === "todos" ? "Próximas ações da equipe" : "Próximas ações"}
        </h1>
        <p className="text-sm text-[#6B6B6B]">
          {ativa === "todos"
            ? "O que cada um tem pra fazer hoje e nos próximos 7d"
            : totalAcoes !== undefined
            ? `${totalAcoes} ações em 7 dias · ${totalFrios} frios`
            : ""}
        </p>
      </div>
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        <Link href="/equipe?p=todos" className={`shrink-0 px-3 py-2 text-sm rounded-md border ${ativa === "todos" ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white text-[#0D0D0D] border-[#E5E2DC] hover:bg-[#F2F0EC]"}`}>
          👥 Todos
        </Link>
        {PESSOAS.map((p) => (
          <Link key={p.id} href={`/equipe?p=${p.id}`} className={`shrink-0 px-4 py-2 text-sm rounded-md border ${ativa === p.id ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white text-[#0D0D0D] border-[#E5E2DC] hover:bg-[#F2F0EC]"}`}>
            {p.label}
          </Link>
        ))}
      </div>
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
