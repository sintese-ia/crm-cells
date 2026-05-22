import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EC]">
      <form
        action={async (formData: FormData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              senha: formData.get("senha"),
              redirectTo: "/contas",
            });
          } catch (e) {
            const msg = (e as Error).message;
            if (msg === "NEXT_REDIRECT") throw e;
            redirect("/login?error=1");
          }
        }}
        className="w-[400px] bg-white rounded-lg border border-[#E5E2DC] p-10 shadow-sm"
      >
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
        <label className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-1.5 block">Email</label>
        <input
          name="email"
          type="email"
          placeholder="seu@cells.com.br"
          required
          className="w-full mb-4 px-3 py-2.5 border border-[#E5E2DC] rounded-md text-sm focus:outline-none focus:border-[#D4541A]"
          defaultValue="gabriel@cells.com.br"
        />
        <label className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-1.5 block">Senha</label>
        <input
          name="senha"
          type="password"
          placeholder="••••••••"
          required
          className="w-full mb-6 px-3 py-2.5 border border-[#E5E2DC] rounded-md text-sm focus:outline-none focus:border-[#D4541A]"
        />
        <button
          type="submit"
          className="w-full bg-[#0D0D0D] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[#1A1A1A] transition-colors"
        >
          Entrar
        </button>
        {sp?.error ? (
          <p className="text-[#D4541A] text-xs mt-3 text-center">Email ou senha inválidos</p>
        ) : null}
      </form>
    </div>
  );
}
