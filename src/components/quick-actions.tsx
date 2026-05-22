import { Phone, MessageCircle, Mail, Globe } from "lucide-react";

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export function QuickActions({
  telefone,
  whatsapp,
  email,
  site,
  size = "sm",
}: {
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  size?: "sm" | "md";
}) {
  const cls = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";

  const tel = telefone ? digitsOnly(telefone) : "";
  // WhatsApp: usa whatsapp se existir; senão tenta com telefone se for celular
  let wa = whatsapp ? digitsOnly(whatsapp) : "";
  if (!wa && tel.length >= 10 && /^[1-9]\d{9,}$/.test(tel)) wa = tel;
  if (wa && !wa.startsWith("55")) wa = "55" + wa;

  return (
    <div className="flex gap-1 flex-wrap">
      {tel && (
        <a
          href={`tel:+55${tel}`}
          className={`inline-flex items-center gap-1 ${cls} rounded border border-[#E5E2DC] bg-white hover:bg-[#F2F0EC]`}
          title={telefone || ""}
        >
          <Phone className="w-3 h-3" /> {size === "md" ? "Ligar" : ""}
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 ${cls} rounded border border-[#00897B] text-[#00897B] bg-white hover:bg-[#00897B]/10`}
          title="Abrir WhatsApp"
        >
          <MessageCircle className="w-3 h-3" /> {size === "md" ? "WhatsApp" : ""}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className={`inline-flex items-center gap-1 ${cls} rounded border border-[#E5E2DC] bg-white hover:bg-[#F2F0EC]`}
          title={email}
        >
          <Mail className="w-3 h-3" /> {size === "md" ? "Email" : ""}
        </a>
      )}
      {site && (
        <a
          href={site.startsWith("http") ? site : `https://${site}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 ${cls} rounded border border-[#E5E2DC] bg-white hover:bg-[#F2F0EC]`}
          title={site}
        >
          <Globe className="w-3 h-3" /> {size === "md" ? "Site" : ""}
        </a>
      )}
    </div>
  );
}
