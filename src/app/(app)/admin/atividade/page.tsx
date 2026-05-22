import { db } from "@/db";
import { auditoria, conta } from "@/db/schema";
import { desc, eq, and, sql, gte, count } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AtividadePage({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; acao?: string }>;
}) {
  const sp = await searchParams;
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Stats últimos 7 dias por pessoa
  const statsPessoa = await db
    .select({
      usuario: auditoria.usuarioNome,
      email: auditoria.usuarioEmail,
      alteracoes: count(),
      contasUnicas: sql<number>`count(distinct ${auditoria.contaId})::int`,
    })
    .from(auditoria)
    .where(gte(auditoria.createdAt, seteDias))
    .groupBy(auditoria.usuarioNome, auditoria.usuarioEmail)
    .orderBy(desc(count()));

  // Lista de eventos recentes
  const filters = [gte(auditoria.createdAt, seteDias)];
  if (sp.pessoa) filters.push(eq(auditoria.usuarioId, sp.pessoa));
  if (sp.acao) filters.push(eq(auditoria.acao, sp.acao));

  const eventos = await db
    .select({
      auditoriaId: auditoria.auditoriaId,
      usuarioNome: auditoria.usuarioNome,
      usuarioEmail: auditoria.usuarioEmail,
      acao: auditoria.acao,
      campo: auditoria.campo,
      valorAntes: auditoria.valorAntes,
      valorDepois: auditoria.valorDepois,
      createdAt: auditoria.createdAt,
      contaId: auditoria.contaId,
      contaNome: conta.nome,
    })
    .from(auditoria)
    .innerJoin(conta, eq(auditoria.contaId, conta.contaId))
    .where(and(...filters))
    .orderBy(desc(auditoria.createdAt))
    .limit(200);

  // Tipos de ação únicos
  const acoesDistinct = await db
    .selectDistinct({ acao: auditoria.acao })
    .from(auditoria)
    .where(gte(auditoria.createdAt, seteDias));

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Atividade da equipe</h1>
        <p className="text-sm text-[#6B6B6B]">Últimos 7 dias · alterações feitas em contas</p>
      </div>

      <section className="bg-white border border-[#E5E2DC] rounded-lg p-6 mb-6">
        <h2 className="font-bold mb-3 text-sm">Por pessoa</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-[#6B6B6B]">
            <tr className="border-b border-[#E5E2DC]">
              <th className="text-left pb-2">Pessoa</th>
              <th className="text-right pb-2">Alterações</th>
              <th className="text-right pb-2">Contas distintas</th>
            </tr>
          </thead>
          <tbody>
            {statsPessoa.map((s) => (
              <tr key={s.email} className="border-b border-[#F2F0EC] last:border-0">
                <td className="py-2">
                  <strong>{s.usuario}</strong>{" "}
                  <span className="text-xs text-[#6B6B6B]">{s.email}</span>
                </td>
                <td className="py-2 text-right font-mono">{s.alteracoes}</td>
                <td className="py-2 text-right font-mono">{s.contasUnicas}</td>
              </tr>
            ))}
            {statsPessoa.length === 0 && (
              <tr><td colSpan={3} className="text-center py-4 text-[#6B6B6B]">Sem atividade nos últimos 7 dias</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="bg-white border border-[#E5E2DC] rounded-lg p-4 mb-3 flex gap-2 flex-wrap items-center">
        <span className="text-xs text-[#6B6B6B] uppercase">Filtros:</span>
        <Link href="/admin/atividade" className={`text-xs px-2 py-1 rounded border ${!sp.pessoa && !sp.acao ? "bg-[#0D0D0D] text-white" : "bg-white"}`}>Todos</Link>
        {statsPessoa.map((s) => {
          const id = s.email.split("@")[0];
          return (
            <Link key={id} href={`/admin/atividade?pessoa=${id}`} className={`text-xs px-2 py-1 rounded border ${sp.pessoa === id ? "bg-[#0D0D0D] text-white" : "bg-white"}`}>
              {s.usuario}
            </Link>
          );
        })}
        <span className="mx-2 text-[#6B6B6B]">|</span>
        {acoesDistinct.map((a) => (
          <Link key={a.acao} href={`/admin/atividade?acao=${a.acao}`} className={`text-xs px-2 py-1 rounded border ${sp.acao === a.acao ? "bg-[#0D0D0D] text-white" : "bg-white"}`}>
            {a.acao}
          </Link>
        ))}
      </div>

      <section className="bg-white border border-[#E5E2DC] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F0EC] text-xs uppercase tracking-wider text-[#6B6B6B]">
            <tr>
              <th className="text-left px-4 py-2">Quando</th>
              <th className="text-left px-4 py-2">Quem</th>
              <th className="text-left px-4 py-2">O quê</th>
              <th className="text-left px-4 py-2">Conta</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.auditoriaId} className="border-t border-[#E5E2DC] hover:bg-[#FAFAF8]">
                <td className="px-4 py-2 text-xs text-[#6B6B6B] font-mono whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{e.usuarioNome}</td>
                <td className="px-4 py-2 text-xs">
                  <span className="font-mono bg-[#F2F0EC] px-1.5 py-0.5 rounded">{e.acao}</span>
                  {e.valorAntes !== null && e.valorDepois !== null && (
                    <span className="ml-2">
                      <span className="text-[#6B6B6B] line-through">{e.valorAntes || "—"}</span>
                      <span className="mx-1">→</span>
                      <strong>{e.valorDepois || "—"}</strong>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/contas/${e.contaId}`} className="text-[#D4541A] hover:underline">{e.contaNome}</Link>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-[#6B6B6B]">Sem eventos</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
