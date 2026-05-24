import { db } from "@/db";
import { conta, interacao, CANAIS, FUNIL_STAGES, TEMPERATURAS, RESPONSAVEIS } from "@/db/schema";
import { and, eq, ilike, or, sql, desc, isNull, inArray } from "drizzle-orm";
import Link from "next/link";
import { FUNIL_LABEL, FUNIL_COLOR, CANAL_LABEL } from "@/lib/labels";
import { ContasFiltros } from "./_components/filtros";
import { QuickActions } from "@/components/quick-actions";
import { PrioBadge } from "@/components/prio-badge";
import { HomologacaoBadge } from "@/components/homologacao-badge";

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
    ordem?: string;
    incluirFilhas?: string;
    prio?: string;
    homologacao?: string;
  }>;
}) {
  const sp = await searchParams;
  const incluirFilhas = sp.incluirFilhas === "true";
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
  if (sp.resp === "__sem__") filters.push(isNull(conta.responsavel));
  else if (sp.resp) filters.push(eq(conta.responsavel, sp.resp));
  if (sp.temp) filters.push(eq(conta.temperatura, sp.temp));
  if (sp.uf) filters.push(eq(conta.uf, sp.uf.toUpperCase()));
  if (sp.prio) filters.push(sql`coalesce(${conta.prioridadeManual}, ${conta.prioridadeCalc}) = ${sp.prio}`);
  if (sp.homologacao === "pendente")
    filters.push(sql`${conta.requerHomologacao} = true AND ${conta.statusHomologacao} IN ('pendente_inicio','docs_enviados','em_analise')`);
  else if (sp.homologacao === "aprovada")
    filters.push(sql`${conta.requerHomologacao} = true AND ${conta.statusHomologacao} = 'aprovada'`);
  else if (sp.homologacao === "reprovada")
    filters.push(sql`${conta.requerHomologacao} = true AND ${conta.statusHomologacao} = 'reprovada'`);
  else if (sp.homologacao === "nao_aplica")
    filters.push(eq(conta.requerHomologacao, false));
  // Default: esconde filhas (mostra matrizes + contas independentes)
  // Exceção: filha aparece se já foi tocada (interação ou funil avançado)
  if (!incluirFilhas) {
    filters.push(
      sql`(${conta.contaMatrizId} IS NULL OR ${conta.funilStage} != 'base_fria' OR EXISTS (SELECT 1 FROM b2b.interacao i WHERE i.conta_id = ${conta.contaId}))`
    );
  }

  const where = filters.length ? and(...filters) : undefined;
  const ordemAtual = sp.ordem || "recente";

  // Query principal: contas + última interação + n filhas (se matriz)
  const rows = await db.execute(sql`
    SELECT c.*,
           (SELECT max(i.ocorrido_em) FROM b2b.interacao i WHERE i.conta_id = c.conta_id) AS ultima_interacao_em,
           (SELECT i.texto FROM b2b.interacao i WHERE i.conta_id = c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_interacao_texto,
           (SELECT i.situacao_id FROM b2b.interacao i WHERE i.conta_id = c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_situacao,
           (SELECT count(*)::int FROM b2b.interacao i WHERE i.conta_id = c.conta_id) AS total_interacoes,
           (SELECT count(*)::int FROM b2b.conta f WHERE f.conta_matriz_id = c.conta_id) AS n_filhas,
           (SELECT count(*)::int FROM b2b.contato ct WHERE ct.conta_id = c.conta_id) AS n_contatos
    FROM b2b.conta c
    ${where ? sql`WHERE ${where}` : sql``}
    ORDER BY ${
      ordemAtual === "aging"
        ? sql`(SELECT max(i.ocorrido_em) FROM b2b.interacao i WHERE i.conta_id = c.conta_id) ASC NULLS FIRST`
        : ordemAtual === "novo"
        ? sql`c.created_at DESC`
        : ordemAtual === "prio"
        ? sql`CASE coalesce(c.prioridade_manual, c.prioridade_calc)
             WHEN 'alta' THEN 0
             WHEN 'media' THEN 1
             WHEN 'baixa' THEN 2
             WHEN 'descartar' THEN 3
             ELSE 4 END ASC, c.updated_at DESC`
        : sql`c.updated_at DESC`
    }
    LIMIT 500
  `);
  const contas = (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]);

  const totalRow = await db.select({ n: sql<number>`count(*)::int` }).from(conta).where(where);
  const total = totalRow[0]?.n ?? 0;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Contas</h1>
          <p className="text-sm text-[#6B6B6B]">{total} {total === 1 ? "conta" : "contas"}</p>
        </div>
        <Link href="/contas/nova" className="bg-[#0D0D0D] text-white text-sm px-3 py-2 rounded-md hover:bg-[#1A1A1A]">+ Nova</Link>
      </div>

      <ContasFiltros
        canais={CANAIS as readonly string[]}
        funilStages={FUNIL_STAGES as readonly string[]}
        temperaturas={TEMPERATURAS as readonly string[]}
        responsaveis={RESPONSAVEIS as readonly string[]}
      />

      {/* Ordenação + toggle filhas */}
      <div className="bg-white border border-[#E5E2DC] rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#6B6B6B] uppercase tracking-wider mr-1">Ordenar:</span>
        {[
          { v: "recente", l: "Recente" },
          { v: "prio", l: "🔥 Prioridade" },
          { v: "aging", l: "Parado há mais tempo ⏳" },
          { v: "novo", l: "Criação" },
        ].map((o) => {
          const url = new URLSearchParams(sp as Record<string,string>);
          url.set("ordem", o.v);
          return (
            <Link
              key={o.v}
              href={`/contas?${url}`}
              className={`text-xs px-2 py-1 rounded border ${
                ordemAtual === o.v ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC]"
              }`}
            >
              {o.l}
            </Link>
          );
        })}
        <span className="text-[#E5E2DC] mx-1">|</span>
        {(() => {
          const url = new URLSearchParams(sp as Record<string,string>);
          if (incluirFilhas) url.delete("incluirFilhas"); else url.set("incluirFilhas", "true");
          return (
            <Link href={`/contas?${url}`} className={`text-xs px-2 py-1 rounded border ${incluirFilhas ? "bg-[#D4541A] text-white border-[#D4541A]" : "bg-white border-[#E5E2DC]"}`}>
              {incluirFilhas ? "🏢 incluindo filhas de rede" : "🏢 ocultando filhas de rede"}
            </Link>
          );
        })()}
      </div>

      {/* Mobile: lista de cards */}
      <div className="lg:hidden space-y-2">
        {contas.map((c) => {
          const row = c as Record<string, unknown> & {
            conta_id: number; nome: string; canal: string; cidade?: string; uf?: string; funil_stage: string; responsavel: string | null;
            telefone_institucional?: string; whatsapp_institucional?: string; conta_matriz_id?: number;
            ultima_interacao_em?: string; ultima_interacao_texto?: string;
            n_filhas?: number; n_contatos?: number;
            tags?: string[];
            requer_homologacao?: boolean; status_homologacao?: string | null;
          };
          const dias = row.ultima_interacao_em ? Math.floor((Date.now() - new Date(row.ultima_interacao_em).getTime()) / (1000 * 60 * 60 * 24)) : null;
          const parado14 = dias !== null && dias > 14;
          const ehMatriz = (row.n_filhas ?? 0) > 0;
          const revisarContato = (row.tags || []).includes("revisar_contato");
          return (
            <div key={row.conta_id} className="bg-white border border-[#E5E2DC] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5 text-xs flex-wrap">
                <PrioBadge manual={(row as unknown as { prioridade_manual?: string }).prioridade_manual} calc={(row as unknown as { prioridade_calc?: string }).prioridade_calc} />
                <span className={`text-white px-2 py-0.5 rounded ${FUNIL_COLOR[row.funil_stage] || "bg-zinc-400"}`}>
                  {FUNIL_LABEL[row.funil_stage] || row.funil_stage}
                </span>
                {ehMatriz && <span className="text-[10px] bg-[#0D0D0D] text-white px-1.5 rounded">🏢 matriz · {row.n_filhas} lojas</span>}
                {row.conta_matriz_id && <span className="text-[10px] text-[#0091EA] uppercase">unidade</span>}
                {revisarContato && <span className="text-[10px] bg-[#FFB300] text-white px-1.5 rounded">⚠️ sem comprador</span>}
                <HomologacaoBadge requer={Boolean(row.requer_homologacao)} status={row.status_homologacao} />
                {parado14 && <span className="text-[#BF360C] text-[10px] font-bold">⚠️ {dias}d</span>}
              </div>
              <Link href={`/contas/${row.conta_id}`} className="font-semibold text-[#0D0D0D] hover:underline block">{row.nome}</Link>
              <div className="text-xs text-[#6B6B6B] mb-2">
                {CANAL_LABEL[row.canal] || row.canal}{row.cidade && ` · ${row.cidade}/${row.uf}`} · resp: {row.responsavel || "—"}
              </div>
              <QuickActions telefone={row.telefone_institucional} whatsapp={row.whatsapp_institucional} />
            </div>
          );
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden lg:block bg-white rounded-lg border border-[#E5E2DC] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F0EC] border-b border-[#E5E2DC] text-xs uppercase text-[#6B6B6B]">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Canal</th>
              <th className="text-left px-4 py-3">Cidade/UF</th>
              <th className="text-left px-4 py-3">Funil</th>
              <th className="text-left px-4 py-3">Resp.</th>
              <th className="text-left px-4 py-3">Última interação</th>
              <th className="text-left px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => {
              const row = c as Record<string, unknown> & {
                conta_id: number; nome: string; razao_social?: string; canal: string; cidade?: string; uf?: string; funil_stage: string; responsavel: string | null;
                telefone_institucional?: string; whatsapp_institucional?: string; cnpj?: string; conta_matriz_id?: number;
                ultima_interacao_em?: string; ultima_interacao_texto?: string; ultima_situacao?: string; total_interacoes?: number;
                n_filhas?: number; n_contatos?: number; tags?: string[];
                requer_homologacao?: boolean; status_homologacao?: string | null;
              };
              const dias = row.ultima_interacao_em ? Math.floor((Date.now() - new Date(row.ultima_interacao_em).getTime()) / (1000 * 60 * 60 * 24)) : null;
              const semInteracao = !row.ultima_interacao_em;
              const parado14 = dias !== null && dias > 14;
              const ehMatriz = (row.n_filhas ?? 0) > 0;
              const revisarContato = (row.tags || []).includes("revisar_contato");
              return (
                <tr key={row.conta_id} className="border-b border-[#E5E2DC] hover:bg-[#FAFAF8]">
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <PrioBadge manual={(row as unknown as { prioridade_manual?: string }).prioridade_manual} calc={(row as unknown as { prioridade_calc?: string }).prioridade_calc} />
                      <Link href={`/contas/${row.conta_id}`} className="font-medium text-[#0D0D0D] hover:underline">
                        {row.nome}
                      </Link>
                    </div>
                    {ehMatriz && (
                      <span className="text-[10px] bg-[#0D0D0D] text-white px-1.5 py-0.5 rounded">🏢 {row.n_filhas} lojas</span>
                    )}
                    {row.conta_matriz_id && (
                      <span className="ml-2 text-[10px] text-[#0091EA] uppercase">unidade</span>
                    )}
                    {revisarContato && (
                      <span className="ml-2 text-[10px] bg-[#FFB300] text-white px-1.5 py-0.5 rounded">⚠️ s/ comprador</span>
                    )}
                    <span className="ml-2">
                      <HomologacaoBadge requer={Boolean(row.requer_homologacao)} status={row.status_homologacao} size="md" />
                    </span>
                    {row.razao_social && row.razao_social !== row.nome && (
                      <div className="text-xs text-[#6B6B6B] truncate">{row.razao_social}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#6B6B6B]">{CANAL_LABEL[row.canal] || row.canal}</td>
                  <td className="px-4 py-3 text-[#6B6B6B]">{row.cidade ? `${row.cidade}/${row.uf || "?"}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-white text-xs px-2 py-0.5 rounded ${FUNIL_COLOR[row.funil_stage] || "bg-zinc-400"}`}>
                      {FUNIL_LABEL[row.funil_stage] || row.funil_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">{row.responsavel || <span className="text-[#6B6B6B]">—</span>}</td>
                  <td className="px-4 py-3 text-xs">
                    {semInteracao ? (
                      <span className="text-[#6B6B6B]">— nunca tocado</span>
                    ) : (
                      <div>
                        <div className={`font-medium ${parado14 ? "text-[#BF360C]" : "text-[#6B6B6B]"}`}>
                          {dias === 0 ? "hoje" : `há ${dias}d`}
                          {parado14 && <span className="ml-1">⚠️</span>}
                        </div>
                        {row.ultima_interacao_texto && (
                          <div className="text-[10px] text-[#6B6B6B] truncate max-w-[200px]">
                            {row.ultima_interacao_texto.slice(0, 50)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <QuickActions
                      telefone={row.telefone_institucional}
                      whatsapp={row.whatsapp_institucional}
                    />
                  </td>
                </tr>
              );
            })}
            {contas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-[#6B6B6B]">Nenhuma conta encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
