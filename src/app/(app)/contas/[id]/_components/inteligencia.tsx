"use client";

import { useState, useTransition } from "react";
import { atualizarConta } from "@/app/actions/contas";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

type Props = {
  contaId: number;
  origem: string | null;
  marcasConcorrentes: string[] | null;
  produtosVendidos: string[] | null;
};

// Bloco "Inteligência do lead" — só aparece em conta quente
// (funil >= visitado). Pedido pra não criar atrito no frio.
// Dados que vão se construindo conforme a conversa esquenta.
export function InteligenciaLead({ contaId, origem, marcasConcorrentes, produtosVendidos }: Props) {
  const [pending, start] = useTransition();
  const [orig, setOrig] = useState(origem ?? "");
  const [mc, setMc] = useState((marcasConcorrentes ?? []).join(", "));
  const [pv, setPv] = useState((produtosVendidos ?? []).join(", "));
  const [edit, setEdit] = useState(false);

  function salvar() {
    start(async () => {
      const r = await atualizarConta(contaId, {
        origem: orig.trim() || null,
        marcasConcorrentes: mc.split(",").map((s) => s.trim()).filter(Boolean),
        produtosVendidos: pv.split(",").map((s) => s.trim()).filter(Boolean),
      } as never);
      if (r.ok) { toast.success("Inteligência atualizada"); setEdit(false); }
      else toast.error(r.error || "Falha");
    });
  }

  return (
    <section className="bg-gradient-to-br from-[#FFF9F0] to-white border border-[#FFB300]/30 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#D4541A]" />
          Inteligência do lead
        </h2>
        {!edit ? (
          <button onClick={() => setEdit(true)} className="text-xs text-[#0D0D0D] hover:underline">editar</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={salvar} disabled={pending} className="text-xs bg-[#0D0D0D] text-white px-3 py-1 rounded disabled:opacity-50">
              {pending ? "..." : "salvar"}
            </button>
            <button onClick={() => { setEdit(false); setOrig(origem ?? ""); setMc((marcasConcorrentes ?? []).join(", ")); setPv((produtosVendidos ?? []).join(", ")); }} className="text-xs text-[#6B6B6B]">cancelar</button>
          </div>
        )}
      </div>

      {!edit ? (
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-[#6B6B6B]">Origem do lead</dt>
            <dd className="font-medium">{origem || <span className="italic text-[#6B6B6B]">— não registrado</span>}</dd>
          </div>
          <div>
            <dt className="text-[#6B6B6B]">Marcas concorrentes na gôndola</dt>
            <dd>
              {(marcasConcorrentes ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {marcasConcorrentes!.map((m) => (
                    <span key={m} className="bg-white border border-[#E5E2DC] px-2 py-0.5 rounded text-[10px]">{m}</span>
                  ))}
                </div>
              ) : <span className="italic text-[#6B6B6B]">— não registrado</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[#6B6B6B]">Produtos que já vende</dt>
            <dd>
              {(produtosVendidos ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {produtosVendidos!.map((p) => (
                    <span key={p} className="bg-white border border-[#E5E2DC] px-2 py-0.5 rounded text-[10px]">{p}</span>
                  ))}
                </div>
              ) : <span className="italic text-[#6B6B6B]">— não registrado</span>}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-[#6B6B6B] mb-1">Origem (indicação? prospecção? inbound?)</label>
            <input value={orig} onChange={(e) => setOrig(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" placeholder="ex: indicação da nutricionista X" />
          </div>
          <div>
            <label className="block text-xs text-[#6B6B6B] mb-1">Marcas concorrentes (separadas por vírgula)</label>
            <input value={mc} onChange={(e) => setMc(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" placeholder="Guday, Vitao, Bionature" />
          </div>
          <div>
            <label className="block text-xs text-[#6B6B6B] mb-1">Produtos que já vende</label>
            <input value={pv} onChange={(e) => setPv(e.target.value)} className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white" placeholder="creatina, whey, colágeno" />
          </div>
        </div>
      )}
    </section>
  );
}
