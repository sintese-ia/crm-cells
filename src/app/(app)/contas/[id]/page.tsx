import { db } from "@/db";
import { conta, contato, interacao, acao, situacao, auditoria } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FUNIL_LABEL, FUNIL_COLOR, TEMP_COLOR, CANAL_LABEL } from "@/lib/labels";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditarConta } from "./_components/editar-conta";
import { NovaInteracao } from "./_components/nova-interacao";
import { ProximaAcao } from "./_components/proxima-acao";
import { JornadaCard } from "./_components/jornada";
import { calcularJornada } from "@/lib/jornada";

export const dynamic = "force-dynamic";

export default async function ContaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contaId = Number(id);
  if (!Number.isInteger(contaId)) notFound();

  const [c] = await db.select().from(conta).where(eq(conta.contaId, contaId));
  if (!c) notFound();

  const contatos = await db.select().from(contato).where(eq(contato.contaId, contaId)).orderBy(desc(contato.ePrincipal), desc(contato.updatedAt));
  const interacoes = await db.select().from(interacao).where(eq(interacao.contaId, contaId)).orderBy(desc(interacao.ocorridoEm)).limit(50);
  const acoesPendentes = await db
    .select()
    .from(acao)
    .where(and(eq(acao.contaId, contaId), eq(acao.status, "pendente")))
    .orderBy(asc(acao.dataPrevista));
  const proximaAcao = acoesPendentes[0];
  const situacoes = await db.select().from(situacao).where(eq(situacao.ativa, true)).orderBy(asc(situacao.estagio), asc(situacao.ordem));
  const audits = await db.select().from(auditoria).where(eq(auditoria.contaId, contaId)).orderBy(desc(auditoria.createdAt)).limit(50);

  // mapa situacaoId → label pra mostrar nas interações
  const sitMap = Object.fromEntries(situacoes.map((s) => [s.situacaoId, s]));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/contas" className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#0D0D0D] mb-4">
        <ArrowLeft className="w-4 h-4" /> voltar pras contas
      </Link>

      <header className="bg-white border border-[#E5E2DC] rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              {c.nome}
            </h1>
            {c.razaoSocial && c.razaoSocial !== c.nome && (
              <div className="text-sm text-[#6B6B6B]">{c.razaoSocial}</div>
            )}
            <div className="text-xs text-[#6B6B6B] font-mono mt-1">
              {c.cnpj || "sem CNPJ"} · ID {c.contaId}
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <span className={`text-white text-xs px-3 py-1 rounded font-medium ${FUNIL_COLOR[c.funilStage] || "bg-zinc-400"}`}>
              {FUNIL_LABEL[c.funilStage] || c.funilStage}
            </span>
            <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border border-[#E5E2DC]">
              <span className={`w-2 h-2 rounded-full ${TEMP_COLOR[c.temperatura] || "bg-zinc-400"}`} />
              {c.temperatura}
            </span>
          </div>
        </div>

        <JornadaCard
          etapas={calcularJornada(c, interacoes, proximaAcao)}
          contaId={contaId}
          contatos={contatos}
          situacoes={situacoes}
        />

        {proximaAcao && <ProximaAcao acao={proximaAcao} />}

        <div className="mt-4">
          <EditarConta conta={c} />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
                Timeline de interações
              </h2>
              <NovaInteracao contaId={contaId} contatos={contatos} situacoes={situacoes} />
            </div>
            {interacoes.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">Nenhuma interação registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {interacoes.map((i) => {
                  const sit = i.situacaoId ? sitMap[i.situacaoId] : null;
                  return (
                    <div key={i.interacaoId} className="border-l-2 border-[#E5E2DC] pl-4 py-1">
                      <div className="flex items-center gap-2 text-xs text-[#6B6B6B] mb-1 flex-wrap">
                        <span className="font-medium uppercase">{i.tipo}</span>
                        {sit && (
                          <span className="bg-[#F2F0EC] px-2 py-0.5 rounded text-[#0D0D0D]">
                            {sit.icon} {sit.label}
                            {i.tentativaNum && i.tentativaNum > 1 && (
                              <span className="ml-1 text-[#D4541A]">· {i.tentativaNum}ª vez</span>
                            )}
                          </span>
                        )}
                        <span>·</span>
                        <span>{i.autor}</span>
                        <span>·</span>
                        <span>
                          {new Date(i.ocorridoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      {i.texto && <div className="text-sm whitespace-pre-wrap">{i.texto}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {audits.length > 0 && (
            <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
              <h2 className="font-bold mb-4" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
                Histórico de alterações
              </h2>
              <div className="space-y-2 text-xs">
                {audits.map((a) => (
                  <div key={a.auditoriaId} className="flex gap-3 py-1 border-b border-[#F2F0EC] last:border-0">
                    <span className="text-[#6B6B6B] font-mono whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className="font-medium text-[#0D0D0D]">{a.usuarioNome}</span>
                    <span className="text-[#6B6B6B]">
                      {a.acao.replace("mudou_", "alterou ").replace("auto_mudou_", "sistema alterou ")}
                      {a.valorAntes !== null && a.valorDepois !== null && (
                        <span className="ml-1">
                          : <span className="line-through">{a.valorAntes || "—"}</span> → <strong>{a.valorDepois || "—"}</strong>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
            <h2 className="font-bold mb-3 text-sm">Contatos</h2>
            {contatos.length === 0 ? (
              <p className="text-xs text-[#6B6B6B]">Sem contatos cadastrados</p>
            ) : (
              <ul className="space-y-3">
                {contatos.map((p) => (
                  <li key={p.contatoId} className="text-sm">
                    <div className="font-medium flex items-center gap-1.5">
                      {p.nome}
                      {p.ePrincipal && (
                        <span className="text-xs bg-[#FFB300]/20 text-[#BF360C] px-1.5 rounded">principal</span>
                      )}
                    </div>
                    {p.cargo && <div className="text-xs text-[#6B6B6B]">{p.cargo}</div>}
                    {p.telefone && <div className="text-xs text-[#0D0D0D]">{p.telefone}</div>}
                    {p.email && <div className="text-xs text-[#0D0D0D]">{p.email}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
            <h2 className="font-bold mb-3 text-sm">Dados institucionais</h2>
            <dl className="text-xs space-y-2">
              <div><dt className="text-[#6B6B6B]">Canal</dt><dd>{CANAL_LABEL[c.canal] || c.canal}</dd></div>
              <div><dt className="text-[#6B6B6B]">Cidade/UF</dt><dd>{c.cidade ? `${c.cidade}/${c.uf || "?"}` : "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Email</dt><dd>{c.emailInstitucional || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Telefone</dt><dd>{c.telefoneInstitucional || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Site</dt><dd>{c.site || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Origem</dt><dd>{c.origemLead}</dd></div>
              <div><dt className="text-[#6B6B6B]">Responsável</dt><dd className="capitalize">{c.responsavel}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
