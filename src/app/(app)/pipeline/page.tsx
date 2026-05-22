import { db } from "@/db";
import { conta, FUNIL_STAGES } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
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
  searchParams: Promise<{ resp?: string }>;
}) {
  const sp = await searchParams;
  const respAtivo = PESSOAS.find((p) => p.id === sp.resp)?.id ?? "todos";

  const where = respAtivo === "todos" ? undefined : eq(conta.responsavel, respAtivo);
  const contas = await db.select().from(conta).where(where).orderBy(desc(conta.updatedAt));

  const byStage: Record<string, typeof contas> = {};
  for (const s of FUNIL_STAGES) byStage[s] = [];
  for (const c of contas) {
    (byStage[c.funilStage] ?? byStage["base_fria"]).push(c);
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            Pipeline
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            {contas.length} contas {respAtivo !== "todos" ? `de ${respAtivo}` : "no total"} · arraste cards entre colunas
          </p>
        </div>
        <div className="flex gap-1">
          {PESSOAS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "todos" ? "/pipeline" : `/pipeline?resp=${p.id}`}
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
