import { db } from "@/db";
import { conta, FUNIL_STAGES } from "@/db/schema";
import { desc } from "drizzle-orm";
import { KanbanBoard } from "./_components/board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const contas = await db.select().from(conta).orderBy(desc(conta.updatedAt));

  const byStage: Record<string, typeof contas> = {};
  for (const s of FUNIL_STAGES) byStage[s] = [];
  for (const c of contas) {
    (byStage[c.funilStage] ?? byStage["base_fria"]).push(c);
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <p className="text-sm text-zinc-500">
          Arraste cards entre colunas pra mover o funil
        </p>
      </div>
      <KanbanBoard byStage={byStage} stages={FUNIL_STAGES as readonly string[]} />
    </div>
  );
}
