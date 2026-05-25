"use client";
import { useState, useTransition } from "react";
import type { Acao } from "@/db/schema";
import { reagendarAcao } from "@/app/actions/contas";
import { toast } from "sonner";
import { Calendar, Edit2 } from "lucide-react";

export function ProximaAcao({ acao }: { acao: Acao }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [novaData, setNovaData] = useState(acao.dataPrevista);

  const hoje = new Date().toISOString().slice(0, 10);
  const atrasada = acao.dataPrevista < hoje;
  const ehHoje = acao.dataPrevista === hoje;

  const corStatus = atrasada ? "border-[#BF360C] bg-[#FFF7F0]" : ehHoje ? "border-[#D4541A] bg-[#FFF7F0]" : "border-[#0091EA] bg-[#F0F8FF]";

  return (
    <div className={`mt-3 p-4 rounded-lg border-l-4 ${corStatus}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider text-[#6B6B6B] font-medium">Próxima ação</span>
            {atrasada && <span className="text-xs text-[#BF360C] font-semibold">EM ATRASO</span>}
            {ehHoje && <span className="text-xs text-[#D4541A] font-semibold">HOJE</span>}
          </div>
          <div className="text-sm font-medium">{acao.descricao}</div>
          {!editing ? (
            <div className="text-xs text-[#6B6B6B] mt-1">
              Data prevista: <strong>{new Date(acao.dataPrevista + "T12:00").toLocaleDateString("pt-BR")}</strong>
              <button onClick={() => setEditing(true)} className="ml-2 text-[#D4541A] hover:underline inline-flex items-center gap-0.5">
                <Edit2 className="w-3 h-3" /> mudar data
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="text-xs px-2 py-1 border border-[#E5E2DC] rounded bg-white"
              />
              <button
                onClick={() =>
                  startTransition(async () => {
                    const r = await reagendarAcao(acao.acaoId, novaData);
                    if (r.ok) {
                      toast.success("Data atualizada");
                      setEditing(false);
                    } else {
                      toast.error(r.error || "Falha");
                    }
                  })
                }
                disabled={isPending}
                className="text-xs px-2 py-1 bg-[#0D0D0D] text-white rounded"
              >
                salvar
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-[#6B6B6B]">cancelar</button>
            </div>
          )}
        </div>
        <div className="text-[10px] text-[#6B6B6B] italic self-center text-right max-w-[180px] leading-tight">
          Pra fechar: registre o resultado da ligação/WA na timeline abaixo<br/>
          (a próxima ação é criada automaticamente)
        </div>
      </div>
    </div>
  );
}
