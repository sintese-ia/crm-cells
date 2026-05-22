import { db } from "@/db";
import { conta, CANAIS, FUNIL_STAGES, TEMPERATURAS, RESPONSAVEIS } from "@/db/schema";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_LABEL, FUNIL_COLOR, TEMP_COLOR, CANAL_LABEL } from "@/lib/labels";
import { ContasFiltros } from "./_components/filtros";

export const dynamic = "force-dynamic";

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string;
    canal?: string;
    funil?: string;
    resp?: string;
    temp?: string;
    uf?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = [];
  if (sp.busca)
    filters.push(
      or(
        ilike(conta.nome, `%${sp.busca}%`),
        ilike(conta.razaoSocial, `%${sp.busca}%`),
        ilike(conta.cnpj, `%${sp.busca}%`),
        ilike(conta.cidade, `%${sp.busca}%`)
      )!
    );
  if (sp.canal) filters.push(eq(conta.canal, sp.canal));
  if (sp.funil) filters.push(eq(conta.funilStage, sp.funil));
  if (sp.resp) filters.push(eq(conta.responsavel, sp.resp));
  if (sp.temp) filters.push(eq(conta.temperatura, sp.temp));
  if (sp.uf) filters.push(eq(conta.uf, sp.uf.toUpperCase()));

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(conta)
    .where(where)
    .orderBy(desc(conta.updatedAt))
    .limit(500);

  const totalRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conta)
    .where(where);
  const total = totalRow[0]?.n ?? 0;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contas</h1>
          <p className="text-sm text-zinc-500">
            {total} {total === 1 ? "conta" : "contas"} — clique pra abrir
          </p>
        </div>
        <Link
          href="/contas/nova"
          className="bg-zinc-900 text-white text-sm px-4 py-2 rounded-md hover:bg-zinc-800"
        >
          + Nova conta
        </Link>
      </div>

      <ContasFiltros
        canais={CANAIS as readonly string[]}
        funilStages={FUNIL_STAGES as readonly string[]}
        temperaturas={TEMPERATURAS as readonly string[]}
        responsaveis={RESPONSAVEIS as readonly string[]}
      />

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b text-xs uppercase text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Canal</th>
              <th className="text-left px-4 py-3">Cidade/UF</th>
              <th className="text-left px-4 py-3">Funil</th>
              <th className="text-left px-4 py-3">Temp</th>
              <th className="text-left px-4 py-3">Resp.</th>
              <th className="text-left px-4 py-3">CNPJ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.contaId} className="border-b hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/contas/${c.contaId}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {c.nome}
                  </Link>
                  {c.razaoSocial && c.razaoSocial !== c.nome && (
                    <div className="text-xs text-zinc-400">{c.razaoSocial}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {CANAL_LABEL[c.canal] || c.canal}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {c.cidade ? `${c.cidade}/${c.uf || "?"}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-white text-xs px-2 py-0.5 rounded ${
                      FUNIL_COLOR[c.funilStage] || "bg-zinc-400"
                    }`}
                  >
                    {FUNIL_LABEL[c.funilStage] || c.funilStage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      TEMP_COLOR[c.temperatura] || "bg-zinc-400"
                    }`}
                    title={c.temperatura}
                  />
                  <span className="ml-2 text-xs text-zinc-500">
                    {c.temperatura}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 capitalize">
                  {c.responsavel}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">
                  {c.cnpj || "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  Nenhuma conta encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
