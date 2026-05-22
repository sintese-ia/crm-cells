"use client";
import type { Etapa } from "@/lib/jornada";
import type { Contato, Situacao } from "@/db/schema";
import { NovaInteracaoRef } from "./nova-interacao-ref";
import { useRef } from "react";

export function JornadaCard({
  etapas,
  contaId,
  contatos,
  situacoes,
}: {
  etapas: Etapa[];
  contaId: number;
  contatos: Contato[];
  situacoes: Situacao[];
}) {
  const modalRef = useRef<{ open: (tipo?: string) => void }>(null);

  const cor = (e: Etapa) => {
    if (e.estado === "concluida") return "bg-[#00897B] text-white border-[#00897B]";
    if (e.estado === "em_andamento") return "bg-[#FFF7F0] text-[#D4541A] border-[#D4541A]";
    return "bg-white text-[#6B6B6B] border-[#E5E2DC]";
  };

  const icone = (e: Etapa) => {
    if (e.estado === "concluida") return "✅";
    if (e.estado === "em_andamento") return "🔄";
    return "⬜";
  };

  const sitMap = Object.fromEntries(situacoes.map((s) => [s.situacaoId, s]));

  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-2 font-medium">
        ⚡ Jornada
      </div>
      <div className="grid grid-cols-6 gap-2">
        {etapas.map((e) => (
          <button
            key={e.id}
            onClick={() => modalRef.current?.open(e.tipoInteracao)}
            className={`text-left rounded-lg border-2 p-3 transition-all hover:shadow-sm ${cor(e)}`}
            title="Click pra registrar interação dessa etapa"
          >
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="text-base">{icone(e)}</span>
              {e.contagem > 0 && (
                <span className="text-[10px] font-mono opacity-70">{e.contagem}x</span>
              )}
            </div>
            <div className="text-xs font-semibold leading-tight">{e.icon} {e.label}</div>
            {e.estado === "em_andamento" && e.ultimaInteracao && (
              <div className="text-[10px] mt-2 opacity-80 line-clamp-2">
                {e.ultimaInteracao.situacaoId && sitMap[e.ultimaInteracao.situacaoId]
                  ? sitMap[e.ultimaInteracao.situacaoId].label
                  : e.ultimaInteracao.texto.slice(0, 40)}
              </div>
            )}
            {e.estado === "em_andamento" && e.proximaAcao && (
              <div className="text-[10px] mt-1 font-medium">
                ⏰ {new Date(e.proximaAcao.dataPrevista + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </div>
            )}
          </button>
        ))}
      </div>

      <NovaInteracaoRef ref={modalRef} contaId={contaId} contatos={contatos} situacoes={situacoes} />
    </div>
  );
}
