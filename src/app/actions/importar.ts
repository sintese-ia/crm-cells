"use server";
import { auth } from "@/auth";
import { db } from "@/db";
import { conta, contato } from "@/db/schema";
import { eq, or, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const SHEET_ID = "1jXBvqGtCIMSoeeUBG380vHXFN8812Ma2pw2DZeCsxnc";

type ImportResult = {
  novos: number;
  atualizados: number;
  pulados: number;
  contatosCriados: number;
  erros: string[];
};

const SEGMENTO_TO_CANAL: Record<string, string> = {
  Empório: "especializado_natural",
  Suplementos: "suplementos",
  Farma: "farma",
  "Farma Key Account": "farma",
  Distribuidor: "distribuidor",
  "Varejo Alimentar": "outros",
  "Varejo Alimentar Premium": "mercado_premium",
  Academia: "academia",
  Perfumaria: "outros",
  "Loja Online": "outros",
  Padaria: "outros",
  Outros: "outros",
};

const ESTAGIO_TO_FUNIL: Record<string, string> = {
  "Sem contato": "sem_contato",
  "Em negociação": "em_negociacao",
  "Reunião marcada": "reuniao",
  Positivada: "positivada",
  Negativa: "negativa",
};

const RESP_MAP: Record<string, string> = {
  Gabriel: "gabriel",
  gabriel: "gabriel",
  Yas: "yasmin",
  Yasmin: "yasmin",
  YAS: "yasmin",
  yas: "yasmin",
  yasmin: "yasmin",
  Gabi: "gabi",
  gabi: "gabi",
  GABI: "gabi",
  Camila: "gabriel",
  camila: "gabriel",
  Ismael: "ismael",
  ismael: "ismael",
  Lilian: "lilian",
  lilian: "lilian",
};

const ORIGEM_MAP: Record<string, string> = {
  BIOMUNDO: "lista_biomundo",
  "lista_biomundo": "lista_biomundo",
  MUNDO_VERDE: "lista_mundo_verde",
  "lista_mundo_verde": "lista_mundo_verde",
};

async function fetchSheetValues(range: string) {
  let tokenJson: { client_id: string; client_secret: string; refresh_token: string };
  if (process.env.GOOGLE_OAUTH_TOKEN_JSON) {
    tokenJson = JSON.parse(process.env.GOOGLE_OAUTH_TOKEN_JSON);
  } else {
    const TOKEN_PATH = `${process.env.HOME}/Documents/cells-skills-novo/4. canais/b2b/oauth-token.json`;
    const fs = await import("fs/promises");
    const tokenRaw = await fs.readFile(TOKEN_PATH, "utf-8");
    tokenJson = JSON.parse(tokenRaw);
  }

  const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: tokenJson.client_id,
      client_secret: tokenJson.client_secret,
      refresh_token: tokenJson.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await refreshResp.json();
  const accessToken = refreshed.access_token;
  if (!accessToken) throw new Error("Falha ao refresh token Google");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Sheets API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.values as string[][];
}

export async function importarMasterPlanilha(
  dryRun: boolean
): Promise<{ ok: boolean; data: ImportResult; error?: string }> {
  const session = await auth();
  if (!session?.user)
    return {
      ok: false,
      data: { novos: 0, atualizados: 0, pulados: 0, contatosCriados: 0, erros: [] },
      error: "não autenticado",
    };

  const resultado: ImportResult = {
    novos: 0,
    atualizados: 0,
    pulados: 0,
    contatosCriados: 0,
    erros: [],
  };

  try {
    const rows = await fetchSheetValues("MASTER!A1:AK");
    if (!rows || rows.length < 2) throw new Error("Planilha vazia");

    const hdr = rows[0];
    const ix = (name: string) => hdr.indexOf(name);
    const idxs = {
      cnpj: ix("CNPJ"),
      rs: ix("Razão_Social"),
      nf: ix("Nome_Fantasia"),
      rede: ix("REDE"),
      tipoLead: ix("Tipo_lead"),
      seg: ix("Segmento"),
      totalLojas: ix("Total_lojas"),
      cidade: ix("Cidade"),
      uf: ix("UF"),
      cep: ix("CEP"),
      end: ix("Endereço_completo"),
      comp: ix("Comprador"),
      email: ix("Email"),
      tel: ix("Telefone"),
      whatsLink: ix("WhatsApp_link"),
      telAlt: ix("Tel_alt"),
      site: ix("Site"),
      origem: ix("Origem"),
      resp: ix("Responsável"),
      prioridade: ix("Prioridade"),
      status_email: ix("Status_email"),
      resultado: ix("Resultado_última_lig"),
      prox: ix("Próximo_passo"),
      notas: ix("Notas"),
      estagio: ix("Estágio_funil"),
    };

    const existentes = await db
      .select()
      .from(conta)
      .where(or(isNotNull(conta.cnpj), isNotNull(conta.razaoSocial))!);
    const porCnpj = new Map<string, (typeof existentes)[0]>();
    const porNome = new Map<string, (typeof existentes)[0]>();
    for (const c of existentes) {
      if (c.cnpj) porCnpj.set(c.cnpj.replace(/\D/g, ""), c);
      if (c.razaoSocial)
        porNome.set(c.razaoSocial.toLowerCase().replace(/[^a-z0-9]+/g, ""), c);
      if (c.nome) porNome.set(c.nome.toLowerCase().replace(/[^a-z0-9]+/g, ""), c);
    }

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const cnpjRaw = (r[idxs.cnpj] || "").replace(/\D/g, "");
      const rs = (r[idxs.rs] || "").trim();
      const nf = (r[idxs.nf] || "").trim();
      const nome = nf || rs;
      if (!nome) {
        resultado.pulados++;
        continue;
      }

      const segmento = (r[idxs.seg] || "Outros").trim();
      const canal = SEGMENTO_TO_CANAL[segmento] || "outros";
      const estagio = (r[idxs.estagio] || "").trim();
      const funilStage = ESTAGIO_TO_FUNIL[estagio] || "sem_contato";

      const respPlanilha = (r[idxs.resp] || "").trim();
      const responsavel = RESP_MAP[respPlanilha] || "gabriel";

      const origemRaw = (r[idxs.origem] || "").trim();
      const origemPrimary = origemRaw.split("+")[0]?.trim() || "";
      const origemLead =
        ORIGEM_MAP[origemPrimary] ||
        (origemRaw.toLowerCase().includes("inbound") ? "inbound" : "prospeccao_propria");

      const notasParts: string[] = [];
      if (r[idxs.status_email]) notasParts.push(`[Status email] ${r[idxs.status_email]}`);
      if (r[idxs.resultado]) notasParts.push(`[Resultado] ${r[idxs.resultado]}`);
      if (r[idxs.prox]) notasParts.push(`[Próximo passo] ${r[idxs.prox]}`);
      if (r[idxs.notas]) notasParts.push(`[Notas] ${r[idxs.notas]}`);

      const tags: string[] = [];
      if (r[idxs.rede]) tags.push(`rede:${r[idxs.rede]}`);
      if (r[idxs.tipoLead]) tags.push(`tipo:${r[idxs.tipoLead]}`);
      if (r[idxs.prioridade]) tags.push(`prio:${r[idxs.prioridade]}`);
      if (origemRaw) tags.push(`origem_planilha:${origemRaw}`);

      const whatsapp = (r[idxs.telAlt] || r[idxs.tel] || "").trim();

      const dados = {
        nome,
        razaoSocial: rs || null,
        cnpj: cnpjRaw || null,
        canal,
        cidade: r[idxs.cidade] || null,
        uf: r[idxs.uf] || null,
        cep: r[idxs.cep] || null,
        endereco: r[idxs.end] || null,
        emailInstitucional: r[idxs.email] || null,
        telefoneInstitucional: r[idxs.tel] || null,
        whatsappInstitucional: whatsapp || null,
        site: r[idxs.site] || null,
        funilStage,
        responsavel,
        origemLead,
        notas: notasParts.join(" · ") || null,
        tags,
      };

      const cnpjKey = cnpjRaw || "";
      const nomeKey = nome.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const rsKey = rs ? rs.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
      const existente =
        (cnpjKey && porCnpj.get(cnpjKey)) ||
        porNome.get(nomeKey) ||
        (rsKey && porNome.get(rsKey));

      let contaId: number | null = null;

      if (existente) {
        if (!dryRun) {
          try {
            await db
              .update(conta)
              .set({ ...dados, updatedAt: new Date() })
              .where(eq(conta.contaId, existente.contaId));
            contaId = existente.contaId;
          } catch (e) {
            resultado.erros.push(
              `linha ${i + 1} (${nome}): ${(e as Error).message}`
            );
            continue;
          }
        }
        resultado.atualizados++;
      } else {
        if (!dryRun) {
          try {
            const [inserted] = await db
              .insert(conta)
              .values(dados)
              .returning({ contaId: conta.contaId });
            contaId = inserted.contaId;
            if (cnpjKey) porCnpj.set(cnpjKey, { ...dados, contaId } as (typeof existentes)[0]);
          } catch (e) {
            resultado.erros.push(
              `linha ${i + 1} (${nome}): ${(e as Error).message}`
            );
            continue;
          }
        }
        resultado.novos++;
      }

      // Comprador → cria b2b.contato (só se não existe ainda)
      const compradorNome = (r[idxs.comp] || "").trim();
      if (compradorNome && contaId && !dryRun) {
        try {
          const existsContato = await db
            .select({ id: contato.contatoId })
            .from(contato)
            .where(eq(contato.contaId, contaId))
            .limit(1);
          if (existsContato.length === 0) {
            await db.insert(contato).values({
              contaId,
              nome: compradorNome,
              cargo: "Comprador",
              email: r[idxs.email] || null,
              telefone: r[idxs.tel] || null,
              whatsapp: whatsapp || null,
              papel: "decisor",
              relevancia: "alta",
              ePrincipal: true,
              ativo: true,
            });
            resultado.contatosCriados++;
          }
        } catch (e) {
          resultado.erros.push(
            `linha ${i + 1} contato (${compradorNome}): ${(e as Error).message}`
          );
        }
      } else if (compradorNome && dryRun) {
        resultado.contatosCriados++;
      }
    }

    if (!dryRun) {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/pipeline");
    }
    return { ok: true, data: resultado };
  } catch (e) {
    return { ok: false, data: resultado, error: (e as Error).message };
  }
}
