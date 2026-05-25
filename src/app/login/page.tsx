"use client";
import { useState } from "react";

export default function LoginPage() {
  const [pessoa, setPessoa] = useState("gabriel@cells.com.br");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      // 1) Busca csrf — cookie csrf cai no browser nesse fetch
      const csrfRes = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "same-origin" });
      const { csrfToken } = await csrfRes.json();

      // 2) POST com csrf + email (cookie csrf segue automático via credentials: same-origin)
      const body = new URLSearchParams({
        csrfToken,
        email: pessoa,
        senha: "ignored",
        callbackUrl: "/fila",
      });
      const r = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        credentials: "same-origin",
        redirect: "manual",
      });
      // Auth.js sempre retorna 302 mesmo em erro — checar o Location
      if (r.type === "opaqueredirect" || r.status === 302 || r.status === 0) {
        // Login bem-sucedido (ou redirect tratado)
        window.location.href = "/fila";
      } else {
        const txt = await r.text();
        setErro(`Falha (HTTP ${r.status}): ${txt.slice(0, 100)}`);
        setLoading(false);
      }
    } catch (e) {
      setErro((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EC]">
      <form
        onSubmit={entrar}
        className="w-[400px] bg-white rounded-lg border border-[#E5E2DC] p-10 shadow-sm"
      >
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
          value={pessoa}
          onChange={(e) => setPessoa(e.target.value)}
          required
          className="w-full mb-6 px-3 py-2.5 border border-[#E5E2DC] rounded-md text-sm focus:outline-none focus:border-[#D4541A] bg-white"
        >
          <option value="gabriel@cells.com.br">Gabriel</option>
          <option value="yasmin@cells.com.br">Yasmin</option>
          <option value="gabrieli@cells.com.br">Gabi</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0D0D0D] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
        >
          {loading ? "entrando..." : "Entrar"}
        </button>
        {erro && <p className="text-[#D4541A] text-xs mt-3 text-center break-words">{erro}</p>}
      </form>
    </div>
  );
}
