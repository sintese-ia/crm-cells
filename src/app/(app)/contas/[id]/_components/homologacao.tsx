"use client";

import { useState, useTransition } from "react";
import { atualizarConta } from "@/app/actions/contas";
import { STATUS_HOMOLOGACAO, STATUS_HOMOLOGACAO_LABEL } from "@/db/schema";

type Props = {
  contaId: number;
  requer: boolean;
  status: string | null;
  iniciadaEm: string | null;
  aprovadaEm: string | null;
  notas: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pendente_inicio: "border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]",
  docs_enviados: "border-[#FFB300] bg-[#FFB300]/10 text-[#BF360C]",
  em_analise: "border-[#0091EA] bg-[#0091EA]/10 text-[#0091EA]",
  aprovada: "border-[#00897B] bg-[#00897B]/10 text-[#00897B]",
  reprovada: "border-[#BF360C] bg-[#BF360C]/10 text-[#BF360C]",
};

export function HomologacaoCard(p: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [requer, setRequer] = useState(p.requer);
  const [status, setStatus] = useState<string>(p.status ?? "pendente_inicio");
  const [iniciada, setIniciada] = useState(p.iniciadaEm ?? "");
  const [aprovada, setAprovada] = useState(p.aprovadaEm ?? "");
  const [notas, setNotas] = useState(p.notas ?? "");

  function save() {
    start(async () => {
      const patch: Record<string, unknown> = {
        requerHomologacao: requer,
        statusHomologacao: requer ? status : null,
        homologacaoIniciadaEm: requer && iniciada ? iniciada : null,
        homologacaoAprovadaEm: requer && aprovada ? aprovada : null,
        homologacaoNotas: requer ? (notas || null) : null,
      };
      await atualizarConta(p.contaId, patch as never);
      setEditing(false);
    });
  }

  if (!p.requer && !editing) {
    return (
      <section className="bg-white border border-dashed border-[#E5E2DC] rounded-lg p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#6B6B6B]">🛂 Homologação não requerida</span>
          <button onClick={() => { setRequer(true); setEditing(true); }} className="text-xs text-[#0091EA] hover:underline">
            marcar como requerida
          </button>
        </div>
      </section>
    );
  }

  const currentStatus = p.status ?? "pendente_inicio";
  const colorCls = STATUS_COLOR[currentStatus] || "border-[#E5E2DC] bg-white text-[#0D0D0D]";

  // Aprovada → render minimal (linha discreta, não card cheio)
  if (currentStatus === "aprovada" && !editing) {
    return (
      <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-[#00897B]/10 text-[#00897B]">
        <span className="flex items-center gap-1.5">
          ✅ <span className="font-medium">Homologada</span>
          {p.aprovadaEm && <span className="text-[#00897B]/70">· {new Date(p.aprovadaEm).toLocaleDateString("pt-BR")}</span>}
        </span>
        <button onClick={() => setEditing(true)} className="text-[#00897B]/70 hover:underline">editar</button>
      </div>
    );
  }

  return (
    <section className={`border-2 rounded-lg p-5 ${editing ? "border-[#0D0D0D] bg-white" : colorCls}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm flex items-center gap-2">
          🛂 Homologação
          {!editing && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/50">
              {STATUS_HOMOLOGACAO_LABEL[currentStatus] || currentStatus}
            </span>
          )}
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-[#0D0D0D] hover:underline">editar</button>
        )}
      </div>

      {!editing ? (
        <dl className="text-xs space-y-1.5">
          {p.iniciadaEm && (
            <div><dt className="text-[#6B6B6B] inline">Iniciada: </dt><dd className="inline font-medium">{new Date(p.iniciadaEm).toLocaleDateString("pt-BR")}</dd></div>
          )}
          {p.aprovadaEm && (
            <div><dt className="text-[#6B6B6B] inline">Aprovada: </dt><dd className="inline font-medium">{new Date(p.aprovadaEm).toLocaleDateString("pt-BR")}</dd></div>
          )}
          {p.notas && <div className="whitespace-pre-wrap mt-2 p-2 bg-white/50 rounded text-[#0D0D0D]">{p.notas}</div>}
          {!p.iniciadaEm && !p.notas && (
            <p className="text-[#6B6B6B] italic">Processo ainda não iniciado. Clica em editar pra registrar progresso.</p>
          )}
        </dl>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={requer} onChange={(e) => setRequer(e.target.checked)} />
            Esta conta requer homologação?
          </label>
          {requer && (
            <>
              <div>
                <label className="block text-xs text-[#6B6B6B] mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white">
                  {STATUS_HOMOLOGACAO.map((s) => (
                    <option key={s} value={s}>{STATUS_HOMOLOGACAO_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#6B6B6B] mb-1">Iniciada em</label>
                  <input type="date" value={iniciada} onChange={(e) => setIniciada(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6B6B] mb-1">Aprovada em</label>
                  <input type="date" value={aprovada} onChange={(e) => setAprovada(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#6B6B6B] mb-1">Notas (docs pendentes, contatos, etc)</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
                  placeholder="Ex: aguardando laudo microbiológico. Comprador: Fulano da Tal — fulano@franqueadora.com.br"
                  className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" />
              </div>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={pending} className="text-xs bg-[#0D0D0D] text-white px-3 py-1.5 rounded hover:bg-[#1A1A1A] disabled:opacity-50">
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setEditing(false); setRequer(p.requer); setStatus(p.status ?? "pendente_inicio"); setIniciada(p.iniciadaEm ?? ""); setAprovada(p.aprovadaEm ?? ""); setNotas(p.notas ?? ""); }} className="text-xs px-3 py-1.5 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
