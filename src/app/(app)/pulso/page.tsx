import { db } from "@/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function rows<T extends Row = Row>(r: unknown): T[] {
  return ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
}

export default async function PulsoPage() {
  // 1. Calls hoje por pessoa
  const callsHoje = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT autor AS pessoa, count(*)::int n
      FROM b2b.interacao
      WHERE tipo = 'ligacao' AND ocorrido_em::date = CURRENT_DATE
      GROUP BY autor ORDER BY n DESC
    `)
  );

  // 2. Contas que avançaram no funil esta semana (auditoria de mudança de funil_stage)
  const avancaram = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT c.responsavel AS pessoa, count(DISTINCT a.conta_id)::int n
      FROM b2b.auditoria_conta a
      JOIN b2b.conta c ON c.conta_id = a.conta_id
      WHERE a.acao IN ('mudou_funilStage', 'auto_mudou_funilStage')
        AND a.created_at >= date_trunc('week', NOW())
      GROUP BY c.responsavel ORDER BY n DESC
    `)
  );

  // 3. ⚠️ Quentes em risco (funil quente, última interação > 15d, com responsável)
  const emRisco = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT c.responsavel AS pessoa, count(*)::int n
      FROM b2b.conta c
      WHERE c.responsavel IS NOT NULL
        AND c.funil_stage IN ('reuniao','em_negociacao','pedido_realizado','positivada')
        AND (SELECT max(i.ocorrido_em) FROM b2b.interacao i WHERE i.conta_id=c.conta_id) < (NOW() - INTERVAL '15 days')
      GROUP BY c.responsavel ORDER BY n DESC
    `)
  );
  const totalRisco = emRisco.reduce((a, x) => a + x.n, 0);

  // 4. Reuniões marcadas (próximos 7d) — situação rm_marcada/rm_confirmada
  const reuniaoes = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT c.responsavel AS pessoa, count(*)::int n
      FROM b2b.acao a
      JOIN b2b.conta c ON c.conta_id = a.conta_id
      WHERE a.status = 'pendente'
        AND a.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND (a.descricao ILIKE '%reuni%' OR a.tipo = 'reuniao' OR a.descricao ILIKE '%confirmar%')
      GROUP BY c.responsavel ORDER BY n DESC
    `)
  );
  const totalReu = reuniaoes.reduce((a, x) => a + x.n, 0);

  // 5. Fechamentos do mês (interação ca_fechou ou ca_primeira_compra desde início do mês)
  const fechamentos = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT i.autor AS pessoa, count(DISTINCT i.conta_id)::int n
      FROM b2b.interacao i
      WHERE i.situacao_id IN ('ca_fechou','ca_primeira_compra')
        AND i.ocorrido_em >= date_trunc('month', NOW())
      GROUP BY i.autor ORDER BY n DESC
    `)
  );
  const totalFechou = fechamentos.reduce((a, x) => a + x.n, 0);

  // 6. 📦 Amostras aguardando feedback — contas com FUP travado por amostra
  const amostras = rows<{ pessoa: string; n: number }>(
    await db.execute(sql`
      SELECT c.responsavel AS pessoa, count(*)::int n
      FROM b2b.conta c
      WHERE c.fup_travado_ate IS NOT NULL
        AND c.fup_travado_ate >= CURRENT_DATE - INTERVAL '14 days'
        AND c.responsavel IS NOT NULL
      GROUP BY c.responsavel ORDER BY n DESC
    `)
  );
  const totalAmostras = amostras.reduce((a, x) => a + x.n, 0);

  const totalCallsHoje = callsHoje.reduce((a, x) => a + x.n, 0);
  const totalAvancou = avancaram.reduce((a, x) => a + x.n, 0);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
          Pulso
        </h1>
        <p className="text-sm text-[#6B6B6B]">5 números pra saber como a operação está agora.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          icon="📞"
          titulo="Calls hoje"
          numero={totalCallsHoje}
          quebra={callsHoje.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#0091EA]"
        />

        <MetricCard
          icon="📈"
          titulo="Avançaram esta semana"
          numero={totalAvancou}
          quebra={avancaram.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#00897B]"
          subtitulo="contas que mudaram de funil"
        />

        <MetricCard
          icon="⚠️"
          titulo="Quentes em risco"
          numero={totalRisco}
          quebra={emRisco.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#BF360C]"
          subtitulo="quentes sem toque há mais de 15d"
          link={totalRisco > 0 ? "/equipe" : null}
        />

        <MetricCard
          icon="📅"
          titulo="Reuniões marcadas"
          numero={totalReu}
          quebra={reuniaoes.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#D4541A]"
          subtitulo="próximos 7 dias"
        />

        <MetricCard
          icon="🎉"
          titulo="Fechamentos do mês"
          numero={totalFechou}
          quebra={fechamentos.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#00897B]"
          subtitulo="contas que fecharam desde dia 1"
        />

        <MetricCard
          icon="📦"
          titulo="Amostras enviadas"
          numero={totalAmostras}
          quebra={amostras.map((c) => ({ k: c.pessoa, v: c.n }))}
          cor="bg-[#0091EA]"
          subtitulo="aguardando feedback (D+7 trava FUP)"
        />
      </div>

      <div className="mt-8 text-xs text-[#6B6B6B]">
        <p>
          Pulso atualizado em {new Date().toLocaleString("pt-BR")} ·{" "}
          <Link href="/fila" className="underline">voltar pra fila</Link>
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  icon, titulo, numero, quebra, cor, subtitulo, link,
}: {
  icon: string;
  titulo: string;
  numero: number;
  quebra: { k: string; v: number }[];
  cor: string;
  subtitulo?: string;
  link?: string | null;
}) {
  const content = (
    <div className="bg-white border border-[#E5E2DC] rounded-lg overflow-hidden hover:shadow-md transition">
      <div className={`${cor} text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5`}>
        <span>{icon}</span> {titulo}
      </div>
      <div className="p-5">
        <div className="text-4xl font-bold">{numero}</div>
        {subtitulo && <div className="text-xs text-[#6B6B6B] mt-0.5">{subtitulo}</div>}
        {quebra.length > 0 && (
          <div className="mt-3 space-y-1">
            {quebra.map((q) => (
              <div key={q.k} className="flex items-center justify-between text-xs">
                <span className="capitalize text-[#6B6B6B]">{q.k}</span>
                <span className="font-medium">{q.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}
