"use client";
import { useState, useTransition, useEffect } from "react";
import { vincularMatriz, desvincularMatriz, buscarMatrizesCandidatas } from "@/app/actions/contas";
import { toast } from "sonner";
import { Link2, Link2Off, Search } from "lucide-react";

type Candidata = { contaId: number; nome: string; cidade: string | null; uf: string | null; filhas: number };

export function VincularMatriz({
  contaId,
  matrizAtual,
  ehMatriz,
}: {
  contaId: number;
  matrizAtual: { contaId: number; nome: string } | null;
  ehMatriz: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Candidata[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (query.length < 2) {
      setResultados([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarMatrizesCandidatas(query, contaId);
        if (r.ok) setResultados(r.matrizes);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, contaId]);

  if (ehMatriz) {
    return (
      <span className="text-[10px] text-[#6B6B6B] italic">esta conta é uma matriz</span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {matrizAtual ? (
          <button
            onClick={() =>
              startTransition(async () => {
                const r = await desvincularMatriz(contaId);
                if (r.ok) toast.success("Desvinculada");
                else toast.error(r.error || "Falha");
              })
            }
            disabled={isPending}
            className="text-xs text-[#BF360C] hover:underline flex items-center gap-1"
          >
            <Link2Off className="w-3 h-3" /> desvincular
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-[#D4541A] hover:underline flex items-center gap-1"
          >
            <Link2 className="w-3 h-3" /> vincular a uma matriz
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-[560px] max-h-[80vh] flex flex-col">
            <h3 className="font-bold text-lg mb-3" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              Vincular a uma matriz
            </h3>
            <p className="text-xs text-[#6B6B6B] mb-3">
              Busque uma conta existente que será a matriz dessa rede. Ela passa a centralizar a comunicação.
            </p>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-2 top-3 text-[#6B6B6B]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pelo nome (ex: Way Suplementos)…"
                className="w-full pl-8 pr-2 py-2 border border-[#E5E2DC] rounded text-sm"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1">
              {loading && <p className="text-xs text-[#6B6B6B] text-center py-4">buscando…</p>}
              {!loading && query.length >= 2 && resultados.length === 0 && (
                <p className="text-xs text-[#6B6B6B] text-center py-4">Nenhuma matriz encontrada</p>
              )}
              {resultados.map((r) => (
                <button
                  key={r.contaId}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await vincularMatriz(contaId, r.contaId);
                      if (result.ok) {
                        toast.success(`Vinculada à ${r.nome}`);
                        setOpen(false);
                      } else toast.error(result.error || "Falha");
                    })
                  }
                  disabled={isPending}
                  className="w-full text-left p-3 rounded border border-[#E5E2DC] hover:bg-[#F2F0EC] disabled:opacity-50"
                >
                  <div className="font-medium text-sm">{r.nome}</div>
                  <div className="text-xs text-[#6B6B6B]">
                    {r.cidade ? `${r.cidade}/${r.uf}` : "—"} · {r.filhas} unidades vinculadas
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-3 border-t border-[#E5E2DC] mt-3">
              <button onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]">
                cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
