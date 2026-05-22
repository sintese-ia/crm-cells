import { CANAIS, RESPONSAVEIS } from "@/db/schema";
import { CANAL_LABEL } from "@/lib/labels";
import { FormNovaConta } from "./_components/form";

export default function NovaContaPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
        Nova conta
      </h1>
      <p className="text-sm text-[#6B6B6B] mb-6">
        Cadastrar uma nova empresa B2B. Opcionalmente já cadastra o comprador principal.
      </p>
      <FormNovaConta
        canais={CANAIS as readonly string[]}
        responsaveis={RESPONSAVEIS as readonly string[]}
        canalLabel={CANAL_LABEL}
      />
    </div>
  );
}
