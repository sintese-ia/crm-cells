import { STATUS_HOMOLOGACAO_LABEL } from "@/db/schema";

const STATUS_COLOR: Record<string, string> = {
  pendente_inicio: "bg-[#7c3aed] text-white",
  docs_enviados: "bg-[#FFB300] text-[#0D0D0D]",
  em_analise: "bg-[#0091EA] text-white",
  aprovada: "bg-[#00897B] text-white",
  reprovada: "bg-[#BF360C] text-white",
};

const STATUS_ICON: Record<string, string> = {
  pendente_inicio: "🔒",
  docs_enviados: "📄",
  em_analise: "🔍",
  aprovada: "✅",
  reprovada: "🚫",
};

export function HomologacaoBadge({
  requer,
  status,
  size = "sm",
}: {
  requer: boolean;
  status: string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!requer) return null;
  const s = status ?? "pendente_inicio";
  const label = STATUS_HOMOLOGACAO_LABEL[s] || s;
  const color = STATUS_COLOR[s] || "bg-[#6B6B6B] text-white";
  const icon = STATUS_ICON[s] || "🛂";
  const cls =
    size === "md"
      ? "text-xs px-2 py-0.5 rounded"
      : "text-[10px] px-1.5 rounded";
  return (
    <span className={`${cls} ${color} inline-flex items-center gap-0.5 whitespace-nowrap`} title={`Homologação: ${label}`}>
      {icon} homol·{s === "pendente_inicio" ? "iniciar" : s === "docs_enviados" ? "docs" : s === "em_analise" ? "análise" : s === "aprovada" ? "ok" : "reprov"}
    </span>
  );
}
