"use client";
import { useState, useTransition } from "react";
import { criarContato } from "@/app/actions/contas";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export function AdicionarContato({ contaId, jaTemPrincipal }: { contaId: number; jaTemPrincipal: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-[#D4541A] hover:text-[#BF360C] flex items-center gap-1">
        <UserPlus className="w-3 h-3" /> adicionar
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await criarContato(contaId, {
                  nome: String(fd.get("nome") || ""),
                  cargo: String(fd.get("cargo") || "") || null,
                  email: String(fd.get("email") || "") || null,
                  telefone: String(fd.get("telefone") || "") || null,
                  whatsapp: String(fd.get("whatsapp") || "") || null,
                  papel: String(fd.get("papel") || "outro"),
                  ePrincipal: fd.get("ePrincipal") === "on",
                });
                if (r.ok) { toast.success("Contato adicionado"); setOpen(false); }
                else toast.error(r.error || "Falha");
              });
            }}
            className="bg-white rounded-lg p-6 w-[480px] space-y-3"
          >
            <h3 className="font-bold text-lg" style={{ fontFamily: "'Alias Extended', sans-serif" }}>Novo contato</h3>
            <input name="nome" required placeholder="Nome completo *" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm" />
            <input name="cargo" placeholder="Cargo (ex: Comprador)" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="telefone" placeholder="Telefone" className="px-2 py-1.5 border border-[#E5E2DC] rounded text-sm" />
              <input name="whatsapp" placeholder="WhatsApp" className="px-2 py-1.5 border border-[#E5E2DC] rounded text-sm" />
            </div>
            <input name="email" type="email" placeholder="Email" className="w-full px-2 py-1.5 border border-[#E5E2DC] rounded text-sm" />
            <div className="grid grid-cols-2 gap-2 items-center">
              <select name="papel" className="px-2 py-1.5 border border-[#E5E2DC] rounded text-sm bg-white">
                <option value="decisor">Decisor</option>
                <option value="gatekeeper">Gatekeeper</option>
                <option value="outro">Outro</option>
              </select>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" name="ePrincipal" defaultChecked={!jaTemPrincipal} disabled={jaTemPrincipal} className="accent-[#D4541A]" />
                {jaTemPrincipal ? "(já existe principal)" : "Marcar como principal"}
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-[#E5E2DC]">
              <button type="button" onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded border border-[#E5E2DC]">cancelar</button>
              <button type="submit" disabled={isPending} className="text-sm px-4 py-1.5 rounded bg-[#0D0D0D] text-white">salvar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
