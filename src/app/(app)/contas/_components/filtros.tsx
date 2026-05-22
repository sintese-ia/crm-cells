"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { FUNIL_LABEL, CANAL_LABEL } from "@/lib/labels";

export function ContasFiltros({
  canais,
  funilStages,
  temperaturas,
  responsaveis,
}: {
  canais: readonly string[];
  funilStages: readonly string[];
  temperaturas: readonly string[];
  responsaveis: readonly string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/contas?${params.toString()}`);
  };

  const ativo = (key: string, value: string) =>
    sp.get(key) === value
      ? "bg-zinc-900 text-white"
      : "bg-white text-zinc-700 hover:bg-zinc-100";

  return (
    <div className="mb-4 space-y-3">
      <input
        type="search"
        defaultValue={sp.get("busca") || ""}
        onChange={(e) => set("busca", e.target.value)}
        placeholder="Buscar nome, razão social, CNPJ ou cidade…"
        className="w-full px-3 py-2 border rounded-md text-sm bg-white"
      />
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-zinc-500 mr-2">Funil:</span>
        <button
          onClick={() => set("funil", "")}
          className={`text-xs px-2 py-1 rounded border ${ativo("funil", "")}`}
        >
          Todos
        </button>
        {funilStages.map((s) => (
          <button
            key={s}
            onClick={() => set("funil", s)}
            className={`text-xs px-2 py-1 rounded border ${ativo("funil", s)}`}
          >
            {FUNIL_LABEL[s] || s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-zinc-500 mr-2">Canal:</span>
        <button
          onClick={() => set("canal", "")}
          className={`text-xs px-2 py-1 rounded border ${ativo("canal", "")}`}
        >
          Todos
        </button>
        {canais.map((c) => (
          <button
            key={c}
            onClick={() => set("canal", c)}
            className={`text-xs px-2 py-1 rounded border ${ativo("canal", c)}`}
          >
            {CANAL_LABEL[c] || c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-zinc-500">Resp:</span>
          <select
            defaultValue={sp.get("resp") || ""}
            onChange={(e) => set("resp", e.target.value)}
            className="text-xs px-2 py-1 border rounded bg-white"
          >
            <option value="">Todos</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-zinc-500">Temp:</span>
          <select
            defaultValue={sp.get("temp") || ""}
            onChange={(e) => set("temp", e.target.value)}
            className="text-xs px-2 py-1 border rounded bg-white"
          >
            <option value="">Todas</option>
            {temperaturas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-zinc-500">UF:</span>
          <input
            defaultValue={sp.get("uf") || ""}
            onChange={(e) => set("uf", e.target.value)}
            placeholder="SP"
            maxLength={2}
            className="text-xs px-2 py-1 border rounded w-12 bg-white uppercase"
          />
        </div>
      </div>
    </div>
  );
}
