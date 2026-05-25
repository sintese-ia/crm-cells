"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { atualizarConta, criarInteracao, criarContato, marcarAcaoFeita } from "@/app/actions/contas";
import {
  type Conta, type Contato, type Interacao, type Situacao,
  CANAIS, TIPOS_CONTA, FUNIL_STAGES, RESPONSAVEIS, TIPOS_INTERACAO,
} from "@/db/schema";
import { toast } from "sonner";
import { Phone, MessageCircle, Globe, Mail, AtSign, Plus } from "lucide-react";

const FUNIL_LABEL: Record<string, string> = {
  sem_contato: "Sem contato",
  contato_realizado: "Contato realizado",
  reuniao: "Reunião",
  em_negociacao: "Em negociação",
  pedido_realizado: "Pedido realizado",
  positivada: "Positivada",
  negativa: "Negativa",
};

const FUNIL_COR: Record<string, string> = {
  sem_contato: "bg-[#6B6B6B]",
  contato_realizado: "bg-[#1C2A35]",
  reuniao: "bg-[#0091EA]",
  em_negociacao: "bg-[#D4772C]",
  pedido_realizado: "bg-[#00C853]",
  positivada: "bg-[#00897B]",
  negativa: "bg-[#BF360C]",
};

const CANAL_LABEL: Record<string, string> = {
  distribuidor: "Distribuidor",
  loja_suplementos: "Loja de suplementos",
  emporio_natural: "Empório natural",
  mercado_premium: "Mercado premium",
  farmacia: "Farmácia",
  academia: "Academia",
  marketplace: "Marketplace",
  vending_machine: "Vending machine",
  outros: "Outros",
};

export function CardConta({
  conta: c, contatos, interacoes, situacoes, filhas, matriz,
}: {
  conta: Conta;
  contatos: Contato[];
  interacoes: Interacao[];
  situacoes: Situacao[];
  filhas: { contaId: number; nome: string; cidade: string | null; uf: string | null; funilStage: string }[];
  matriz: { contaId: number; nome: string } | null;
}) {
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<"interacao" | "contato" | null>(null);

  // Patch genérico
  function patch<K extends keyof Conta>(campo: K, valor: Conta[K]) {
    start(async () => {
      const r = await atualizarConta(c.contaId, { [campo]: valor } as Partial<Conta>);
      if (r.ok) toast.success(`${String(campo)} atualizado`);
      else toast.error(r.error || "Falha");
    });
  }

  // Temperatura derivada
  const ultimaReal = interacoes.find((i) => i.status === "realizada" || i.status === "feita");
  const diasUlt = ultimaReal?.ocorridoEm
    ? Math.floor((Date.now() - new Date(ultimaReal.ocorridoEm).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const temp = diasUlt === null ? "frio"
    : ["reuniao", "em_negociacao", "pedido_realizado", "positivada"].includes(c.funilStage) && diasUlt > 15 ? "risco"
    : diasUlt < 7 ? "quente"
    : diasUlt < 30 ? "morno" : "frio";

  const sitMap = Object.fromEntries(situacoes.map((s) => [s.situacaoId, s]));

  // Timeline ordenada: pendentes (futuro no topo) + realizadas (passado)
  const pendentes = interacoes.filter((i) => i.status === "pendente").sort((a, b) =>
    (b.dataPrevista || "").localeCompare(a.dataPrevista || ""));
  const realizadas = interacoes.filter((i) => i.status !== "pendente").sort((a, b) =>
    new Date(b.ocorridoEm || b.createdAt).getTime() - new Date(a.ocorridoEm || a.createdAt).getTime());

  return (
    <div className="space-y-6">
      {/* HEADER + dados editáveis inline */}
      <header className="bg-white border border-[#E5E2DC] rounded-lg p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <input
              defaultValue={c.nome}
              onBlur={(e) => e.target.value !== c.nome && patch("nome", e.target.value)}
              className="text-2xl font-bold w-full bg-transparent border-b border-transparent hover:border-[#E5E2DC] focus:border-[#D4541A] focus:outline-none"
              style={{ fontFamily: "'Alias Extended', sans-serif" }}
            />
            <div className="text-xs text-[#6B6B6B] mt-1">
              {c.razaoSocial && <span>{c.razaoSocial} · </span>}
              {c.cnpj || "sem CNPJ"} · ID {c.contaId}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <span className={`text-white text-xs px-3 py-1 rounded ${FUNIL_COR[c.funilStage]}`}>
              {FUNIL_LABEL[c.funilStage] || c.funilStage}
            </span>
            <span className="text-xs text-[#6B6B6B]">temp: <strong className="capitalize">{temp}</strong></span>
          </div>
        </div>

        {/* Dados editáveis em grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <Field label="Responsável">
            <select defaultValue={c.responsavel ?? ""} onChange={(e) => patch("responsavel", e.target.value || null)} disabled={pending} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white">
              <option value="">— sem dono</option>
              {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Setor">
            <select defaultValue={c.canal} onChange={(e) => patch("canal", e.target.value)} disabled={pending} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white">
              {CANAIS.map((k) => <option key={k} value={k}>{CANAL_LABEL[k] || k}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select defaultValue={c.tipo ?? "loja_unica"} onChange={(e) => patch("tipo", e.target.value)} disabled={pending} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white">
              {TIPOS_CONTA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Nº de lojas">
            <input type="number" defaultValue={c.nLojas ?? 1} onBlur={(e) => patch("nLojas", Number(e.target.value))} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
          <Field label="Cidade / UF">
            <div className="flex gap-1">
              <input defaultValue={c.cidade ?? ""} onBlur={(e) => patch("cidade", e.target.value)} className="flex-1 px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
              <input defaultValue={c.uf ?? ""} maxLength={2} onBlur={(e) => patch("uf", e.target.value.toUpperCase())} className="w-12 px-2 py-1 border border-[#E5E2DC] rounded bg-white uppercase" />
            </div>
          </Field>
          <Field label="Origem">
            <input defaultValue={c.origem ?? ""} onBlur={(e) => patch("origem", e.target.value || null)} placeholder="Arnold, Indicação..." className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
          <Field label="Prioridade">
            <select defaultValue={c.prioridadeManual ?? ""} onChange={(e) => patch("prioridadeManual", e.target.value || null)} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white">
              <option value="">auto ({c.prioridadeCalc ?? "—"})</option>
              <option value="alta">alta</option>
              <option value="media">média</option>
              <option value="baixa">baixa</option>
              <option value="descartar">descartar</option>
            </select>
          </Field>
          <Field label="Forçar funil (admin)">
            <select defaultValue={c.funilStage} onChange={(e) => patch("funilStage", e.target.value)} className="w-full px-2 py-1 border border-dashed border-[#BF360C] rounded bg-white">
              {FUNIL_STAGES.map((s) => <option key={s} value={s}>{FUNIL_LABEL[s] || s}</option>)}
            </select>
          </Field>
        </div>

        {/* Contato institucional */}
        <div className="mt-4 pt-4 border-t border-[#E5E2DC] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Field label="Telefone">
            <input defaultValue={c.telefoneInstitucional ?? ""} onBlur={(e) => patch("telefoneInstitucional", e.target.value || null)} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
          <Field label="WhatsApp">
            <input defaultValue={c.whatsappInstitucional ?? ""} onBlur={(e) => patch("whatsappInstitucional", e.target.value || null)} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
          <Field label="Email">
            <input defaultValue={c.emailInstitucional ?? ""} onBlur={(e) => patch("emailInstitucional", e.target.value || null)} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
          <Field label="Site / Instagram">
            <input defaultValue={c.site ?? c.instagram ?? ""} onBlur={(e) => patch(e.target.value.includes("instagram") ? "instagram" : "site", e.target.value || null)} className="w-full px-2 py-1 border border-[#E5E2DC] rounded bg-white" />
          </Field>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {c.telefoneInstitucional && <a href={`tel:+55${c.telefoneInstitucional.replace(/\D/g,"")}`} className="text-xs px-2.5 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] flex items-center gap-1"><Phone className="w-3 h-3"/> ligar</a>}
          {(c.whatsappInstitucional || c.telefoneInstitucional) && <a href={`https://wa.me/55${(c.whatsappInstitucional || c.telefoneInstitucional || "").replace(/\D/g,"")}`} target="_blank" rel="noopener" className="text-xs px-2.5 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] flex items-center gap-1"><MessageCircle className="w-3 h-3"/> wa</a>}
          {c.emailInstitucional && <a href={`mailto:${c.emailInstitucional}`} className="text-xs px-2.5 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] flex items-center gap-1"><Mail className="w-3 h-3"/> email</a>}
          {c.instagram && <a href={c.instagram} target="_blank" rel="noopener" className="text-xs px-2.5 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] flex items-center gap-1"><AtSign className="w-3 h-3"/> ig</a>}
          {c.site && <a href={c.site} target="_blank" rel="noopener" className="text-xs px-2.5 py-1 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] flex items-center gap-1"><Globe className="w-3 h-3"/> site</a>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* COLUNA PRINCIPAL: Timeline (passado + futuro) */}
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white border border-[#E5E2DC] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Interações</h2>
              <button onClick={() => setModal("interacao")} className="text-xs bg-[#D4541A] text-white px-3 py-1.5 rounded hover:bg-[#BF360C] flex items-center gap-1">
                <Plus className="w-3 h-3" /> nova
              </button>
            </div>
            {[...pendentes, ...realizadas].length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">Nenhuma interação ainda.</p>
            ) : (
              <div className="space-y-2">
                {pendentes.map((i) => <ItemPendente key={`p${i.interacaoId}`} i={i} sitMap={sitMap} />)}
                {realizadas.map((i) => <ItemRealizada key={`r${i.interacaoId}`} i={i} sitMap={sitMap} />)}
              </div>
            )}
          </section>
        </div>

        {/* COLUNA LATERAL */}
        <div className="space-y-4">
          <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">Contatos</h2>
              <button onClick={() => setModal("contato")} className="text-xs text-[#0091EA] hover:underline">+ adicionar</button>
            </div>
            {contatos.length === 0 ? <p className="text-xs text-[#6B6B6B]">Sem contatos</p> : (
              <ul className="space-y-3">
                {contatos.map((ct) => (
                  <li key={ct.contatoId} className="text-sm border-b border-[#F2F0EC] last:border-0 pb-2 last:pb-0">
                    <div className="font-medium flex items-center gap-1.5">
                      {ct.nome}
                      {ct.ePrincipal && <span className="text-[10px] bg-[#FFB300]/20 text-[#BF360C] px-1 rounded">principal</span>}
                    </div>
                    {ct.cargo && <div className="text-xs text-[#6B6B6B]">{ct.cargo}</div>}
                    {ct.telefone && <div className="text-xs">{ct.telefone}</div>}
                    {ct.email && <div className="text-xs">{ct.email}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(filhas.length > 0 || matriz) && (
            <section className="bg-[#F2F0EC] border border-[#E5E2DC] rounded-lg p-4">
              <div className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-2">Rede</div>
              {matriz && (
                <div className="text-xs">
                  Unidade da matriz: <Link href={`/contas/${matriz.contaId}`} className="text-[#D4541A] hover:underline">↑ {matriz.nome}</Link>
                </div>
              )}
              {filhas.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-[#6B6B6B] mb-1">Esta é matriz com {filhas.length} loja{filhas.length > 1 ? "s" : ""}:</div>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {filhas.map((f) => (
                      <li key={f.contaId} className="text-xs">
                        <Link href={`/contas/${f.contaId}`} className="hover:underline">{f.nome}</Link>
                        {f.cidade && <span className="text-[#6B6B6B]"> · {f.cidade}/{f.uf}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="bg-white border border-[#E5E2DC] rounded-lg p-5">
            <h2 className="font-bold text-sm mb-2">Notas</h2>
            <textarea
              defaultValue={c.notas ?? ""}
              onBlur={(e) => e.target.value !== c.notas && patch("notas", e.target.value)}
              rows={5}
              placeholder="Observações livres..."
              className="w-full text-xs px-2 py-1.5 border border-[#E5E2DC] rounded bg-white"
            />
          </section>
        </div>
      </div>

      {modal === "interacao" && <ModalNovaInteracao contaId={c.contaId} contatos={contatos} situacoes={situacoes} filhas={filhas} onClose={() => setModal(null)} />}
      {modal === "contato" && <ModalNovoContato contaId={c.contaId} onClose={() => setModal(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[#6B6B6B] mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function ItemPendente({ i, sitMap }: { i: Interacao; sitMap: Record<string, Situacao> }) {
  const [pending, start] = useTransition();
  const dataLabel = i.dataPrevista ? new Date(i.dataPrevista + "T12:00").toLocaleDateString("pt-BR") : "?";
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasada = i.dataPrevista && i.dataPrevista < hoje;
  const sit = i.situacaoId ? sitMap[i.situacaoId] : null;
  return (
    <div className={`border-l-2 border-dashed pl-3 py-2 ${atrasada ? "border-[#BF360C] bg-[#FFF7F0]" : "border-[#0091EA] bg-[#F0F8FF]"} rounded-r`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium uppercase text-[#0091EA]">{atrasada ? "📅 ATRASADA" : "📅 PREVISTA"}</span>
          <span className="bg-white border border-[#E5E2DC] px-2 py-0.5 rounded">{i.tipo}</span>
          {sit && <span className="text-[#6B6B6B]">{sit.icon} {sit.label}</span>}
          <span className="text-[#6B6B6B]">· {i.autor}</span>
          <span className={atrasada ? "text-[#BF360C] font-medium" : ""}>· {dataLabel}</span>
        </div>
        <button
          disabled={pending}
          onClick={() => start(async () => { const r = await marcarAcaoFeita(i.interacaoId); if (r.ok) toast.success("Marcada"); else toast.error(r.error || "Falha"); })}
          className="text-[10px] text-[#6B6B6B] hover:text-[#0D0D0D]"
        >
          marcar feita
        </button>
      </div>
      <div className="text-sm mt-1">{i.descricao || i.texto}</div>
    </div>
  );
}

function ItemRealizada({ i, sitMap }: { i: Interacao; sitMap: Record<string, Situacao> }) {
  const sit = i.situacaoId ? sitMap[i.situacaoId] : null;
  const data = i.ocorridoEm ?? i.createdAt;
  return (
    <div className={`border-l-2 pl-3 py-1 ${i.status === "feita" ? "border-[#00897B]" : "border-[#E5E2DC]"}`}>
      <div className="flex items-center gap-2 text-xs text-[#6B6B6B] flex-wrap">
        {i.status === "feita" && <span className="text-[#00897B] font-bold">✓ FEITA</span>}
        <span className="font-medium uppercase">{i.tipo}</span>
        {sit && <span className="bg-[#F2F0EC] px-2 py-0.5 rounded text-[#0D0D0D]">{sit.icon} {sit.label}</span>}
        <span>· {i.autor}</span>
        <span>· {data ? new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
      </div>
      {(i.texto || i.descricao) && <div className="text-sm mt-0.5">{i.texto || i.descricao}</div>}
    </div>
  );
}

function ModalNovaInteracao({
  contaId, contatos, situacoes, filhas, onClose,
}: {
  contaId: number;
  contatos: Contato[];
  situacoes: Situacao[];
  filhas: { contaId: number; nome: string }[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState("ligacao");
  const [situacaoId, setSit] = useState("");
  const [data, setData] = useState("");
  const [texto, setTexto] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [lojaId, setLojaId] = useState("");

  const sitsAgrupadas: Record<string, Situacao[]> = {};
  for (const s of situacoes) {
    if (!sitsAgrupadas[s.estagio]) sitsAgrupadas[s.estagio] = [];
    sitsAgrupadas[s.estagio].push(s);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await criarInteracao(contaId, {
        tipo,
        situacaoId: situacaoId || null,
        texto: texto || null,
        contatoId: contatoId ? Number(contatoId) : null,
        lojaId: lojaId ? Number(lojaId) : null,
        dataPrevista: data || null,
      });
      if (r.ok) {
        let msg = "Interação salva";
        if (r.proximaAcao) msg += ` · próx: ${r.proximaAcao.descricao}`;
        if (r.avisos?.length) msg += ` ⚠ ${r.avisos.join(", ")}`;
        toast.success(msg);
        onClose();
      } else toast.error(r.error || "Falha");
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-[560px] max-h-[90vh] overflow-auto space-y-3">
        <h3 className="font-bold text-lg" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Nova interação</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white">
              {TIPOS_INTERACAO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Data (deixa vazio = agora; futura = vira ação)">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" />
          </Field>
        </div>

        <Field label="Detalhe (situação)">
          <select value={situacaoId} onChange={(e) => setSit(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white">
            <option value="">— sem detalhe (texto livre) —</option>
            {Object.entries(sitsAgrupadas).map(([estagio, sits]) => (
              <optgroup key={estagio} label={estagio}>
                {sits.map((s) => <option key={s.situacaoId} value={s.situacaoId}>{s.icon} {s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {contatos.length > 0 && (
            <Field label="Com quem">
              <select value={contatoId} onChange={(e) => setContatoId(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white">
                <option value="">—</option>
                {contatos.map((c) => <option key={c.contatoId} value={c.contatoId}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>)}
              </select>
            </Field>
          )}
          {filhas.length > 0 && (
            <Field label="Loja específica">
              <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white">
                <option value="">— afeta todas —</option>
                {filhas.map((f) => <option key={f.contaId} value={f.contaId}>{f.nome}</option>)}
              </select>
            </Field>
          )}
        </div>

        <Field label="Comentário">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Detalhes livres..." className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" />
        </Field>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]">cancelar</button>
          <button type="submit" disabled={pending} className="text-sm px-4 py-1.5 rounded bg-[#0D0D0D] text-white disabled:opacity-50">{pending ? "salvando..." : "salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function ModalNovoContato({ contaId, onClose }: { contaId: number; onClose: () => void }) {
  const [pending, start] = useTransition();
  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await criarContato(contaId, {
        nome: String(fd.get("nome")),
        cargo: String(fd.get("cargo") || "") || null,
        telefone: String(fd.get("telefone") || "") || null,
        email: String(fd.get("email") || "") || null,
        ePrincipal: fd.get("principal") === "on",
      });
      if (r.ok) { toast.success("Contato adicionado"); onClose(); }
      else toast.error(r.error || "Falha");
    });
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-[480px] space-y-3">
        <h3 className="font-bold text-lg">Novo contato</h3>
        <Field label="Nome"><input name="nome" required className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" /></Field>
        <Field label="Cargo"><input name="cargo" placeholder="Comprador" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" /></Field>
        <Field label="Telefone / WhatsApp"><input name="telefone" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" /></Field>
        <Field label="Email"><input name="email" type="email" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded bg-white" /></Field>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="principal" /> Marcar como principal</label>
        <div className="flex gap-2 justify-end pt-2 border-t">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]">cancelar</button>
          <button type="submit" disabled={pending} className="text-sm px-4 py-1.5 rounded bg-[#0D0D0D] text-white disabled:opacity-50">{pending ? "..." : "adicionar"}</button>
        </div>
      </form>
    </div>
  );
}
