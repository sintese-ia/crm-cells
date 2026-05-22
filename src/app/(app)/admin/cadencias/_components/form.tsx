"use client";
import { useTransition, useState } from "react";
import type { Situacao, RegraCadencia } from "@/db/schema";
import { atualizarRegra } from "@/app/actions/admin";
import { toast } from "sonner";

type Grouped = Record<string, Record<string, { situacao: Situacao; regras: RegraCadencia[] }>>;

export function CadenciasForm({
  grouped,
  estagios,
  estagioLabel,
}: {
  grouped: Grouped;
  estagios: readonly string[];
  estagioLabel: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<number, number>>({}); // regraId → dias

  const onChange = (regraId: number, dias: number) => {
    setEdits((prev) => ({ ...prev, [regraId]: dias }));
  };

  const onSave = (regraId: number, descricao: string) => {
    const dias = edits[regraId];
    if (dias === undefined) return;
    startTransition(async () => {
      const r = await atualizarRegra(regraId, { diasProximaAcao: dias });
      if (r.ok) {
        toast.success(`"${descricao}" → D+${dias} salvo`);
        setEdits((prev) => {
          const next = { ...prev };
          delete next[regraId];
          return next;
        });
      } else {
        toast.error(r.error || "Falha");
      }
    });
  };

  const cor: Record<string, string> = {
    primeiro_contato: "border-[#0091EA]",
    reuniao_marcada: "border-[#D4541A]",
    pos_reuniao: "border-[#8BC34A]",
    cliente_ativo: "border-[#00897B]",
    parado: "border-[#6B6B6B]",
  };

  return (
    <div className="space-y-6">
      {estagios.map((estagio) => {
        const situacoes = grouped[estagio];
        if (!situacoes || Object.keys(situacoes).length === 0) return null;
        return (
          <section key={estagio} className={`bg-white border-l-4 ${cor[estagio]} border-y border-r border-[#E5E2DC] rounded-r-lg p-6`}>
            <h2 className="font-bold text-lg mb-1" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              {estagioLabel[estagio]}
            </h2>
            <p className="text-xs text-[#6B6B6B] mb-5">
              {{
                primeiro_contato: "Objetivo: agendar a reunião",
                reuniao_marcada: "Objetivo: garantir que a reunião aconteça",
                pos_reuniao: "Objetivo: fechar a venda",
                cliente_ativo: "Objetivo: manter e fazer recompra",
                parado: "Leads parados — exceções",
              }[estagio]}
            </p>

            <div className="space-y-6">
              {Object.values(situacoes).map(({ situacao: sit, regras }) => (
                <div key={sit.situacaoId}>
                  <h3 className="text-sm font-semibold mb-2">
                    {sit.icon} {sit.label}
                    {sit.autoFunil && (
                      <span className="ml-2 text-xs text-[#6B6B6B] font-normal">
                        → auto move funil pra "{sit.autoFunil}"
                      </span>
                    )}
                  </h3>

                  {regras.length === 0 ? (
                    <p className="text-xs text-[#6B6B6B] italic pl-4">Sem regras (sistema não cria ação automática)</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-[#6B6B6B]">
                        <tr>
                          <th className="text-left pb-1 font-medium">Tentativa</th>
                          <th className="text-left pb-1 font-medium">Daqui (dias)</th>
                          <th className="text-left pb-1 font-medium">Ação</th>
                          <th className="text-left pb-1 font-medium">Descrição</th>
                          <th className="pb-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {regras.map((r) => {
                          const editing = edits[r.regraId];
                          const valorAtual = editing ?? r.diasProximaAcao;
                          const mudou = editing !== undefined;
                          return (
                            <tr key={r.regraId} className="border-t border-[#E5E2DC]">
                              <td className="py-2 text-[#6B6B6B]">
                                {r.tentativaMin === r.tentativaMax
                                  ? `${r.tentativaMin}ª`
                                  : r.tentativaMax
                                  ? `${r.tentativaMin}ª-${r.tentativaMax}ª`
                                  : `${r.tentativaMin}ª+`}
                              </td>
                              <td className="py-2">
                                {r.diasProximaAcao !== null ? (
                                  <input
                                    type="number"
                                    value={valorAtual ?? ""}
                                    onChange={(e) => onChange(r.regraId, Number(e.target.value))}
                                    className={`w-16 px-2 py-1 border rounded text-sm ${mudou ? "border-[#D4541A] bg-[#FFF7F0]" : "border-[#E5E2DC]"}`}
                                  />
                                ) : (
                                  <span className="text-[#6B6B6B] text-xs italic">—</span>
                                )}
                              </td>
                              <td className="py-2 text-xs text-[#6B6B6B]">{r.tipoProximaAcao}</td>
                              <td className="py-2">
                                {r.descricaoAcao}
                                {r.moveFunilPara && (
                                  <span className="text-xs text-[#BF360C] ml-2">(→ funil: {r.moveFunilPara})</span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                {mudou && (
                                  <button
                                    onClick={() => onSave(r.regraId, r.descricaoAcao)}
                                    disabled={isPending}
                                    className="text-xs bg-[#0D0D0D] text-white px-3 py-1 rounded hover:bg-[#1A1A1A]"
                                  >
                                    salvar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
