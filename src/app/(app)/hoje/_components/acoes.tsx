"use client";
import { useTransition } from "react";
import { marcarAcaoFeita, adiarAcao } from "@/app/actions/contas";
import { toast } from "sonner";
import { Check, Clock } from "lucide-react";

export function AcaoActions({ acaoId }: { acaoId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 items-center">
      <button
        title="Marcar como feito"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await marcarAcaoFeita(acaoId);
            if (r.ok) toast.success("Ação concluída");
            else toast.error(r.error || "Falha");
          })
        }
        className="px-3 py-1.5 bg-[#00897B] text-white rounded text-sm hover:bg-[#00695C] disabled:opacity-50 flex items-center gap-1.5"
      >
        <Check className="w-4 h-4" /> feito
      </button>
      <div className="relative group">
        <button
          disabled={isPending}
          className="px-3 py-1.5 border border-[#E5E2DC] rounded text-sm hover:bg-[#F2F0EC] flex items-center gap-1.5"
        >
          <Clock className="w-4 h-4" /> adiar
        </button>
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E2DC] rounded shadow-lg hidden group-hover:block z-10 min-w-[120px]">
          {[
            { l: "1 dia", d: 1 },
            { l: "3 dias", d: 3 },
            { l: "1 semana", d: 7 },
            { l: "2 semanas", d: 14 },
            { l: "1 mês", d: 30 },
            { l: "45 dias", d: 45 },
          ].map((opt) => (
            <button
              key={opt.d}
              onClick={() =>
                startTransition(async () => {
                  const r = await adiarAcao(acaoId, opt.d);
                  if (r.ok) toast.success(`Adiado ${opt.l}`);
                  else toast.error(r.error || "Falha");
                })
              }
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#F2F0EC]"
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
