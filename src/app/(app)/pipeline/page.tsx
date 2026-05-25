import { db } from "@/db";
import { conta, FUNIL_STAGES } from "@/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";
import { KanbanBoard } from "./_components/board";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PESSOAS = [
  { id: "todos", label: "Todos" },
  { id: "gabriel", label: "Gabriel" },
  { id: "yasmin", label: "Yasmin" },
  { id: "gabi", label: "Gabi" },
];

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ resp?: string; modo?: string }>;
}) {
  const sp = await searchParams;
  const respAtivo = PESSOAS.find((p) => p.id === sp.resp)?.id ?? "todos";
  const apenasMatrizes = sp.modo === "matriz";

  const conditions = [];
  if (respAtivo !== "todos") conditions.push(eq(conta.responsavel, respAtivo));
  if (apenasMatrizes) conditions.push(isNull(conta.contaMatrizId));

  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  const contas = await db.select().from(conta).where(where).orderBy(desc(conta.updatedAt));

  const byStage: Record<string, typeof contas> = {};
  for (const s of FUNIL_STAGES) byStage[s] = [];
  for (const c of contas) {
    (byStage[c.funilStage] ?? byStage["sem_contato"]).push(c);
  }

  return (
    <div className="p-4 lg:p-6 h-screen flex flex-col">
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            Pipeline
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            {contas.length} contas {respAtivo !== "todos" ? `de ${respAtivo}` : "no total"} · arraste cards entre colunas
          </p>
        </div>
        <div className="flex gap-1 items-center overflow-x-auto -mx-1 px-1 pb-1">
          <Link
            href={`/pipeline?${respAtivo!=="todos"?`resp=${respAtivo}&`:""}${apenasMatrizes ? "" : "modo=matriz"}`}
            className={`text-xs px-2 py-1 rounded border ${apenasMatrizes ? "bg-[#D4541A] text-white border-[#D4541A]" : "bg-white border-[#E5E2DC]"}`}
            title="Mostra só matrizes (esconde filhas de rede)"
          >
            🏢 só matrizes
          </Link>
          <div className="w-px h-6 bg-[#E5E2DC] mx-1" />
          {PESSOAS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "todos" ? `/pipeline${apenasMatrizes?"?modo=matriz":""}` : `/pipeline?resp=${p.id}${apenasMatrizes?"&modo=matriz":""}`}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                respAtivo === p.id ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white text-[#0D0D0D] border-[#E5E2DC] hover:bg-[#F2F0EC]"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <KanbanBoard byStage={byStage} stages={FUNIL_STAGES as readonly string[]} />
    </div>
  );
}
