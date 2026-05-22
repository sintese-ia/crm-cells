import { db } from "@/db";
import { acao, conta } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_LABEL, FUNIL_COLOR, TEMP_COLOR } from "@/lib/labels";
import { AcaoActions } from "./_components/acoes";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  ligar: "📞 Ligar",
  mandar_email: "✉️ Email",
  mandar_whatsapp: "💬 WhatsApp",
  enviar_proposta: "📄 Enviar proposta",
  visitar: "🚶 Visitar",
  follow_up: "↪️ Follow-up",
  cobrar_pedido: "💰 Cobrar pedido",
  outro: "• Outro",
};

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ resp?: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const sp = await searchParams;
  const respFiltro = sp.resp || userId || "gabriel";

  const acoes = await db
    .select({
      acaoId: acao.acaoId,
      descricao: acao.descricao,
      tipo: acao.tipo,
      dataPrevista: acao.dataPrevista,
      responsavel: acao.responsavel,
      notas: acao.notas,
      contaId: conta.contaId,
      contaNome: conta.nome,
      cidade: conta.cidade,
      uf: conta.uf,
      funilStage: conta.funilStage,
      temperatura: conta.temperatura,
    })
    .from(acao)
    .innerJoin(conta, eq(acao.contaId, conta.contaId))
    .where(
      and(
        eq(acao.status, "pendente"),
        lte(acao.dataPrevista, sql`CURRENT_DATE`),
        eq(acao.responsavel, respFiltro)
      )
    )
    .orderBy(acao.dataPrevista);

  // Estatísticas por responsável (todos)
  const stats = await db
    .select({
      responsavel: acao.responsavel,
      n: sql<number>`count(*)::int`,
    })
    .from(acao)
    .where(and(eq(acao.status, "pendente"), lte(acao.dataPrevista, sql`CURRENT_DATE`)))
    .groupBy(acao.responsavel);

  const hoje = acoes.filter((a) => a.dataPrevista === new Date().toISOString().slice(0, 10));
  const atrasadas = acoes.filter((a) => a.dataPrevista < new Date().toISOString().slice(0, 10));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Hoje</h1>
          <p className="text-sm text-[#6B6B6B]">
            {acoes.length} {acoes.length === 1 ? "ação pendente" : "ações pendentes"}
            {atrasadas.length > 0 && (
              <span className="text-[#BF360C] ml-2">
                · {atrasadas.length} em atraso
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {["gabriel", "yasmin", "gabi"].map((r) => {
            const n = stats.find((s) => s.responsavel === r)?.n ?? 0;
            return (
              <Link
                key={r}
                href={`/hoje?resp=${r}`}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  respFiltro === r
                    ? "bg-[#0D0D0D] text-white border-[#0D0D0D]"
                    : "bg-white text-[#0D0D0D] border-[#E5E2DC]"
                }`}
              >
                {r} ({n})
              </Link>
            );
          })}
        </div>
      </div>

      {atrasadas.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[#BF360C] uppercase tracking-wider">
            ⚠️ Em atraso ({atrasadas.length})
          </h2>
          <div className="space-y-2">
            {atrasadas.map((a) => (
              <CardAcao key={a.acaoId} a={a} atrasada />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider text-[#6B6B6B]">
          Pra hoje ({hoje.length})
        </h2>
        {hoje.length === 0 && atrasadas.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-8 text-center bg-white rounded-lg border border-[#E5E2DC]">
            ✨ Nenhuma ação pendente — bom trabalho!
          </p>
        ) : (
          <div className="space-y-2">
            {hoje.map((a) => (
              <CardAcao key={a.acaoId} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardAcao({
  a,
  atrasada = false,
}: {
  a: {
    acaoId: number;
    descricao: string;
    tipo: string;
    dataPrevista: string;
    responsavel: string;
    notas: string | null;
    contaId: number;
    contaNome: string;
    cidade: string | null;
    uf: string | null;
    funilStage: string;
    temperatura: string;
  };
  atrasada?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-4 flex items-center gap-4 ${
        atrasada ? "border-[#BF360C]" : "border-[#E5E2DC]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">
            {TIPO_LABEL[a.tipo] || a.tipo}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded text-white ${
              FUNIL_COLOR[a.funilStage] || "bg-zinc-400"
            }`}
          >
            {FUNIL_LABEL[a.funilStage] || a.funilStage}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              TEMP_COLOR[a.temperatura] || "bg-zinc-400"
            }`}
          />
        </div>
        <Link
          href={`/contas/${a.contaId}`}
          className="font-medium hover:underline"
        >
          {a.contaNome}
        </Link>
        {a.cidade && (
          <span className="text-xs text-[#6B6B6B] ml-2">
            · {a.cidade}/{a.uf}
          </span>
        )}
        <div className="text-sm text-[#2A2A2A] mt-1">{a.descricao}</div>
        <div className="text-xs text-[#6B6B6B] mt-1">
          {a.notas?.replace("Sugerido automaticamente pela regra: ", "📐 regra: ")}
          {atrasada && (
            <span className="text-[#BF360C] ml-2">
              · previsto {a.dataPrevista}
            </span>
          )}
        </div>
      </div>
      <AcaoActions acaoId={a.acaoId} />
    </div>
  );
}
