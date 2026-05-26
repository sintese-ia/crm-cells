"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { criarInteracao, adiarAcao, type AcaoListagem } from "@/app/actions/contas";
import { toast } from "sonner";
import { Phone, MessageCircle, ExternalLink } from "lucide-react";

const SITUACOES_PADRAO = [
  { sit: "lig_atendeu",        label: "✓ Atendeu",     tipo: "ligacao",  cor: "bg-[#00897B] text-white" },
  { sit: "lig_nao_atendeu",    label: "Não atendeu",   tipo: "ligacao",  cor: "bg-[#FFB300] text-[#0D0D0D]" },
  { sit: "wa_respondeu",       label: "WA respondeu",  tipo: "whatsapp", cor: "bg-[#00897B] text-white" },
  { sit: "wa_nao_respondeu",   label: "WA sem resp",   tipo: "whatsapp", cor: "bg-[#FFB300] text-[#0D0D0D]" },
];

export function CardAcao({ acao }: { acao: AcaoListagem }) {
  const [pending, start] = useTransition();
  const [expandido, setExpandido] = useState(false);

  const tel = acao.tel?.replace(/\D/g, "");
  const wa = (acao.wa || acao.tel)?.replace(/\D/g, "");
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasada = acao.dataPrevista < hoje;
  const ehHoje = acao.dataPrevista === hoje;
  const corBorda = atrasada ? "border-[#BF360C]" : ehHoje ? "border-[#D4541A]" : "border-[#E5E2DC]";

  async function registrar(sit: string, tipo: string, label: string) {
    start(async () => {
      const r = await criarInteracao(acao.contaId, {
        tipo, situacaoId: sit, texto: `Quick log: ${label}`,
        respondendoInteracaoId: acao.interacaoId > 0 ? acao.interacaoId : null,
      });
      if (r.ok) {
        const msg = r.proximaAcao ? `${label} · próx: ${r.proximaAcao.descricao}` : label;
        toast.success(msg);
      } else toast.error(r.error || "Falha");
    });
  }

  return (
    <div className={`bg-white border-2 ${corBorda} rounded-lg p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <Link href={`/contas/${acao.contaId}`} className="font-semibold hover:underline text-[#0D0D0D]">
            {acao.contaNome}
          </Link>
          <div className="text-xs text-[#6B6B6B] mt-0.5 flex flex-wrap gap-x-2">
            {acao.cidade && <span>📍 {acao.cidade}/{acao.uf}</span>}
            {acao.contatoPrincipal && <span>· 👤 {acao.contatoPrincipal}</span>}
          </div>
        </div>
        <Link href={`/contas/${acao.contaId}`} className="text-[10px] text-[#6B6B6B] hover:text-[#D4541A] flex items-center gap-0.5 whitespace-nowrap">
          abrir <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="bg-[#F2F0EC] rounded p-2 mb-3 text-sm">
        <strong>{acao.descricao || acao.tipo}</strong>
        <span className="ml-2 text-xs text-[#6B6B6B]">
          {atrasada ? "⚠️ atrasada · " : ehHoje ? "🔥 hoje · " : ""}
          {new Date(acao.dataPrevista + "T12:00").toLocaleDateString("pt-BR")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {tel && (
          <a href={`tel:+55${tel}`} className="text-xs px-3 py-1.5 rounded bg-[#0D0D0D] text-white hover:bg-[#1A1A1A] flex items-center gap-1">
            <Phone className="w-3 h-3" /> Ligar
          </a>
        )}
        {wa && (
          <a href={`https://wa.me/55${wa}`} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded bg-[#25D366] text-white hover:opacity-90 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </a>
        )}
        <span className="text-[#E5E2DC] mx-1">|</span>
        {!expandido ? (
          <button onClick={() => setExpandido(true)} className="text-xs px-3 py-1.5 rounded bg-white border border-[#0D0D0D] text-[#0D0D0D] hover:bg-[#F2F0EC]">
            Registrar resultado
          </button>
        ) : (
          <>
            {SITUACOES_PADRAO.map((s) => (
              <button
                key={s.sit}
                disabled={pending}
                onClick={() => registrar(s.sit, s.tipo, s.label)}
                className={`text-xs px-2.5 py-1 rounded ${s.cor} hover:opacity-90 disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </>
        )}
        {acao.interacaoId > 0 && (
          <button
            disabled={pending}
            onClick={() => start(async () => { const r = await adiarAcao(acao.interacaoId, 1); if (r.ok) toast.info("Adiada +1d"); })}
            className="ml-auto text-xs px-2 py-1 text-[#6B6B6B] hover:text-[#0D0D0D]"
          >
            +1d
          </button>
        )}
      </div>
    </div>
  );
}
