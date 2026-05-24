"use client";
import { useState, useTransition, useEffect } from "react";
import { moverFunil } from "@/app/actions/contas";
import { FUNIL_LABEL, FUNIL_COLOR, TEMP_COLOR } from "@/lib/labels";
import type { Conta } from "@/db/schema";
import Link from "next/link";
import { toast } from "sonner";

export function KanbanBoard({
  byStage: initialByStage,
  stages,
}: {
  byStage: Record<string, Conta[]>;
  stages: readonly string[];
}) {
  const [byStage, setByStage] = useState(initialByStage);
  // Quando troca filtro (resp/modo) o parent passa novo initialByStage;
  // re-sincroniza o state local pra refletir o novo conjunto de contas.
  useEffect(() => {
    setByStage(initialByStage);
  }, [initialByStage]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const onDragStart = (id: number) => setDragging(id);
  const onDragEnd = () => setDragging(null);

  const onDrop = (targetStage: string) => {
    if (dragging === null) return;
    // Encontra a conta
    let conta: Conta | undefined;
    let origemStage = "";
    for (const [stage, list] of Object.entries(byStage)) {
      const found = list.find((c) => c.contaId === dragging);
      if (found) {
        conta = found;
        origemStage = stage;
        break;
      }
    }
    if (!conta || origemStage === targetStage) {
      setDragging(null);
      return;
    }
    // Optimistic update
    setByStage((prev) => {
      const next = { ...prev };
      next[origemStage] = next[origemStage].filter((c) => c.contaId !== dragging);
      next[targetStage] = [
        { ...conta, funilStage: targetStage },
        ...next[targetStage],
      ];
      return next;
    });
    setDragging(null);
    startTransition(async () => {
      const r = await moverFunil(conta.contaId, targetStage);
      if (r.ok) toast.success(`${conta.nome} → ${FUNIL_LABEL[targetStage]}`);
      else {
        toast.error("Falha ao mover");
        // rollback
        setByStage(initialByStage);
      }
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
      {stages.map((stage) => (
        <div
          key={stage}
          className="bg-zinc-100 rounded-lg w-72 flex-shrink-0 flex flex-col max-h-full"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(stage)}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-zinc-100 rounded-t-lg">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  FUNIL_COLOR[stage] || "bg-zinc-400"
                }`}
              />
              <span className="text-sm font-medium">
                {FUNIL_LABEL[stage] || stage}
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {byStage[stage]?.length || 0}
            </span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {(byStage[stage] || []).map((c) => (
              <div
                key={c.contaId}
                draggable
                onDragStart={() => onDragStart(c.contaId)}
                onDragEnd={onDragEnd}
                className={`bg-white rounded-md p-3 border shadow-sm cursor-move hover:shadow ${
                  dragging === c.contaId ? "opacity-50" : ""
                }`}
              >
                <Link href={`/contas/${c.contaId}`} className="block">
                  <div className="font-medium text-sm mb-1 line-clamp-2">
                    {c.nome}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        TEMP_COLOR[c.temperatura] || "bg-zinc-400"
                      }`}
                    />
                    {c.temperatura}
                    {c.cidade && (
                      <>
                        <span>·</span>
                        <span>
                          {c.cidade}/{c.uf}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 capitalize">
                    {c.responsavel}
                  </div>
                </Link>
              </div>
            ))}
            {(byStage[stage]?.length || 0) === 0 && (
              <div className="text-xs text-zinc-400 text-center py-6">vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
