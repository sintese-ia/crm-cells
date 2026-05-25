"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { criarInteracao } from "@/app/actions/contas";
import { toast } from "sonner";
import { Phone, MessageCircle, ExternalLink } from "lucide-react";
import { detectarContexto, getOpcoes, COR_BTN } from "@/lib/contexto-fila";
import type { CardFila } from "@/app/actions/contas";

export function FilaCard({ card }: { card: CardFila }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const pulados = (params.get("skip") ?? "").split(",").filter(Boolean).map(Number);

  const contexto = detectarContexto({
    funilStage: card.funilStage,
    ultimaSituacao: card.ultimaSituacao,
    requerHomol: card.requerHomol,
    statusHomol: card.statusHomol,
    requerCad: card.requerCad,
    acaoTipo: card.acaoTipo,
    acaoDescricao: card.acaoDescricao,
  });
  const opcoes = getOpcoes(contexto);

  // Telefone/WhatsApp formatados
  const tel = card.tel?.replace(/\D/g, "");
  const wa = (card.wa || card.tel)?.replace(/\D/g, "");
  const waUrl = wa ? `https://wa.me/55${wa}` : null;
  const telUrl = tel ? `tel:+55${tel}` : null;

  const corBorda = card.origem === "atrasada" ? "border-[#BF360C]"
                  : card.origem === "em_risco" ? "border-[#FFB300]"
                  : card.origem === "hoje" ? "border-[#D4541A]"
                  : card.origem === "bloqueio" ? "border-[#7c3aed]"
                  : "border-[#0091EA]";

  const labelOrigem = {
    bloqueio:  { txt: "🛂 HOMOLOGAÇÃO/CADASTRO",  cor: "bg-[#7c3aed]" },
    atrasada:  { txt: "⚠️ ATRASADA",              cor: "bg-[#BF360C]" },
    em_risco:  { txt: "⚠️ EM RISCO",              cor: "bg-[#FFB300] text-[#0D0D0D]" },
    hoje:      { txt: "🔥 HOJE",                  cor: "bg-[#D4541A]" },
    proximo:   { txt: "📅 PRÓXIMO",               cor: "bg-[#0091EA]" },
    frio:      { txt: "❄️ FRIO — PRIMEIRA ABORDAGEM", cor: "bg-[#0091EA]" },
  }[card.origem];

  function navegarComSkip(extra?: { adiar1d?: number }) {
    const novosSkips = [...pulados, card.contaId].join(",");
    const url = new URL(window.location.href);
    url.searchParams.set("skip", novosSkips);
    if (extra?.adiar1d) url.searchParams.set("adiar1d", String(extra.adiar1d));
    else url.searchParams.delete("adiar1d");
    router.push(url.pathname + url.search);
  }

  function registrar(opt: typeof opcoes[number]) {
    start(async () => {
      const r = await criarInteracao(card.contaId, {
        tipo: opt.tipo,
        texto: `Quick log: ${opt.label}`,
        situacaoId: opt.sit,
      });
      if (r.ok) {
        const msg = r.acaoCriada
          ? `${opt.label} · próx ${r.acaoCriada.dias}d`
          : opt.label;
        toast.success(msg);
        navegarComSkip();
      } else {
        toast.error(r.error || "Falha");
      }
    });
  }

  function pular(modo: "fim_hoje" | "amanha") {
    if (modo === "fim_hoje") {
      toast.info("Pulado — volta no fim");
      navegarComSkip();
    } else if (card.acaoId) {
      // amanhã: adia ação existente
      navegarComSkip({ adiar1d: card.acaoId });
      toast.info("Adiado +1 dia");
    } else {
      toast.info("Pulado — sem ação pra adiar");
      navegarComSkip();
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-4 lg:pt-12 px-4">

      <div className={`bg-white rounded-2xl border-2 ${corBorda} shadow-lg overflow-hidden`}>
        {/* Header — origem */}
        <div className={`${labelOrigem.cor} text-white text-xs font-bold uppercase tracking-wider px-5 py-2`}>
          {labelOrigem.txt}
        </div>

        {/* Corpo */}
        <div className="p-6 lg:p-8">
          <div className="mb-4">
            <Link href={`/contas/${card.contaId}`} className="inline-flex items-center gap-1.5 text-[10px] text-[#6B6B6B] uppercase tracking-wider hover:text-[#D4541A]">
              ver detalhes <ExternalLink className="w-3 h-3" />
            </Link>
            <h1 className="text-2xl lg:text-3xl font-bold mt-1" style={{ fontFamily: "'Alias Extended', sans-serif" }}>
              {card.nome}
            </h1>
            <div className="text-sm text-[#6B6B6B] mt-1 flex flex-wrap gap-2">
              {card.cidade && <span>📍 {card.cidade}/{card.uf}</span>}
              {card.contatoPrincipal && <span>· 👤 {card.contatoPrincipal}</span>}
            </div>
          </div>

          {/* Por que agora */}
          <div className="bg-[#F2F0EC] rounded-lg p-3 mb-5">
            <div className="text-[10px] uppercase tracking-wider text-[#6B6B6B] mb-0.5">⟶ por que agora</div>
            <div className="text-sm font-medium">{card.porQue}</div>
            {card.ultimaInteracaoTexto && (
              <div className="text-xs text-[#6B6B6B] mt-1 italic">
                Última: "{card.ultimaInteracaoTexto.slice(0, 80)}{card.ultimaInteracaoTexto.length > 80 ? "…" : ""}"
                {card.ultimaInteracaoEm && (
                  <span> · há {Math.floor((Date.now() - card.ultimaInteracaoEm.getTime()) / (1000*60*60*24))}d</span>
                )}
              </div>
            )}
          </div>

          {/* Botões grandes ligar/WA */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <a
              href={telUrl ?? "#"}
              onClick={(e) => { if (!telUrl) e.preventDefault(); }}
              className={`flex items-center justify-center gap-2 py-4 rounded-lg font-bold text-base ${telUrl ? "bg-[#0D0D0D] text-white hover:bg-[#1A1A1A]" : "bg-[#E5E2DC] text-[#6B6B6B] cursor-not-allowed"}`}
            >
              <Phone className="w-5 h-5" /> LIGAR
            </a>
            <a
              href={waUrl ?? "#"}
              target="_blank"
              rel="noopener"
              onClick={(e) => { if (!waUrl) e.preventDefault(); }}
              className={`flex items-center justify-center gap-2 py-4 rounded-lg font-bold text-base ${waUrl ? "bg-[#25D366] text-white hover:opacity-90" : "bg-[#E5E2DC] text-[#6B6B6B] cursor-not-allowed"}`}
            >
              <MessageCircle className="w-5 h-5" /> WHATSAPP
            </a>
          </div>

          {/* Botões de resultado contextuais */}
          <div className="border-t border-[#E5E2DC] pt-5">
            <div className="text-[10px] uppercase tracking-wider text-[#6B6B6B] mb-2">resultado:</div>
            <div className="flex flex-wrap gap-2">
              {opcoes.map((o) => (
                <button
                  key={o.sit}
                  disabled={pending}
                  onClick={() => registrar(o)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${COR_BTN[o.cor]}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pular */}
          <div className="border-t border-[#E5E2DC] mt-5 pt-4 flex items-center justify-between">
            <button
              onClick={() => pular("fim_hoje")}
              disabled={pending}
              className="text-xs text-[#6B6B6B] hover:text-[#0D0D0D] disabled:opacity-50"
            >
              pular — volta no fim da fila →
            </button>
            <button
              onClick={() => pular("amanha")}
              disabled={pending}
              className="text-xs text-[#6B6B6B] hover:text-[#0D0D0D] disabled:opacity-50"
            >
              adiar +1d
            </button>
          </div>
        </div>
      </div>

      {pulados.length > 0 && (
        <div className="text-center text-[10px] text-[#6B6B6B] mt-3">
          {pulados.length} pulada{pulados.length > 1 ? "s" : ""} nessa sessão
        </div>
      )}
    </div>
  );
}
