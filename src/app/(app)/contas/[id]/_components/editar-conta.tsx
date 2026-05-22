"use client";
import { useTransition } from "react";
import { atualizarConta } from "@/app/actions/contas";
import {
  CANAIS,
  FUNIL_STAGES,
  TEMPERATURAS,
  RESPONSAVEIS,
  type Conta,
} from "@/db/schema";
import { FUNIL_LABEL, CANAL_LABEL } from "@/lib/labels";
import { toast } from "sonner";

export function EditarConta({ conta }: { conta: Conta }) {
  const [isPending, startTransition] = useTransition();

  const update = (campo: keyof Conta, valor: string) => {
    startTransition(async () => {
      const r = await atualizarConta(conta.contaId, { [campo]: valor });
      if (r.ok) toast.success(`${campo} atualizado`);
      else toast.error(r.error || "falha ao atualizar");
    });
  };

  return (
    <div className="grid grid-cols-4 gap-3 text-sm">
      <div>
        <label className="text-xs text-zinc-500">Funil</label>
        <select
          defaultValue={conta.funilStage}
          onChange={(e) => update("funilStage", e.target.value)}
          disabled={isPending}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          {FUNIL_STAGES.map((s) => (
            <option key={s} value={s}>
              {FUNIL_LABEL[s] || s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-zinc-500">Temperatura</label>
        <select
          defaultValue={conta.temperatura}
          onChange={(e) => update("temperatura", e.target.value)}
          disabled={isPending}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          {TEMPERATURAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-zinc-500">Canal</label>
        <select
          defaultValue={conta.canal}
          onChange={(e) => update("canal", e.target.value)}
          disabled={isPending}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          {CANAIS.map((c) => (
            <option key={c} value={c}>
              {CANAL_LABEL[c] || c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-zinc-500">Responsável</label>
        <select
          defaultValue={conta.responsavel}
          onChange={(e) => update("responsavel", e.target.value)}
          disabled={isPending}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          {RESPONSAVEIS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-4">
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
