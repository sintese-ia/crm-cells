import { headers } from "next/headers";

async function getCsrfToken(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const res = await fetch(`${proto}://${host}/api/auth/csrf`, { cache: "no-store" });
  const data = await res.json();
  return data.csrfToken as string;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const csrfToken = await getCsrfToken();
  const callbackUrl = sp?.callbackUrl || "/fila";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EC]">
      <form
        action="/api/auth/callback/credentials"
        method="POST"
        className="w-[400px] bg-white rounded-lg border border-[#E5E2DC] p-10 shadow-sm"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="senha" value="ignored" />
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-md bg-[#D4541A] flex items-center justify-center text-white font-bold" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              CELLS · CRM
            </h1>
            <p className="text-xs text-[#6B6B6B] uppercase tracking-wider">B2B operação</p>
          </div>
        </div>
        <label className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-1.5 block">Quem é você?</label>
        <select
          name="email"
          required
          defaultValue="gabriel@cells.com.br"
          className="w-full mb-6 px-3 py-2.5 border border-[#E5E2DC] rounded-md text-sm focus:outline-none focus:border-[#D4541A] bg-white"
        >
          <option value="gabriel@cells.com.br">Gabriel</option>
          <option value="yasmin@cells.com.br">Yasmin</option>
          <option value="gabrieli@cells.com.br">Gabi</option>
        </select>
        <button
          type="submit"
          className="w-full bg-[#0D0D0D] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[#1A1A1A] transition-colors"
        >
          Entrar
        </button>
        {sp?.error ? (
          <p className="text-[#D4541A] text-xs mt-3 text-center">Erro de login — tenta de novo</p>
        ) : null}
      </form>
    </div>
  );
}
