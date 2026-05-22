import { db } from "@/db";
import { contato, conta } from "@/db/schema";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import Link from "next/link";
import { QuickActions } from "@/components/quick-actions";
import { FUNIL_COLOR, FUNIL_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CompradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; resp?: string; principais?: string }>;
}) {
  const sp = await searchParams;
  const filters = [];
  if (sp.busca)
    filters.push(
      or(
        ilike(contato.nome, `%${sp.busca}%`),
        ilike(contato.cargo, `%${sp.busca}%`),
        ilike(conta.nome, `%${sp.busca}%`)
      )!
    );
  if (sp.resp) filters.push(eq(conta.responsavel, sp.resp));
  if (sp.principais === "true") filters.push(eq(contato.ePrincipal, true));

  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const lista = await db.execute(sql`
    SELECT ct.contato_id, ct.nome AS contato_nome, ct.cargo, ct.email, ct.telefone, ct.whatsapp,
           ct.e_principal, ct.papel, ct.relevancia,
           c.conta_id, c.nome AS conta_nome, c.cidade, c.uf, c.canal, c.funil_stage, c.responsavel
    FROM b2b.contato ct
    JOIN b2b.conta c ON c.conta_id = ct.conta_id
    ${where}
    ORDER BY ct.e_principal DESC, ct.updated_at DESC
    LIMIT 500
  `);
  const rows = (lista as unknown as { rows?: Record<string, unknown>[] }).rows ?? (lista as unknown as Record<string, unknown>[]);

  const totalRow = await db.execute(sql`SELECT count(*)::int as n FROM b2b.contato ct JOIN b2b.conta c ON c.conta_id = ct.conta_id ${where}`);
  const totalRowVal = (totalRow as unknown as { rows?: Record<string, unknown>[] }).rows ?? totalRow;
  const total = (totalRowVal[0]?.n as number) ?? 0;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Compradores</h1>
        <p className="text-sm text-[#6B6B6B]">{total} pessoas cadastradas</p>
      </div>

      <div className="bg-white border border-[#E5E2DC] rounded-lg p-4 mb-4 space-y-3">
        <input
          type="search"
          name="busca"
          defaultValue={sp.busca || ""}
          placeholder="Buscar por nome do comprador, cargo ou empresa…"
          className="w-full px-3 py-2 border border-[#E5E2DC] rounded text-sm"
          // form submit: GET com query param
          onKeyDown={undefined}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#6B6B6B] uppercase tracking-wider">Filtros:</span>
          <Link href="/compradores" className={`px-2 py-1 rounded border ${!sp.principais && !sp.resp ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "border-[#E5E2DC]"}`}>Todos</Link>
          <Link href="/compradores?principais=true" className={`px-2 py-1 rounded border ${sp.principais === "true" ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "border-[#E5E2DC]"}`}>⭐ Principais</Link>
          {["gabriel","yasmin","gabi"].map((r) => (
            <Link key={r} href={`/compradores?resp=${r}`} className={`px-2 py-1 rounded border capitalize ${sp.resp === r ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "border-[#E5E2DC]"}`}>
              {r}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-2">
        {rows.map((r) => {
          const row = r as Record<string, unknown> & {
            contato_id: number; contato_nome: string; cargo?: string; email?: string; telefone?: string; whatsapp?: string;
            e_principal: boolean; conta_id: number; conta_nome: string; cidade?: string; uf?: string; funil_stage: string; responsavel: string;
          };
          return (
            <div key={row.contato_id} className="bg-white border border-[#E5E2DC] rounded-lg p-3">
              <div className="font-semibold flex items-center gap-1.5">
                {row.contato_nome}
                {row.e_principal && <span className="text-[10px] bg-[#FFB300]/20 text-[#BF360C] px-1.5 rounded">⭐</span>}
              </div>
              {row.cargo && <div className="text-xs text-[#6B6B6B]">{row.cargo}</div>}
              <Link href={`/contas/${row.conta_id}`} className="text-xs text-[#D4541A] hover:underline block mt-1 truncate">
                {row.conta_nome}
              </Link>
              <div className="text-xs text-[#6B6B6B]">{row.cidade ? `${row.cidade}/${row.uf}` : "—"} · resp: {row.responsavel}</div>
              <div className="mt-2"><QuickActions telefone={row.telefone} whatsapp={row.whatsapp} email={row.email} /></div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden lg:block bg-white rounded-lg border border-[#E5E2DC] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F0EC] border-b border-[#E5E2DC] text-xs uppercase text-[#6B6B6B]">
            <tr>
              <th className="text-left px-4 py-3">Comprador</th>
              <th className="text-left px-4 py-3">Empresa</th>
              <th className="text-left px-4 py-3">Cidade/UF</th>
              <th className="text-left px-4 py-3">Funil</th>
              <th className="text-left px-4 py-3">Resp.</th>
              <th className="text-left px-4 py-3">Contato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const row = r as Record<string, unknown> & {
                contato_id: number; contato_nome: string; cargo?: string; email?: string; telefone?: string; whatsapp?: string;
                e_principal: boolean; papel: string; relevancia: string;
                conta_id: number; conta_nome: string; cidade?: string; uf?: string; canal: string; funil_stage: string; responsavel: string;
              };
              return (
                <tr key={row.contato_id} className="border-b border-[#E5E2DC] hover:bg-[#FAFAF8]">
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1.5">
                      {row.contato_nome}
                      {row.e_principal && <span className="text-[10px] bg-[#FFB300]/20 text-[#BF360C] px-1.5 rounded">⭐ principal</span>}
                    </div>
                    {row.cargo && <div className="text-xs text-[#6B6B6B]">{row.cargo}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <Link href={`/contas/${row.conta_id}`} className="font-medium text-[#0D0D0D] hover:underline truncate block">
                      {row.conta_nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#6B6B6B] text-xs">{row.cidade ? `${row.cidade}/${row.uf || "?"}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-white text-[10px] px-2 py-0.5 rounded ${FUNIL_COLOR[row.funil_stage] || "bg-zinc-400"}`}>
                      {FUNIL_LABEL[row.funil_stage] || row.funil_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{row.responsavel}</td>
                  <td className="px-4 py-3">
                    <QuickActions telefone={row.telefone} whatsapp={row.whatsapp} email={row.email} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-[#6B6B6B]">Nenhum comprador encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
