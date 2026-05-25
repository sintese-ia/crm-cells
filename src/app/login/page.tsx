"use client";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [csrf, setCsrf] = useState<string>("");
  const [callbackUrl, setCallbackUrl] = useState<string>("/fila");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("error")) setErro("Erro de login — tenta de novo");
    if (sp.get("callbackUrl")) setCallbackUrl(sp.get("callbackUrl") as string);
    // Fetch csrf NO CLIENT — assim o cookie csrf vai pro browser do user
    // (server-side fetch não propaga cookies pro browser)
    fetch("/api/auth/csrf", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCsrf(d.csrfToken));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EC]">
      <form
        action="/api/auth/callback/credentials"
        method="POST"
        className="w-[400px] bg-white rounded-lg border border-[#E5E2DC] p-10 shadow-sm"
      >
        <input type="hidden" name="csrfToken" value={csrf} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="senha" value="ignored" />
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-md bg-[#D4541A] flex items-center justify-center text-white font-bold"
            style={{ fontFamily: "'Alias Extended', sans-serif" }}
          >
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
          disabled={!csrf}
          className="w-full bg-[#0D0D0D] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
        >
          {csrf ? "Entrar" : "carregando..."}
        </button>
        {erro && <p className="text-[#D4541A] text-xs mt-3 text-center">{erro}</p>}
      </form>
    </div>
  );
}
