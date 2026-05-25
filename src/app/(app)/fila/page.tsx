import { auth } from "@/auth";
import { getProximoCard, adiarAcao } from "@/app/actions/contas";
import { FilaCard } from "./_components/fila-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FilaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; skip?: string; adiar1d?: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "gabriel";
  const sp = await searchParams;

  // ?p= pra trocar de pessoa (admin testando fila do outro)
  const pessoa = sp.p ?? userId;

  // Processa "adiar +1d" passado via querystring (do botão pular)
  if (sp.adiar1d) {
    const acaoId = parseInt(sp.adiar1d);
    if (!isNaN(acaoId)) {
      try { await adiarAcao(acaoId, 1); } catch {}
    }
  }

  // Pulados da sessão (querystring "skip=1,2,3")
  const pulados = sp.skip
    ? sp.skip.split(",").map(Number).filter((n) => !isNaN(n))
    : [];

  const card = await getProximoCard(pessoa, pulados);

  return (
    <div className="min-h-screen bg-[#F2F0EC]">
      {/* Header curto */}
      <header className="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            Fila do Dia
          </h1>
          <p className="text-xs text-[#6B6B6B]">
            {pessoa === "gabriel" ? "Gabriel" : pessoa === "yasmin" ? "Yasmin" : pessoa === "gabi" ? "Gabi" : pessoa}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link href="/equipe" className="text-[#6B6B6B] hover:text-[#0D0D0D] underline">visão completa</Link>
        </div>
      </header>

      {card ? (
        <FilaCard card={card} />
      ) : (
        <div className="max-w-2xl mx-auto px-4 pt-20 text-center">
          <div className="bg-white rounded-2xl border-2 border-[#00897B] p-12">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              Fila zerada!
            </h2>
            <p className="text-sm text-[#6B6B6B]">
              Sem ações pendentes nem leads pra abordar agora.
            </p>
            {pulados.length > 0 && (
              <Link href="/fila" className="inline-block mt-4 text-xs px-4 py-2 bg-[#0D0D0D] text-white rounded">
                limpar {pulados.length} pulada{pulados.length > 1 ? "s" : ""} e reiniciar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
