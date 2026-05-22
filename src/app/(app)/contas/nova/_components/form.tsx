"use client";
import { useTransition } from "react";
import { criarConta } from "@/app/actions/contas";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function FormNovaConta({
  canais,
  responsaveis,
  canalLabel,
}: {
  canais: readonly string[];
  responsaveis: readonly string[];
  canalLabel: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await criarConta({
            nome: String(fd.get("nome") || ""),
            razaoSocial: String(fd.get("razaoSocial") || "") || null,
            cnpj: String(fd.get("cnpj") || "").replace(/\D/g, "") || null,
            canal: String(fd.get("canal") || "outros"),
            cidade: String(fd.get("cidade") || "") || null,
            uf: String(fd.get("uf") || "").toUpperCase() || null,
            telefone: String(fd.get("telefone") || "") || null,
            whatsapp: String(fd.get("whatsapp") || "") || null,
            email: String(fd.get("email") || "") || null,
            site: String(fd.get("site") || "") || null,
            responsavel: String(fd.get("responsavel") || "gabriel"),
            contato: fd.get("contatoNome")
              ? {
                  nome: String(fd.get("contatoNome") || ""),
                  cargo: String(fd.get("contatoCargo") || "Comprador") || "Comprador",
                  telefone: String(fd.get("contatoTelefone") || "") || null,
                  email: String(fd.get("contatoEmail") || "") || null,
                  whatsapp: String(fd.get("contatoWhatsapp") || "") || null,
                }
              : undefined,
          });
          if (r.ok && r.contaId) {
            toast.success("Conta criada!");
            router.push(`/contas/${r.contaId}`);
          } else {
            toast.error(r.error || "Falha");
          }
        });
      }}
      className="bg-white border border-[#E5E2DC] rounded-lg p-6 space-y-4"
    >
      <h2 className="font-bold text-sm uppercase tracking-wider text-[#6B6B6B]">Dados institucionais</h2>

      <div>
        <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Nome / Nome Fantasia *</label>
        <input name="nome" required className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Razão Social</label>
          <input name="razaoSocial" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">CNPJ</label>
          <input name="cnpj" placeholder="00.000.000/0000-00" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Cidade</label>
          <input name="cidade" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">UF</label>
          <input name="uf" maxLength={2} className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm uppercase" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Telefone</label>
          <input name="telefone" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">WhatsApp</label>
          <input name="whatsapp" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Email</label>
          <input name="email" type="email" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Site</label>
          <input name="site" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Canal *</label>
          <select name="canal" required defaultValue="outros" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm bg-white">
            {canais.map((c) => <option key={c} value={c}>{canalLabel[c] || c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Responsável *</label>
          <select name="responsavel" required defaultValue="gabriel" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm bg-white">
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <hr className="border-[#E5E2DC]" />

      <h2 className="font-bold text-sm uppercase tracking-wider text-[#6B6B6B]">Comprador principal (opcional)</h2>

      <div>
        <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Nome do comprador</label>
        <input name="contatoNome" placeholder="Deixar vazio se não tem ainda" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Cargo</label>
          <input name="contatoCargo" defaultValue="Comprador" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Telefone</label>
          <input name="contatoTelefone" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">WhatsApp</label>
          <input name="contatoWhatsapp" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider">Email</label>
          <input name="contatoEmail" type="email" className="w-full px-2 py-2 border border-[#E5E2DC] rounded text-sm" />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-[#E5E2DC]">
        <button type="button" onClick={() => router.back()} className="text-sm px-4 py-2 rounded border border-[#E5E2DC]">cancelar</button>
        <button type="submit" disabled={isPending} className="text-sm px-5 py-2 rounded bg-[#0D0D0D] text-white disabled:opacity-50">
          {isPending ? "salvando..." : "criar conta"}
        </button>
      </div>
    </form>
  );
}
