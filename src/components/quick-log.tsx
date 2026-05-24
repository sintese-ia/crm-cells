"use client";

import { useState, useTransition } from "react";
import { criarInteracao } from "@/app/actions/contas";
import { toast } from "sonner";
import { Phone, MessageCircle, X } from "lucide-react";

type Opcao = { sit: string; label: string; tipo: string; cor: string };

const OPCOES_LIGACAO: Opcao[] = [
  { sit: "pc_nao_atendeu", label: "Não atendeu", tipo: "ligacao", cor: "bg-[#FFB300] text-[#0D0D0D]" },
  { sit: "pc_caixa_postal", label: "Cx postal", tipo: "ligacao", cor: "bg-[#FFB300] text-[#0D0D0D]" },
  { sit: "pc_respondeu_nao_marcou", label: "Falou ✓", tipo: "ligacao", cor: "bg-[#00897B] text-white" },
  { sit: "pc_numero_invalido", label: "Nº errado", tipo: "ligacao", cor: "bg-[#BF360C] text-white" },
];

const OPCOES_WHATSAPP: Opcao[] = [
  { sit: "pc_wa_sem_resposta", label: "Sem resposta", tipo: "whatsapp", cor: "bg-[#FFB300] text-[#0D0D0D]" },
  { sit: "pc_respondeu_nao_marcou", label: "Respondeu", tipo: "whatsapp", cor: "bg-[#00897B] text-white" },
];

export function QuickLog({
  contaId,
  modo = "both",
}: {
  contaId: number;
  modo?: "lig" | "wa" | "both";
}) {
  const [aberto, setAberto] = useState<"lig" | "wa" | null>(null);
  const [pending, start] = useTransition();

  function log(opt: Opcao) {
    start(async () => {
      const r = await criarInteracao(contaId, {
        tipo: opt.tipo,
        texto: `Quick log: ${opt.label}`,
        situacaoId: opt.sit,
      });
      if (r.ok) {
        const msg = r.acaoCriada
          ? `${opt.label} · próx ${r.acaoCriada.dias}d: ${r.acaoCriada.descricao}`
          : opt.label;
        toast.success(msg);
        setAberto(null);
      } else toast.error(r.error || "Falha");
    });
  }

  if (aberto) {
    const opcoes = aberto === "lig" ? OPCOES_LIGACAO : OPCOES_WHATSAPP;
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-[#6B6B6B] uppercase tracking-wider">resultado:</span>
        {opcoes.map((o) => (
          <button
            key={o.sit}
            disabled={pending}
            onClick={() => log(o)}
            className={`text-xs px-2 py-1 rounded hover:opacity-90 disabled:opacity-50 ${o.cor}`}
          >
            {o.label}
          </button>
        ))}
        <button onClick={() => setAberto(null)} className="text-xs text-[#6B6B6B] p-1">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {(modo === "lig" || modo === "both") && (
        <button
          onClick={() => setAberto("lig")}
          className="text-xs px-2.5 py-1 rounded bg-[#0D0D0D] text-white hover:bg-[#1A1A1A] flex items-center gap-1"
        >
          <Phone className="w-3 h-3" /> liguei
        </button>
      )}
      {(modo === "wa" || modo === "both") && (
        <button
          onClick={() => setAberto("wa")}
          className="text-xs px-2.5 py-1 rounded bg-[#25D366] text-white hover:opacity-90 flex items-center gap-1"
        >
          <MessageCircle className="w-3 h-3" /> mandei
        </button>
      )}
    </div>
  );
}
