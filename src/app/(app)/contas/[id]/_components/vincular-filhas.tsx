"use client";

import { useState, useTransition, useEffect } from "react";
import { buscarFilhasCandidatas, vincularFilhasEmMassa } from "@/app/actions/contas";
import { toast } from "sonner";
import { Network, Search, X } from "lucide-react";

type Candidata = { contaId: number; nome: string; cidade: string | null; uf: string | null; canal: string };

export function VincularFilhas({
  matrizContaId,
  matrizNome,
}: {
  matrizContaId: number;
  matrizNome: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Candidata[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
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
        const r = await buscarFilhasCandidatas(query, matrizContaId);
        if (r.ok) setResultados(r.candidatas);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, matrizContaId]);

  function toggle(id: number) {
    const next = new Set(selecionadas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelecionadas(next);
  }

  function salvar() {
    if (selecionadas.size === 0) return;
    startTransition(async () => {
      const r = await vincularFilhasEmMassa(matrizContaId, Array.from(selecionadas));
      if (r.ok) {
        toast.success(`${r.vinculadas} lojas vinculadas a ${matrizNome}`);
        setOpen(false);
        setSelecionadas(new Set());
        setQuery("");
      } else {
        toast.error(r.error || "Falha");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#D4541A] hover:underline flex items-center gap-1"
      >
        <Network className="w-3 h-3" /> vincular lojas como filhas
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-[640px] max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-lg mb-1" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              Vincular lojas a {matrizNome}
            </h3>
            <p className="text-xs text-[#6B6B6B] mb-3">
              Busque contas e selecione as que viram filhas dessa matriz. Só aparecem contas que ainda não têm matriz nem são matriz de outras.
            </p>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-2 top-3 text-[#6B6B6B]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, razão social, CNPJ ou cidade…"
                className="w-full pl-8 pr-2 py-2 border border-[#E5E2DC] rounded text-sm"
              />
            </div>

            {selecionadas.size > 0 && (
              <div className="mb-2 px-3 py-2 bg-[#FFB300]/10 border border-[#FFB300]/40 rounded text-xs flex items-center justify-between">
                <span><strong>{selecionadas.size}</strong> selecionada{selecionadas.size > 1 ? "s" : ""}</span>
                <button onClick={() => setSelecionadas(new Set())} className="text-[#BF360C] hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> limpar
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 space-y-1">
              {loading && <p className="text-xs text-[#6B6B6B] text-center py-4">buscando…</p>}
              {!loading && query.length >= 2 && resultados.length === 0 && (
                <p className="text-xs text-[#6B6B6B] text-center py-4">Nenhuma conta candidata encontrada</p>
              )}
              {resultados.map((r) => {
                const sel = selecionadas.has(r.contaId);
                return (
                  <button
                    key={r.contaId}
                    onClick={() => toggle(r.contaId)}
                    className={`w-full text-left p-2.5 rounded border flex items-start gap-2 ${
                      sel ? "border-[#D4541A] bg-[#D4541A]/5" : "border-[#E5E2DC] hover:bg-[#F2F0EC]"
                    }`}
                  >
                    <input type="checkbox" checked={sel} readOnly className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.nome}</div>
                      <div className="text-xs text-[#6B6B6B]">
                        {r.cidade ? `${r.cidade}/${r.uf}` : "—"} · {r.canal}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5E2DC] mt-3">
              <button onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]">
                cancelar
              </button>
              <button
                onClick={salvar}
                disabled={isPending || selecionadas.size === 0}
                className="text-sm px-4 py-1.5 rounded bg-[#0D0D0D] text-white hover:bg-[#1A1A1A] disabled:opacity-50"
              >
                {isPending ? "Vinculando..." : `Vincular ${selecionadas.size} loja${selecionadas.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
