import { db } from "@/db";
import { sql } from "drizzle-orm";
import Link from "next/link";
import { STATUS_HOMOLOGACAO_LABEL } from "@/db/schema";

export const dynamic = "force-dynamic";

type RedeAgg = {
  rede: string;
  total: number;
  pendente_inicio: number;
  docs_enviados: number;
  em_analise: number;
  aprovada: number;
  reprovada: number;
  contas_sem_resp: number;
  proxima_acao_data: string | null;
  proxima_acao_descricao: string | null;
  proxima_acao_responsavel: string | null;
  proxima_acao_conta_id: number | null;
};

const STATUS_COLOR_BG: Record<string, string> = {
  pendente_inicio: "bg-[#7c3aed] text-white",
  docs_enviados: "bg-[#FFB300] text-[#0D0D0D]",
  em_analise: "bg-[#0091EA] text-white",
  aprovada: "bg-[#00897B] text-white",
  reprovada: "bg-[#BF360C] text-white",
};

export default async function HomologacoesPage() {
  // Agrupar por "rede" extraída das tags (ou nome quando não tem rede)
  const rows = await db.execute(sql`
    WITH conta_rede AS (
      SELECT
        c.conta_id,
        c.nome,
        c.status_homologacao,
        c.responsavel,
        COALESCE(
          (SELECT replace(t, 'rede:', '') FROM unnest(c.tags) t WHERE t LIKE 'rede:%' LIMIT 1),
          c.nome
        ) AS rede
      FROM b2b.conta c
      WHERE c.requer_homologacao = true
    ),
    proxima_por_rede AS (
      SELECT DISTINCT ON (cr.rede)
        cr.rede,
        a.data_prevista,
        a.descricao,
        a.responsavel,
        a.conta_id
      FROM conta_rede cr
      JOIN b2b.acao a ON a.conta_id = cr.conta_id
      WHERE a.status = 'pendente'
      ORDER BY cr.rede, a.data_prevista ASC
    )
    SELECT cr.rede,
           count(*)::int AS total,
           count(*) FILTER (WHERE status_homologacao = 'pendente_inicio')::int AS pendente_inicio,
           count(*) FILTER (WHERE status_homologacao = 'docs_enviados')::int AS docs_enviados,
           count(*) FILTER (WHERE status_homologacao = 'em_analise')::int AS em_analise,
           count(*) FILTER (WHERE status_homologacao = 'aprovada')::int AS aprovada,
           count(*) FILTER (WHERE status_homologacao = 'reprovada')::int AS reprovada,
           count(*) FILTER (WHERE responsavel IS NULL)::int AS contas_sem_resp,
           pr.data_prevista AS proxima_acao_data,
           pr.descricao AS proxima_acao_descricao,
           pr.responsavel AS proxima_acao_responsavel,
           pr.conta_id AS proxima_acao_conta_id
    FROM conta_rede cr
    LEFT JOIN proxima_por_rede pr ON pr.rede = cr.rede
    GROUP BY cr.rede, pr.data_prevista, pr.descricao, pr.responsavel, pr.conta_id
    ORDER BY count(*) DESC, cr.rede
  `);

  const redes = ((rows as unknown as { rows?: RedeAgg[] }).rows ?? (rows as unknown as RedeAgg[])) as RedeAgg[];

  const totalContas = redes.reduce((a, r) => a + r.total, 0);
  const totalPendente = redes.reduce((a, r) => a + r.pendente_inicio + r.docs_enviados + r.em_analise, 0);
  const totalAprovada = redes.reduce((a, r) => a + r.aprovada, 0);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
          🛂 Homologações
        </h1>
        <p className="text-sm text-[#6B6B6B] mt-1">
          Redes que exigem cadastro+homologação como fornecedor antes de faturar.
          Sem homologação, venda travada.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[#E5E2DC] rounded-lg p-4">
          <div className="text-xs text-[#6B6B6B] uppercase tracking-wider">Total contas</div>
          <div className="text-2xl font-bold">{totalContas}</div>
        </div>
        <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/30 rounded-lg p-4">
          <div className="text-xs text-[#7c3aed] uppercase tracking-wider">Pendentes/em curso</div>
          <div className="text-2xl font-bold text-[#7c3aed]">{totalPendente}</div>
        </div>
        <div className="bg-[#00897B]/5 border border-[#00897B]/30 rounded-lg p-4">
          <div className="text-xs text-[#00897B] uppercase tracking-wider">Aprovadas</div>
          <div className="text-2xl font-bold text-[#00897B]">{totalAprovada}</div>
        </div>
        <div className="bg-white border border-[#E5E2DC] rounded-lg p-4">
          <div className="text-xs text-[#6B6B6B] uppercase tracking-wider">Redes</div>
          <div className="text-2xl font-bold">{redes.length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {redes.map((r) => {
          const buckets: Array<{ key: string; n: number }> = [
            { key: "pendente_inicio", n: r.pendente_inicio },
            { key: "docs_enviados", n: r.docs_enviados },
            { key: "em_analise", n: r.em_analise },
            { key: "aprovada", n: r.aprovada },
            { key: "reprovada", n: r.reprovada },
          ].filter((b) => b.n > 0);
          return (
            <div key={r.rede} className="bg-white border border-[#E5E2DC] rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-bold text-lg" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
                    {r.rede}
                  </h2>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    {r.total} conta{r.total > 1 ? "s" : ""}
                    {r.contas_sem_resp > 0 && (
                      <span className="ml-2 text-[#BF360C]">⚠️ {r.contas_sem_resp} sem responsável</span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/contas?busca=${encodeURIComponent(r.rede)}&homologacao=pendente`}
                  className="text-xs text-[#0091EA] hover:underline whitespace-nowrap"
                >
                  ver contas →
                </Link>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {buckets.map((b) => (
                  <span
                    key={b.key}
                    className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR_BG[b.key]}`}
                  >
                    {b.n} {STATUS_HOMOLOGACAO_LABEL[b.key] || b.key}
                  </span>
                ))}
              </div>

              {r.proxima_acao_descricao ? (
                <div className="bg-[#F2F0EC] rounded p-3 text-xs">
                  <div className="text-[#6B6B6B] mb-1">Próxima ação</div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/contas/${r.proxima_acao_conta_id}`}
                        className="font-medium text-[#0D0D0D] hover:underline"
                      >
                        {r.proxima_acao_descricao}
                      </Link>
                      <div className="text-[#6B6B6B] mt-0.5">
                        {r.proxima_acao_data && new Date(r.proxima_acao_data).toLocaleDateString("pt-BR")}
                        {r.proxima_acao_responsavel && (
                          <span className="ml-2 capitalize">· {r.proxima_acao_responsavel}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#BF360C] italic">⚠️ Sem próxima ação agendada</div>
              )}
            </div>
          );
        })}
        {redes.length === 0 && (
          <div className="bg-white border border-dashed border-[#E5E2DC] rounded-lg p-12 text-center text-[#6B6B6B]">
            Nenhuma conta marcada como requerendo homologação.
          </div>
        )}
      </div>
    </div>
  );
}
