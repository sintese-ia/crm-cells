import { db } from "@/db";
import { conta, FUNIL_STAGES, RESPONSAVEIS } from "@/db/schema";
import { sql, isNull, and, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FUNIL_LABEL: Record<string, string> = {
  sem_contato: "Sem contato",
  contato_realizado: "Contato realizado",
  reuniao: "Reunião",
  em_negociacao: "Em negociação",
  pedido_realizado: "Pedido realizado",
  positivada: "Positivada",
  negativa: "Negativa",
};

const FUNIL_COR: Record<string, string> = {
  sem_contato: "bg-[#6B6B6B]",
  contato_realizado: "bg-[#1C2A35]",
  reuniao: "bg-[#0091EA]",
  em_negociacao: "bg-[#D4772C]",
  pedido_realizado: "bg-[#00C853]",
  positivada: "bg-[#00897B]",
  negativa: "bg-[#BF360C]",
};

type CardConta = {
  conta_id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
  funil_stage: string;
  responsavel: string | null;
  tipo: string | null;
  n_lojas: number | null;
};

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ resp?: string }> }) {
  const sp = await searchParams;
  const resp = sp.resp ?? "todos";

  const filtros = [];
  if (resp === "__sem__") filtros.push(isNull(conta.responsavel));
  else if (resp !== "todos" && RESPONSAVEIS.includes(resp as never)) filtros.push(eq(conta.responsavel, resp));
  // Só mostra matrizes/independentes — esconde filhas de rede (>2000 cards = inviável)
  filtros.push(isNull(conta.contaMatrizId));

  const where = filtros.length > 0 ? and(...filtros) : undefined;

  const r = await db.select({
    conta_id: conta.contaId,
    nome: conta.nome,
    cidade: conta.cidade,
    uf: conta.uf,
    funil_stage: conta.funilStage,
    responsavel: conta.responsavel,
    tipo: conta.tipo,
    n_lojas: conta.nLojas,
  }).from(conta).where(where).orderBy(sql`c.updated_at DESC`.append(sql``)).limit(500);

  const byStage: Record<string, CardConta[]> = {};
  for (const s of FUNIL_STAGES) byStage[s] = [];
  for (const c of r as CardConta[]) (byStage[c.funil_stage] ?? byStage["sem_contato"]).push(c);

  return (
    <div className="p-4 lg:p-6 h-screen flex flex-col">
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Funil</h1>
          <p className="text-sm text-[#6B6B6B]">{r.length} contas (matrizes + independentes, filhas escondidas)</p>
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
          <Link href="/funil" className={`shrink-0 px-3 py-1.5 text-sm rounded-md border ${resp === "todos" ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC]"}`}>Todos</Link>
          {(RESPONSAVEIS as readonly string[]).slice(0, 3).map((p) => (
            <Link key={p} href={`/funil?resp=${p}`} className={`shrink-0 px-3 py-1.5 text-sm rounded-md border capitalize ${resp === p ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC]"}`}>{p}</Link>
          ))}
          <Link href="/funil?resp=__sem__" className={`shrink-0 px-3 py-1.5 text-sm rounded-md border ${resp === "__sem__" ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC]"}`}>Sem dono</Link>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
        {FUNIL_STAGES.map((stage) => (
          <div key={stage} className="bg-zinc-100 rounded-lg w-72 flex-shrink-0 flex flex-col max-h-full">
            <div className={`px-3 py-2 sticky top-0 ${FUNIL_COR[stage]} text-white rounded-t-lg flex items-center justify-between`}>
              <span className="text-sm font-medium">{FUNIL_LABEL[stage]}</span>
              <span className="text-xs">{byStage[stage].length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1">
              {byStage[stage].map((c) => (
                <Link key={c.conta_id} href={`/contas/${c.conta_id}`} className="block bg-white rounded p-2.5 border border-[#E5E2DC] hover:border-[#D4541A] hover:shadow-sm">
                  <div className="text-sm font-medium line-clamp-2">{c.nome}</div>
                  <div className="text-[10px] text-[#6B6B6B] mt-1 flex flex-wrap gap-1.5">
                    {c.cidade && <span>{c.cidade}/{c.uf}</span>}
                    {c.tipo && c.tipo !== "loja_unica" && <span>· {c.tipo}{c.n_lojas && c.n_lojas > 1 ? ` (${c.n_lojas})` : ""}</span>}
                    {c.responsavel && <span>· {c.responsavel}</span>}
                  </div>
                </Link>
              ))}
              {byStage[stage].length === 0 && <p className="text-[10px] text-[#6B6B6B] text-center py-4">vazio</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
