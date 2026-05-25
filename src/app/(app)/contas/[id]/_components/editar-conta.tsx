"use client";
import { useState, useTransition } from "react";
import { atualizarConta } from "@/app/actions/contas";
import { FUNIL_STAGES, RESPONSAVEIS, type Conta } from "@/db/schema";
import { FUNIL_LABEL, CANAL_LABEL } from "@/lib/labels";
import { toast } from "sonner";

// Por que canal/temperatura sumiram:
// - canal vem da importação, nunca foi editado por Yas/Gabi
// - temperatura virou DERIVADA (lib/temperatura.ts) — não armazenada
// Funil fica read-only por default — só admin com "forçar mudança"
// muda direto (uso normal é via QuickLog → interação → regra → funil).

export function EditarConta({ conta }: { conta: Conta }) {
  const [isPending, startTransition] = useTransition();
  const [forcandoFunil, setForcandoFunil] = useState(false);

  const update = (campo: keyof Conta, valor: string | null) => {
    startTransition(async () => {
      const r = await atualizarConta(conta.contaId, { [campo]: valor });
      if (r.ok) toast.success(`${campo} atualizado`);
      else toast.error(r.error || "falha ao atualizar");
    });
  };

  const prioAtual = conta.prioridadeManual ?? "";
  const prioCalc = conta.prioridadeCalc ?? "—";

  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div className="col-span-3 -mb-1 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-zinc-500 uppercase tracking-wider">🔥 Prioridade:</span>
        <select
          value={prioAtual}
          onChange={(e) => update("prioridadeManual", e.target.value || null)}
          disabled={isPending}
          className="px-2 py-1 border rounded bg-white text-xs"
        >
          <option value="">automática ({prioCalc})</option>
          <option value="alta">🔥 alta (manual)</option>
          <option value="media">🟠 média (manual)</option>
          <option value="baixa">⚪ baixa (manual)</option>
          <option value="descartar">⊘ descartar (manual)</option>
        </select>
        {prioAtual && (
          <span className="text-[10px] text-[#6B6B6B]">substitui o cálculo automático</span>
        )}
        <span className="ml-auto text-[10px] text-[#6B6B6B]">
          Canal: <strong>{CANAL_LABEL[conta.canal] || conta.canal}</strong> · Temp: <em>derivada</em>
        </span>
      </div>

      <div>
        <label className="text-xs text-zinc-500">Funil</label>
        {forcandoFunil ? (
          <select
            defaultValue={conta.funilStage}
            onChange={(e) => { update("funilStage", e.target.value); setForcandoFunil(false); }}
            disabled={isPending}
            autoFocus
            className="w-full px-2 py-1.5 border-2 border-[#BF360C] rounded text-sm bg-white"
          >
            {FUNIL_STAGES.map((s) => (
              <option key={s} value={s}>{FUNIL_LABEL[s] || s}</option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-2 py-1.5 border border-dashed border-[#E5E2DC] rounded text-sm bg-[#F8F6F2] text-[#6B6B6B]">
              {FUNIL_LABEL[conta.funilStage] || conta.funilStage}
            </div>
            <button
              onClick={() => setForcandoFunil(true)}
              className="text-[10px] text-[#BF360C] hover:underline whitespace-nowrap"
              title="Mudar direto sem registrar interação — uso excepcional"
            >
              forçar
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-zinc-500">Responsável</label>
        <select
          defaultValue={conta.responsavel ?? ""}
          onChange={(e) => update("responsavel", e.target.value || null)}
          disabled={isPending}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          <option value="">— sem responsável</option>
          {RESPONSAVEIS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div></div>

      <div className="col-span-3">
        <label className="text-xs text-zinc-500">Notas</label>
        <textarea
          defaultValue={conta.notas || ""}
          onBlur={(e) => update("notas", e.target.value)}
          disabled={isPending}
          rows={2}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        />
      </div>
    </div>
  );
}
