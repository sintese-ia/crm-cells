"use client";
import { useTransition } from "react";
import { adiarAcao } from "@/app/actions/contas";
import { toast } from "sonner";

// Botão "feito" foi removido: marcar feito sem registrar resultado
// quebra a timeline e não dispara cadência. O QuickLog (botão "📞 liguei")
// ao lado já cobre o fluxo correto: registra interação na timeline +
// cancela ação atual + cria próxima conforme regra.

export function ProximaAcaoMiniBtns({ acaoId }: { acaoId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5 self-center">
      <button
        title="Adiar 1 dia"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await adiarAcao(acaoId, 1);
            if (r.ok) toast.success("Adiado 1 dia");
            else toast.error(r.error || "Falha");
          })
        }
        className="px-3 py-1.5 border border-[#E5E2DC] rounded text-xs hover:bg-[#F2F0EC]"
      >
        +1d
      </button>
      <button
        title="Adiar 7 dias"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await adiarAcao(acaoId, 7);
            if (r.ok) toast.success("Adiado 7 dias");
            else toast.error(r.error || "Falha");
          })
        }
        className="px-3 py-1 border border-[#E5E2DC] rounded text-xs hover:bg-[#F2F0EC]"
      >
        +7d
      </button>
    </div>
  );
}
