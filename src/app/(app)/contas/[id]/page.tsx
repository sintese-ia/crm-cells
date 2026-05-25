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
import { QuickActions } from "@/components/quick-actions";
import { AdicionarContato } from "./_components/adicionar-contato";
import { VincularMatriz } from "./_components/vincular-matriz";
import { VincularFilhas } from "./_components/vincular-filhas";
import { HomologacaoCard } from "./_components/homologacao";

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

  // Se essa conta É matriz, busca filhas
  const filhasMatriz = await db
    .select({
      contaId: conta.contaId,
      nome: conta.nome,
      cidade: conta.cidade,
      uf: conta.uf,
      funilStage: conta.funilStage,
    })
    .from(conta)
    .where(eq(conta.contaMatrizId, contaId))
    .orderBy(asc(conta.cidade));

  // Se essa conta é FILHA, busca matriz
  let contaMatriz: { contaId: number; nome: string } | null = null;
  if (c.contaMatrizId) {
    const [m] = await db
      .select({ contaId: conta.contaId, nome: conta.nome })
      .from(conta)
      .where(eq(conta.contaId, c.contaMatrizId));
    contaMatriz = m ?? null;
  }

  // mapa situacaoId → label pra mostrar nas interações
  const sitMap = Object.fromEntries(situacoes.map((s) => [s.situacaoId, s]));

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
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
          <HomologacaoCard
            contaId={contaId}
            requer={c.requerHomologacao}
            status={c.statusHomologacao}
            iniciadaEm={c.homologacaoIniciadaEm}
            aprovadaEm={c.homologacaoAprovadaEm}
            notas={c.homologacaoNotas}
          />
        </div>

        <div className="mt-4">
          <EditarConta conta={c} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
                Timeline de interações
              </h2>
              <NovaInteracao contaId={contaId} contatos={contatos} situacoes={situacoes} />
            </div>
            {(() => {
              type TimelineItem =
                | { kind: "inter"; data: Date; payload: typeof interacoes[number] }
                | { kind: "acao"; data: Date; payload: typeof acoesPendentes[number] };
              const items: TimelineItem[] = [
                ...interacoes.map<TimelineItem>((i) => ({ kind: "inter", data: new Date(i.ocorridoEm), payload: i })),
                ...acoesPendentes.map<TimelineItem>((a) => ({ kind: "acao", data: new Date(a.dataPrevista + "T12:00"), payload: a })),
              ].sort((a, b) => b.data.getTime() - a.data.getTime());
              const hoje = new Date().toISOString().slice(0, 10);
              if (items.length === 0) {
                return <p className="text-sm text-[#6B6B6B] py-6 text-center">Nenhuma interação registrada ainda.</p>;
              }
              return (
                <div className="space-y-3">
                  {items.map((it) => {
                    if (it.kind === "inter") {
                      const i = it.payload;
                      const sit = i.situacaoId ? sitMap[i.situacaoId] : null;
                      return (
                        <div key={`i${i.interacaoId}`} className="border-l-2 border-[#E5E2DC] pl-4 py-1">
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
                            <span>{new Date(i.ocorridoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                          {i.texto && <div className="text-sm whitespace-pre-wrap">{i.texto}</div>}
                        </div>
                      );
                    }
                    // Ação prevista (pendente)
                    const a = it.payload;
                    const atrasada = a.dataPrevista < hoje;
                    const ehHoje = a.dataPrevista === hoje;
                    const borda = atrasada ? "border-l-2 border-dashed border-[#BF360C] bg-[#FFF7F0]" : ehHoje ? "border-l-2 border-dashed border-[#D4541A] bg-[#FFF7F0]" : "border-l-2 border-dashed border-[#0091EA] bg-[#F0F8FF]";
                    return (
                      <div key={`a${a.acaoId}`} className={`pl-4 py-2 rounded-r ${borda}`}>
                        <div className="flex items-center gap-2 text-xs text-[#6B6B6B] mb-1 flex-wrap">
                          <span className="font-medium uppercase text-[#0091EA]">📅 {atrasada ? "ATRASADA" : ehHoje ? "PREVISTA HOJE" : "PREVISTA"}</span>
                          <span className="bg-white border border-[#E5E2DC] px-2 py-0.5 rounded text-[#0D0D0D]">{a.tipo}</span>
                          <span>·</span>
                          <span>{a.responsavel}</span>
                          <span>·</span>
                          <span className={atrasada ? "text-[#BF360C] font-medium" : ""}>
                            {new Date(a.dataPrevista + "T12:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-sm">{a.descricao}</div>
                        {a.notas && <div className="text-xs text-[#6B6B6B] mt-0.5 italic">{a.notas}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">Contatos</h2>
              <AdicionarContato contaId={contaId} jaTemPrincipal={contatos.some((c) => c.ePrincipal)} />
            </div>
            {contatos.length === 0 ? (
              <p className="text-xs text-[#6B6B6B]">Sem contatos cadastrados</p>
            ) : (
              <ul className="space-y-3">
                {contatos.map((p) => (
                  <li key={p.contatoId} className="text-sm pb-3 border-b border-[#F2F0EC] last:border-0">
                    <div className="font-medium flex items-center gap-1.5">
                      {p.nome}
                      {p.ePrincipal && (
                        <span className="text-xs bg-[#FFB300]/20 text-[#BF360C] px-1.5 rounded">principal</span>
                      )}
                    </div>
                    {p.cargo && <div className="text-xs text-[#6B6B6B]">{p.cargo}</div>}
                    {p.telefone && <div className="text-xs text-[#0D0D0D]">{p.telefone}</div>}
                    {p.email && <div className="text-xs text-[#0D0D0D]">{p.email}</div>}
                    <div className="mt-2">
                      <QuickActions
                        telefone={p.telefone}
                        whatsapp={p.whatsapp}
                        email={p.email}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
            <h2 className="font-bold mb-3 text-sm">Dados institucionais</h2>
            <div className="mb-3">
              <QuickActions
                telefone={c.telefoneInstitucional}
                whatsapp={c.whatsappInstitucional}
                email={c.emailInstitucional}
                site={c.site}
                size="md"
              />
            </div>
            <dl className="text-xs space-y-2">
              <div><dt className="text-[#6B6B6B]">Canal</dt><dd>{CANAL_LABEL[c.canal] || c.canal}</dd></div>
              <div><dt className="text-[#6B6B6B]">Cidade/UF</dt><dd>{c.cidade ? `${c.cidade}/${c.uf || "?"}` : "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Email</dt><dd>{c.emailInstitucional || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Telefone</dt><dd>{c.telefoneInstitucional || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Site</dt><dd>{c.site || "—"}</dd></div>
              <div><dt className="text-[#6B6B6B]">Origem</dt><dd>{c.origemLead}</dd></div>
              <div><dt className="text-[#6B6B6B]">Responsável</dt><dd className="capitalize">{c.responsavel || <span className="text-[#6B6B6B] italic">— sem responsável</span>}</dd></div>
            </dl>
          </section>

          {/* Filhas (se for matriz) */}
          {filhasMatriz.length > 0 && (
            <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
              <h2 className="font-bold mb-3 text-sm">Lojas/unidades dessa matriz ({filhasMatriz.length})</h2>
              <ul className="space-y-1.5">
                {filhasMatriz.map((f) => (
                  <li key={f.contaId} className="text-xs flex items-center justify-between">
                    <div className="min-w-0">
                      <Link href={`/contas/${f.contaId}`} className="font-medium hover:underline truncate block">
                        {f.nome}
                      </Link>
                      <span className="text-[#6B6B6B]">{f.cidade ? `${f.cidade}/${f.uf || "?"}` : "—"}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded text-white ${FUNIL_COLOR[f.funilStage] || "bg-zinc-400"}`}>
                      {FUNIL_LABEL[f.funilStage] || f.funilStage}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Vínculo de matriz (visível em qualquer conta) */}
          <section className="bg-[#F2F0EC] border border-[#E5E2DC] rounded-lg p-4">
            <div className="text-xs text-[#6B6B6B] mb-2 uppercase tracking-wider">Rede</div>
            {c.contaMatrizId && contaMatriz ? (
              <div>
                <div className="text-[10px] text-[#6B6B6B]">Esta conta é unidade da matriz:</div>
                <Link href={`/contas/${contaMatriz.contaId}`} className="text-sm font-semibold text-[#D4541A] hover:underline">
                  ↑ {contaMatriz.nome}
                </Link>
              </div>
            ) : filhasMatriz.length > 0 ? (
              <div className="text-xs text-[#6B6B6B]">
                Esta é uma <strong className="text-[#D4541A]">matriz</strong> com {filhasMatriz.length} unidade(s)
              </div>
            ) : (
              <div className="text-xs text-[#6B6B6B] mb-2">Conta independente (sem rede)</div>
            )}
            <div className="mt-2 flex flex-col gap-1.5">
              <VincularMatriz contaId={contaId} matrizAtual={contaMatriz ?? null} ehMatriz={filhasMatriz.length > 0} />
              {!c.contaMatrizId && (
                <VincularFilhas matrizContaId={contaId} matrizNome={c.nome} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
