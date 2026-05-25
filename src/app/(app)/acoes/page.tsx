import { auth } from "@/auth";
import { getAcoesDaPessoa, getFriosDaPessoa, type AcaoListagem } from "@/app/actions/contas";
import { CardAcao } from "./_components/card-acao";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PESSOA_LABEL: Record<string, string> = {
  gabriel: "Gabriel",
  yasmin: "Yasmin",
  gabi: "Gabi",
};

export default async function AcoesPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "gabriel";
  const sp = await searchParams;
  const pessoa = sp.p ?? userId;

  const acoes = await getAcoesDaPessoa(pessoa);
  const friosLimite = Math.max(0, 20 - acoes.length); // sempre tenta totalizar 20
  const frios: AcaoListagem[] = friosLimite > 0 ? await getFriosDaPessoa(pessoa, friosLimite) : [];

  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = acoes.filter((a) => a.dataPrevista < hoje);
  const hojeAcoes = acoes.filter((a) => a.dataPrevista === hoje);
  const proximas = acoes.filter((a) => a.dataPrevista > hoje);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
          Minhas ações
        </h1>
        <p className="text-sm text-[#6B6B6B]">
          <span className="font-medium">{PESSOA_LABEL[pessoa] ?? pessoa}</span>
          {atrasadas.length > 0 && <span className="text-[#BF360C]"> · {atrasadas.length} atrasadas</span>}
          {hojeAcoes.length > 0 && <span className="text-[#D4541A]"> · {hojeAcoes.length} hoje</span>}
          {frios.length > 0 && <span> · {frios.length} frios pra abordar</span>}
        </p>
        {(session?.user as { role?: string })?.role === "admin" && (
          <div className="flex gap-1 mt-3 text-xs">
            {Object.entries(PESSOA_LABEL).map(([id, lbl]) => (
              <Link key={id} href={`/acoes?p=${id}`} className={`px-2 py-1 rounded border ${pessoa === id ? "bg-[#0D0D0D] text-white border-[#0D0D0D]" : "bg-white border-[#E5E2DC] hover:bg-[#F2F0EC]"}`}>
                {lbl}
              </Link>
            ))}
          </div>
        )}
      </header>

      {atrasadas.length > 0 && (
        <Section titulo="⚠️ Atrasadas" cor="text-[#BF360C]" count={atrasadas.length}>
          {atrasadas.map((a) => <CardAcao key={`a${a.interacaoId}`} acao={a} />)}
        </Section>
      )}
      {hojeAcoes.length > 0 && (
        <Section titulo="🔥 Hoje" cor="text-[#D4541A]" count={hojeAcoes.length}>
          {hojeAcoes.map((a) => <CardAcao key={`h${a.interacaoId}`} acao={a} />)}
        </Section>
      )}
      {proximas.length > 0 && (
        <Section titulo="📅 Próximos dias" cor="text-[#0091EA]" count={proximas.length}>
          {proximas.map((a) => <CardAcao key={`p${a.interacaoId}`} acao={a} />)}
        </Section>
      )}
      {frios.length > 0 && (
        <Section titulo="❄️ Frios — primeira abordagem" cor="text-[#6B6B6B]" count={frios.length}>
          {frios.map((f) => <CardAcao key={`f${f.contaId}`} acao={f} />)}
        </Section>
      )}

      {acoes.length === 0 && frios.length === 0 && (
        <div className="text-center py-20 bg-white border-2 border-[#00897B]/30 rounded-lg">
          <div className="text-6xl mb-3">🎉</div>
          <div className="font-bold">Tudo zerado!</div>
          <p className="text-sm text-[#6B6B6B] mt-1">Sem ações pendentes nem frios atribuídos a você.</p>
        </div>
      )}
    </div>
  );
}

function Section({ titulo, cor, count, children }: { titulo: string; cor: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className={`text-sm font-bold uppercase tracking-wider ${cor} mb-3`}>
        {titulo} ({count})
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
