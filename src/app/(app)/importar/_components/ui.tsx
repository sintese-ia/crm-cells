"use client";
import { useState, useTransition } from "react";
import { importarMasterPlanilha } from "@/app/actions/importar";
import { toast } from "sonner";

export function ImportarUI() {
  const [resultado, setResultado] = useState<{
    novos: number;
    atualizados: number;
    pulados: number;
    erros: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dryRun, setDryRun] = useState(true);

  const rodar = () => {
    startTransition(async () => {
      const r = await importarMasterPlanilha(dryRun);
      if (r.ok) {
        setResultado(r.data);
        toast.success(
          dryRun
            ? "Simulação completa — confira os números antes de gravar"
            : `Import OK — ${r.data.novos} novos, ${r.data.atualizados} atualizados`
        );
      } else {
        toast.error(r.error || "Falha");
      }
    });
  };

  return (
    <div className="bg-white border border-[#E5E2DC] rounded-lg p-6">
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Fonte</h2>
        <p className="text-sm text-[#6B6B6B] mb-2">
          MASTER da planilha B2B Cells (ID{" "}
          <code className="text-xs">1jXBvqGtCIM…sxnc</code>) — 2006 linhas.
        </p>
        <p className="text-xs text-[#6B6B6B]">
          Match por CNPJ → Razão Social. Inclui Status_email, Resultado, Próximo
          passo, Notas e Estágio_funil (das 4 campanhas migradas hoje).
        </p>
      </div>

      <div className="mb-6 p-4 rounded-md bg-[#F2F0EC] border border-[#E5E2DC]">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="accent-[#D4541A]"
          />
          <span className="font-medium">Modo simulação</span>
          <span className="text-xs text-[#6B6B6B]">
            (mostra contagem sem gravar)
          </span>
        </label>
      </div>

      <button
        onClick={rodar}
        disabled={isPending}
        className="bg-[#0D0D0D] text-white text-sm px-5 py-2.5 rounded-md hover:bg-[#1A1A1A] disabled:opacity-50"
      >
        {isPending
          ? "Processando..."
          : dryRun
          ? "Rodar simulação"
          : "Importar pro Postgres"}
      </button>

      {resultado && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="border border-[#E5E2DC] rounded p-4">
            <div className="text-xs text-[#6B6B6B] mb-1 uppercase tracking-wider">
              Novos
            </div>
            <div className="text-2xl font-bold text-[#00897B]">
              {resultado.novos}
            </div>
          </div>
          <div className="border border-[#E5E2DC] rounded p-4">
            <div className="text-xs text-[#6B6B6B] mb-1 uppercase tracking-wider">
              Atualizados
            </div>
            <div className="text-2xl font-bold text-[#D4541A]">
              {resultado.atualizados}
            </div>
          </div>
          <div className="border border-[#E5E2DC] rounded p-4">
            <div className="text-xs text-[#6B6B6B] mb-1 uppercase tracking-wider">
              Pulados
            </div>
            <div className="text-2xl font-bold text-[#6B6B6B]">
              {resultado.pulados}
            </div>
          </div>
          {resultado.erros.length > 0 && (
            <div className="col-span-3 mt-2">
              <div className="text-xs font-medium text-[#BF360C] mb-2">
                {resultado.erros.length} erro(s):
              </div>
              <ul className="text-xs text-[#BF360C] list-disc list-inside max-h-40 overflow-auto">
                {resultado.erros.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
