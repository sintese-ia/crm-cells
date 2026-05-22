"use client";
import { useTransition } from "react";
import { marcarAcaoFeita, adiarAcao } from "@/app/actions/contas";
import { toast } from "sonner";
import { Check } from "lucide-react";

export function ProximaAcaoMiniBtns({ acaoId }: { acaoId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5 self-center">
      <button
        title="Marcar como feito"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await marcarAcaoFeita(acaoId);
            if (r.ok) toast.success("Concluída");
            else toast.error(r.error || "Falha");
          })
        }
        className="px-3 py-1.5 bg-[#00897B] text-white rounded text-xs hover:bg-[#00695C] flex items-center gap-1"
      >
        <Check className="w-3 h-3" /> feito
      </button>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await adiarAcao(acaoId, 1);
            if (r.ok) toast.success("Adiado 1 dia");
            else toast.error(r.error || "Falha");
          })
        }
        className="px-3 py-1 border border-[#E5E2DC] rounded text-xs hover:bg-[#F2F0EC]"
      >
        +1d
      </button>
    </div>
  );
}
