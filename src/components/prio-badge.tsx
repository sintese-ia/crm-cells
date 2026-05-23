export function PrioBadge({
  manual,
  calc,
  size = "sm",
}: {
  manual?: string | null;
  calc?: string | null;
  size?: "sm" | "md";
}) {
  const prio = manual || calc;
  if (!prio || prio === "baixa") return null;

  const labels: Record<string, { label: string; cor: string }> = {
    alta: { label: "🔥 Alta", cor: "bg-[#D4541A] text-white" },
    media: { label: "🟠 Média", cor: "bg-[#FFB300] text-[#0D0D0D]" },
    descartar: { label: "❌ Descartar", cor: "bg-[#6B6B6B] text-white" },
  };
  const info = labels[prio];
  if (!info) return null;

  const cls = size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span className={`inline-block rounded font-medium ${cls} ${info.cor}`} title={manual ? "Prioridade manual" : "Calculado automaticamente"}>
      {info.label}
      {manual && <span className="ml-1 opacity-70">(manual)</span>}
    </span>
  );
}

export function priorityRank(prio?: string | null) {
  switch (prio) {
    case "alta": return 0;
    case "media": return 1;
    case "baixa": return 2;
    case "descartar": return 3;
    default: return 4;
  }
}
