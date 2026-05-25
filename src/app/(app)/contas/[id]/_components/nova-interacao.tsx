"use client";
import { useState, useTransition, useMemo } from "react";
import { criarInteracao } from "@/app/actions/contas";
import { TIPOS_INTERACAO, type Contato, type Situacao } from "@/db/schema";
import { toast } from "sonner";

export function NovaInteracao({
  contaId,
  contatos,
  situacoes,
}: {
  contaId: number;
  contatos: Contato[];
  situacoes: Situacao[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState("ligacao");
  const [situacaoId, setSituacaoId] = useState<string>("");

  // Filtrar situações por estágio relevante ao tipo
  const situacoesPorEstagio = useMemo(() => {
    const groups: Record<string, Situacao[]> = {};
    for (const s of situacoes) {
      if (!groups[s.estagio]) groups[s.estagio] = [];
      groups[s.estagio].push(s);
    }
    return groups;
  }, [situacoes]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-[#D4541A] text-white px-3 py-1.5 rounded hover:bg-[#BF360C] font-medium"
      >
        + nova interação
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await criarInteracao(contaId, {
                  tipo,
                  situacaoId: situacaoId || null,
                  texto: String(fd.get("texto") || ""),
                  contatoId: fd.get("contatoId") ? Number(fd.get("contatoId")) : null,
                  dataPersonalizada: (fd.get("dataPersonalizada") as string) || null,
                });
                if (r.ok) {
                  let msg = "Interação registrada";
                  if (r.acaoCriada) msg += ` · próxima: ${r.acaoCriada.descricao}`;
                  if (r.funilMovido) msg += ` · funil: ${r.funilMovido.de}→${r.funilMovido.para}`;
                  toast.success(msg);
                  setOpen(false);
                } else {
                  toast.error(r.error || "Falha");
                }
              });
            }}
            className="bg-white rounded-lg p-6 w-[560px] max-h-[90vh] overflow-auto space-y-3"
          >
            <h3 className="font-bold text-lg" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              Nova interação
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Tipo</label>
                <select
                  name="tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  required
                  className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white"
                >
                  {TIPOS_INTERACAO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {contatos.length > 0 && (
                <div>
                  <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Com quem (opcional)</label>
                  <select name="contatoId" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white">
                    <option value="">—</option>
                    {contatos.map((c) => (
                      <option key={c.contatoId} value={c.contatoId}>
                        {c.nome} {c.cargo ? `(${c.cargo})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">
                Situação <span className="text-[#D4541A]">*</span>
              </label>
              <select
                name="situacaoId"
                value={situacaoId}
                onChange={(e) => setSituacaoId(e.target.value)}
                required
                className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white"
              >
                <option value="">— selecione a situação —</option>
                {Object.entries(situacoesPorEstagio).map(([estagio, sits]) => (
                  <optgroup key={estagio} label={
                    {
                      primeiro_contato: "Primeiro contato",
                      reuniao_marcada: "Reunião marcada",
                      pos_reuniao: "Pós-reunião",
                      cliente_ativo: "Cliente ativo",
                      parado: "Parado / exceções",
                    }[estagio] ?? estagio
                  }>
                    {sits.map((s) => (
                      <option key={s.situacaoId} value={s.situacaoId}>
                        {s.icon} {s.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Todas as situações disponíveis (filosofia GPS: pode pular etapas).
                A situação determina a próxima ação automática.
              </p>
            </div>

            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">O que aconteceu (opcional)</label>
              <textarea
                name="texto"
                rows={3}
                placeholder="Detalhes: o que falou, próximos passos combinados, etc"
                className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">
                Data manual da próxima ação (opcional)
              </label>
              <input
                type="date"
                name="dataPersonalizada"
                className="px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white"
              />
              <p className="text-xs text-[#6B6B6B] mt-1">
                Vazio = sistema calcula pela regra. Data futura = ação aparece na fila no dia.
                Data passada = registro retroativo.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[#E5E2DC]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]"
              >
                cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !situacaoId}
                className="text-sm px-4 py-1.5 rounded bg-[#0D0D0D] text-white disabled:opacity-50"
              >
                {isPending ? "salvando..." : "salvar interação"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
