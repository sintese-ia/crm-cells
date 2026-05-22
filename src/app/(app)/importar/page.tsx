import { ImportarUI } from "./_components/ui";

export default function ImportarPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Importar leads</h1>
      <p className="text-sm text-[#6B6B6B] mb-6">
        Puxa contas da planilha MASTER do Google Sheets e dá upsert em <code>b2b.conta</code>.
      </p>
      <ImportarUI />
    </div>
  );
}
