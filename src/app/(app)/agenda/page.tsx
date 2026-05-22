import { db } from "@/db";
import { acao, conta } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, sql, gte, lte } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PESSOAS = [
  { id: "todos", label: "Todos" },
  { id: "gabriel", label: "Gabriel" },
  { id: "yasmin", label: "Yasmin" },
  { id: "gabi", label: "Gabi" },
];

const CORES_RESP: Record<string, string> = {
  gabriel: "bg-[#D4541A]",
  yasmin: "bg-[#0091EA]",
  gabi: "bg-[#00897B]",
  ismael: "bg-[#FFB300]",
  lilian: "bg-[#E91E63]",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ resp?: string; mes?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const respFiltro = PESSOAS.find((p) => p.id === sp.resp)?.id ?? "todos";

  // Mês base: param "mes" ou hoje
  const hoje = new Date();
  let baseDate: Date;
  if (sp.mes) {
    const [a, m] = sp.mes.split("-").map(Number);
    baseDate = new Date(a, m - 1, 1);
  } else {
    baseDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  const inicio = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const fim = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const inicioISO = inicio.toISOString().slice(0, 10);
  const fimISO = fim.toISOString().slice(0, 10);

  const filters = [
    eq(acao.status, "pendente"),
    gte(acao.dataPrevista, inicioISO),
    lte(acao.dataPrevista, fimISO),
  ];
  if (respFiltro !== "todos") filters.push(eq(acao.responsavel, respFiltro));

  const acoes = await db
    .select({
      acaoId: acao.acaoId,
      dataPrevista: acao.dataPrevista,
      descricao: acao.descricao,
      tipo: acao.tipo,
      responsavel: acao.responsavel,
      contaId: conta.contaId,
      contaNome: conta.nome,
    })
    .from(acao)
    .innerJoin(conta, eq(acao.contaId, conta.contaId))
    .where(and(...filters));

  // Agrupar por dia
  const porDia: Record<string, typeof acoes> = {};
  for (const a of acoes) {
    (porDia[a.dataPrevista] ??= []).push(a);
  }

  // Gerar grid do mês (domingo a sábado)
  const primeiroDiaSemana = inicio.getDay(); // 0=domingo
  const ultimoDia = fim.getDate();
  const cels: { data: string; dia: number; foraMes: boolean }[] = [];

  // dias do mês anterior (filler)
  for (let i = primeiroDiaSemana; i > 0; i--) {
    const d = new Date(inicio);
    d.setDate(-i + 1);
    cels.push({ data: d.toISOString().slice(0, 10), dia: d.getDate(), foraMes: true });
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), d);
    cels.push({ data: dt.toISOString().slice(0, 10), dia: d, foraMes: false });
  }
  // filler até completar semana
  while (cels.length % 7 !== 0) {
    const last = new Date(cels[cels.length - 1].data);
    last.setDate(last.getDate() + 1);
    cels.push({ data: last.toISOString().slice(0, 10), dia: last.getDate(), foraMes: true });
  }

  const mesPrev = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  const mesNext = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  const fmtMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const hojeISO = hoje.toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            Agenda
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            {acoes.length} ações em{" "}
            {inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agenda?mes=${fmtMes(mesPrev)}${respFiltro!=="todos"?`&resp=${respFiltro}`:""}`} className="px-3 py-1.5 text-sm rounded border border-[#E5E2DC]">←</Link>
          <span className="text-sm font-medium capitalize min-w-[150px] text-center">
            {inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <Link href={`/agenda?mes=${fmtMes(mesNext)}${respFiltro!=="todos"?`&resp=${respFiltro}`:""}`} className="px-3 py-1.5 text-sm rounded border border-[#E5E2DC]">→</Link>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {PESSOAS.map((p) => (
          <Link
            key={p.id}
            href={p.id === "todos" ? `/agenda?mes=${fmtMes(baseDate)}` : `/agenda?resp=${p.id}&mes=${fmtMes(baseDate)}`}
            className={`px-3 py-1.5 text-sm rounded-md border flex items-center gap-1.5 ${
              respFiltro === p.id ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC]"
            }`}
          >
            {p.id !== "todos" && <span className={`w-2 h-2 rounded-full ${CORES_RESP[p.id]}`} />}
            {p.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-[#E5E2DC] rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-[#F2F0EC] text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">
          {["DOM","SEG","TER","QUA","QUI","SEX","SAB"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cels.map((c) => {
            const acoesNoDia = porDia[c.data] ?? [];
            const ehHoje = c.data === hojeISO;
            const fimSem = new Date(c.data + "T00:00").getDay() === 0 || new Date(c.data + "T00:00").getDay() === 6;
            return (
              <div
                key={c.data}
                className={`border border-[#E5E2DC] min-h-[100px] p-2 ${c.foraMes ? "bg-[#FAFAF8] text-[#C0C0C0]" : ""} ${ehHoje ? "ring-2 ring-[#D4541A] ring-inset" : ""} ${fimSem && !c.foraMes ? "bg-[#FAFAF8]" : ""}`}
              >
                <div className="text-xs font-mono mb-1 flex justify-between">
                  <span className={ehHoje ? "text-[#D4541A] font-bold" : ""}>{c.dia}</span>
                  {acoesNoDia.length > 0 && <span className="text-[#6B6B6B]">{acoesNoDia.length}</span>}
                </div>
                <div className="space-y-0.5">
                  {acoesNoDia.slice(0, 4).map((a) => (
                    <Link
                      key={a.acaoId}
                      href={`/contas/${a.contaId}`}
                      className={`block text-[10px] px-1.5 py-0.5 rounded text-white truncate ${CORES_RESP[a.responsavel] || "bg-zinc-400"}`}
                      title={`${a.contaNome} · ${a.descricao}`}
                    >
                      {a.contaNome}
                    </Link>
                  ))}
                  {acoesNoDia.length > 4 && (
                    <div className="text-[10px] text-[#6B6B6B] text-center">+{acoesNoDia.length - 4}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-xs text-[#6B6B6B] flex gap-3 flex-wrap">
        <span className="font-semibold uppercase tracking-wider mr-2">Legenda:</span>
        {Object.entries(CORES_RESP).filter(([k]) => ["gabriel","yasmin","gabi"].includes(k)).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c}`} /> {k}</span>
        ))}
      </div>
    </div>
  );
}
