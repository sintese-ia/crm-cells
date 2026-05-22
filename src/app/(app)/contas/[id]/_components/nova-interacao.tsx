"use client";
import { useState, useTransition } from "react";
import { criarInteracao } from "@/app/actions/contas";
import { TIPOS_INTERACAO, type Contato } from "@/db/schema";
import { toast } from "sonner";

export function NovaInteracao({
  contaId,
  contatos,
}: {
  contaId: number;
  contatos: Contato[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded hover:bg-zinc-800"
      >
        + nova interação
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await criarInteracao(contaId, {
                  tipo: String(fd.get("tipo") || "outro"),
                  texto: String(fd.get("texto") || ""),
                  contatoId: fd.get("contatoId")
                    ? Number(fd.get("contatoId"))
                    : null,
                });
                if (r.ok) {
                  toast.success("Interação registrada");
                  setOpen(false);
                } else {
                  toast.error(r.error || "Falha");
                }
              });
            }}
            className="bg-white rounded-lg p-6 w-[480px] space-y-3"
          >
            <h3 className="font-semibold">Nova interação</h3>
            <div>
              <label className="text-xs text-zinc-500">Tipo</label>
              <select
                name="tipo"
                required
                className="w-full px-2 py-1.5 border rounded text-sm bg-white"
              >
                {TIPOS_INTERACAO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {contatos.length > 0 && (
              <div>
                <label className="text-xs text-zinc-500">
                  Com quem (opcional)
                </label>
                <select
                  name="contatoId"
                  className="w-full px-2 py-1.5 border rounded text-sm bg-white"
                >
                  <option value="">—</option>
                  {contatos.map((c) => (
                    <option key={c.contatoId} value={c.contatoId}>
                      {c.nome} {c.cargo ? `(${c.cargo})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-zinc-500">O que aconteceu</label>
              <textarea
                name="texto"
                required
                rows={4}
                placeholder="Liguei, atendeu, pediu material..."
                className="w-full px-2 py-1.5 border rounded text-sm bg-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-1.5 rounded border"
              >
                cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded bg-zinc-900 text-white"
              >
                {isPending ? "salvando..." : "salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
