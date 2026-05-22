import { db } from "@/db";
import { conta, interacao, acao } from "@/db/schema";
import { sql, count, gte, eq, and } from "drizzle-orm";
import { FUNIL_LABEL, FUNIL_COLOR, CANAL_LABEL } from "@/lib/labels";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [funilStats, canalStats, respStats, intercSemana, acoesAtraso] =
    await Promise.all([
      db
        .select({ stage: conta.funilStage, n: count() })
        .from(conta)
        .groupBy(conta.funilStage),
      db
        .select({ canal: conta.canal, n: count() })
        .from(conta)
        .groupBy(conta.canal)
        .orderBy(sql`count(*) desc`),
      db
        .select({ resp: conta.responsavel, n: count() })
        .from(conta)
        .groupBy(conta.responsavel)
        .orderBy(sql`count(*) desc`),
      db
        .select({ n: count() })
        .from(interacao)
        .where(gte(interacao.ocorridoEm, seteDiasAtras)),
      db
        .select({ n: count() })
        .from(acao)
        .where(
          and(
            eq(acao.status, "pendente"),
            sql`${acao.dataPrevista} < CURRENT_DATE`
          )
        ),
    ]);

  const totalContas = funilStats.reduce((a, x) => a + x.n, 0);
  const positivados = funilStats.find((x) => x.stage === "positivado")?.n || 0;
  const propostas =
    funilStats.find((x) => x.stage === "proposta_enviada")?.n || 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Visão operacional do B2B Cells
      </p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Total de contas" valor={totalContas} />
        <Stat label="Positivadas" valor={positivados} cor="text-emerald-600" />
        <Stat label="Propostas enviadas" valor={propostas} cor="text-purple-600" />
        <Stat
          label="Interações últimos 7 dias"
          valor={intercSemana[0]?.n || 0}
          cor="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Funil</h2>
          <div className="space-y-2">
            {funilStats.map((f) => (
              <Link
                key={f.stage}
                href={`/contas?funil=${f.stage}`}
                className="flex items-center justify-between hover:bg-zinc-50 -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      FUNIL_COLOR[f.stage] || "bg-zinc-400"
                    }`}
                  />
                  {FUNIL_LABEL[f.stage] || f.stage}
                </div>
                <span className="text-sm font-mono">{f.n}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Por canal</h2>
          <div className="space-y-2">
            {canalStats.map((c) => (
              <Link
                key={c.canal}
                href={`/contas?canal=${c.canal}`}
                className="flex items-center justify-between hover:bg-zinc-50 -mx-2 px-2 py-1 rounded"
              >
                <span className="text-sm">
                  {CANAL_LABEL[c.canal] || c.canal}
                </span>
                <span className="text-sm font-mono">{c.n}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Por responsável</h2>
          <div className="space-y-2">
            {respStats.map((r) => (
              <Link
                key={r.resp}
                href={`/contas?resp=${r.resp}`}
                className="flex items-center justify-between hover:bg-zinc-50 -mx-2 px-2 py-1 rounded"
              >
                <span className="text-sm capitalize">{r.resp}</span>
                <span className="text-sm font-mono">{r.n}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Operacional</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">Ações em atraso</span>
              <span
                className={`font-semibold ${
                  (acoesAtraso[0]?.n || 0) > 0 ? "text-red-600" : ""
                }`}
              >
                {acoesAtraso[0]?.n || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Tickets nos 7 dias</span>
              <span className="font-semibold">{intercSemana[0]?.n || 0}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  valor,
  cor = "text-zinc-900",
}: {
  label: string;
  valor: number;
  cor?: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${cor}`}>{valor}</div>
    </div>
  );
}
