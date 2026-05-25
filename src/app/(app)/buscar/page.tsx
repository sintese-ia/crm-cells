import { db } from "@/db";
import { sql } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_LABEL, FUNIL_COLOR } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Resultado = {
  conta_id: number;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  responsavel: string | null;
  funil_stage: string;
  n_filhas: number;
  comprador: string | null;
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";

  let resultados: Resultado[] = [];
  if (q.length >= 2) {
    const like = `%${q}%`;
    const r = await db.execute(sql`
      SELECT c.conta_id, c.nome, c.razao_social, c.cnpj, c.cidade, c.uf,
             COALESCE(c.responsavel, '—') AS responsavel, c.funil_stage,
             (SELECT count(*)::int FROM b2b.conta f WHERE f.conta_matriz_id=c.conta_id) AS n_filhas,
             (SELECT ct.nome FROM b2b.contato ct WHERE ct.conta_id=c.conta_id ORDER BY ct.e_principal DESC LIMIT 1) AS comprador
      FROM b2b.conta c
      WHERE c.nome ILIKE ${like}
         OR c.razao_social ILIKE ${like}
         OR c.cnpj ILIKE ${like}
         OR c.cidade ILIKE ${like}
         OR EXISTS (SELECT 1 FROM b2b.contato ct WHERE ct.conta_id=c.conta_id AND ct.nome ILIKE ${like})
      ORDER BY
        CASE WHEN upper(c.nome) = upper(${q}) THEN 0
             WHEN c.nome ILIKE ${q + '%'} THEN 1
             ELSE 2 END,
        c.nome
      LIMIT 50
    `);
    resultados = ((r as unknown as { rows?: Resultado[] }).rows ?? (r as unknown as Resultado[])) as Resultado[];
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
        Buscar
      </h1>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Nome, razão social, CNPJ, cidade ou comprador…"
          className="w-full text-lg px-4 py-3 border-2 border-[#E5E2DC] rounded-lg focus:border-[#0D0D0D] focus:outline-none"
        />
        <p className="text-xs text-[#6B6B6B] mt-1.5">
          Mínimo 2 caracteres · pressione Enter pra buscar
        </p>
      </form>

      {q.length >= 2 && (
        <p className="text-sm text-[#6B6B6B] mb-3">
          {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} para <strong>{q}</strong>
        </p>
      )}

      <div className="space-y-2">
        {resultados.map((r) => (
          <Link
            key={r.conta_id}
            href={`/contas/${r.conta_id}`}
            className="block bg-white border border-[#E5E2DC] rounded-lg p-4 hover:bg-[#F8F6F2] transition"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-semibold text-[#0D0D0D]">{r.nome}</div>
              <span className={`text-white text-[10px] px-2 py-0.5 rounded ${FUNIL_COLOR[r.funil_stage] || "bg-zinc-400"}`}>
                {FUNIL_LABEL[r.funil_stage] || r.funil_stage}
              </span>
            </div>
            <div className="text-xs text-[#6B6B6B] flex flex-wrap gap-x-3 gap-y-0.5">
              {r.cnpj && <span>📄 {r.cnpj}</span>}
              {r.cidade && <span>📍 {r.cidade}/{r.uf}</span>}
              {r.comprador && <span>👤 {r.comprador}</span>}
              <span>· resp: {r.responsavel}</span>
              {r.n_filhas > 0 && <span>· 🏢 {r.n_filhas} lojas</span>}
            </div>
            {r.razao_social && r.razao_social !== r.nome && (
              <div className="text-xs text-[#6B6B6B] mt-0.5 italic truncate">{r.razao_social}</div>
            )}
          </Link>
        ))}
        {q.length >= 2 && resultados.length === 0 && (
          <div className="text-center py-12 text-[#6B6B6B]">
            <p>Nenhuma conta encontrada.</p>
          </div>
        )}
        {q.length < 2 && (
          <div className="text-center py-12 text-[#6B6B6B] text-sm">
            <p>Digite 2 ou mais caracteres pra começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
