import { db } from "@/db";
import { conta, contato, interacao, acao } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FUNIL_LABEL, FUNIL_COLOR, TEMP_COLOR, CANAL_LABEL } from "@/lib/labels";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditarConta } from "./_components/editar-conta";
import { NovaInteracao } from "./_components/nova-interacao";

export const dynamic = "force-dynamic";

export default async function ContaDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contaId = Number(id);
  if (!Number.isInteger(contaId)) notFound();

  const [c] = await db.select().from(conta).where(eq(conta.contaId, contaId));
  if (!c) notFound();

  const contatos = await db
    .select()
    .from(contato)
    .where(eq(contato.contaId, contaId))
    .orderBy(desc(contato.ePrincipal), desc(contato.updatedAt));

  const interacoes = await db
    .select()
    .from(interacao)
    .where(eq(interacao.contaId, contaId))
    .orderBy(desc(interacao.ocorridoEm))
    .limit(50);

  const acoesPendentes = await db
    .select()
    .from(acao)
    .where(eq(acao.contaId, contaId))
    .orderBy(acao.dataPrevista);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/contas"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> voltar pras contas
      </Link>

      <header className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{c.nome}</h1>
            {c.razaoSocial && c.razaoSocial !== c.nome && (
              <div className="text-sm text-zinc-500">{c.razaoSocial}</div>
            )}
            <div className="text-xs text-zinc-400 font-mono mt-1">
              {c.cnpj || "sem CNPJ"} · ID {c.contaId}
            </div>
          </div>
          <div className="flex gap-2">
            <span
              className={`text-white text-xs px-3 py-1 rounded ${
                FUNIL_COLOR[c.funilStage] || "bg-zinc-400"
              }`}
            >
              {FUNIL_LABEL[c.funilStage] || c.funilStage}
            </span>
            <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border">
              <span
                className={`w-2 h-2 rounded-full ${
                  TEMP_COLOR[c.temperatura] || "bg-zinc-400"
                }`}
              />
              {c.temperatura}
            </span>
          </div>
        </div>
        <EditarConta conta={c} />
      </header>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <section className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Timeline de interações</h2>
              <NovaInteracao contaId={contaId} contatos={contatos} />
            </div>
            {interacoes.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center">
                Nenhuma interação registrada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {interacoes.map((i) => (
                  <div
                    key={i.interacaoId}
                    className="border-l-2 border-zinc-300 pl-4 py-1"
                  >
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                      <span className="font-medium uppercase">{i.tipo}</span>
                      <span>·</span>
                      <span>{i.autor}</span>
                      <span>·</span>
                      <span>
                        {new Date(i.ocorridoEm).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{i.texto}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold mb-3 text-sm">Contatos</h2>
            {contatos.length === 0 ? (
              <p className="text-xs text-zinc-500">Sem contatos cadastrados</p>
            ) : (
              <ul className="space-y-3">
                {contatos.map((p) => (
                  <li key={p.contatoId} className="text-sm">
                    <div className="font-medium flex items-center gap-1.5">
                      {p.nome}
                      {p.ePrincipal && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-1.5 rounded">
                          principal
                        </span>
                      )}
                    </div>
                    {p.cargo && (
                      <div className="text-xs text-zinc-500">{p.cargo}</div>
                    )}
                    {p.telefone && (
                      <div className="text-xs text-zinc-600">{p.telefone}</div>
                    )}
                    {p.email && (
                      <div className="text-xs text-zinc-600">{p.email}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold mb-3 text-sm">Dados institucionais</h2>
            <dl className="text-xs space-y-2">
              <div>
                <dt className="text-zinc-500">Canal</dt>
                <dd>{CANAL_LABEL[c.canal] || c.canal}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cidade/UF</dt>
                <dd>
                  {c.cidade ? `${c.cidade}/${c.uf || "?"}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Email</dt>
                <dd>{c.emailInstitucional || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Telefone</dt>
                <dd>{c.telefoneInstitucional || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Origem</dt>
                <dd>{c.origemLead}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Responsável</dt>
                <dd className="capitalize">{c.responsavel}</dd>
              </div>
            </dl>
          </section>

          {acoesPendentes.length > 0 && (
            <section className="bg-white border rounded-lg p-5">
              <h2 className="font-semibold mb-3 text-sm">Próximas ações</h2>
              <ul className="text-xs space-y-2">
                {acoesPendentes.map((a) => (
                  <li key={a.acaoId}>
                    <div className="font-medium">{a.descricao}</div>
                    <div className="text-zinc-500">
                      {a.dataPrevista} · {a.tipo}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
