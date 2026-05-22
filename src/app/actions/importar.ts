"use server";
import { auth } from "@/auth";
import { db } from "@/db";
import { conta } from "@/db/schema";
import { eq, or, isNotNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const SHEET_ID = "1jXBvqGtCIMSoeeUBG380vHXFN8812Ma2pw2DZeCsxnc";

type ImportResult = {
  novos: number;
  atualizados: number;
  pulados: number;
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
  "Sem contato": "base_fria",
  "Em negociação": "contatado",
  "Reunião marcada": "visitado",
  Positivada: "positivado",
  Negativa: "perdido",
};

async function fetchSheetValues(range: string) {
  const TOKEN_PATH = `${process.env.HOME}/Documents/cells-skills-novo/4. canais/b2b/oauth-token.json`;
  const fs = await import("fs/promises");
  const tokenRaw = await fs.readFile(TOKEN_PATH, "utf-8");
  const tokenJson = JSON.parse(tokenRaw);

  // refresh token
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
  if (!accessToken) throw new Error("Falha ao refresh token");

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
    return { ok: false, data: { novos: 0, atualizados: 0, pulados: 0, erros: [] }, error: "não autenticado" };

  const resultado: ImportResult = { novos: 0, atualizados: 0, pulados: 0, erros: [] };

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
      seg: ix("Segmento"),
      cidade: ix("Cidade"),
      uf: ix("UF"),
      cep: ix("CEP"),
      end: ix("Endereço_completo"),
      comp: ix("Comprador"),
      email: ix("Email"),
      tel: ix("Telefone"),
      tel_alt: ix("Tel_alt"),
      origem: ix("Origem"),
      resp: ix("Responsável"),
      status_email: ix("Status_email"),
      resultado: ix("Resultado_última_lig"),
      prox: ix("Próximo_passo"),
      notas: ix("Notas"),
      estagio: ix("Estágio_funil"),
    };

    // pegar todas contas existentes pra match
    const existentes = await db.select().from(conta).where(or(isNotNull(conta.cnpj), isNotNull(conta.razaoSocial))!);
    const porCnpj = new Map<string, typeof existentes[0]>();
    const porNome = new Map<string, typeof existentes[0]>();
    for (const c of existentes) {
      if (c.cnpj) porCnpj.set(c.cnpj.replace(/\D/g, ""), c);
      if (c.razaoSocial)
        porNome.set(c.razaoSocial.toLowerCase().replace(/[^a-z0-9]+/g, ""), c);
      if (c.nome)
        porNome.set(c.nome.toLowerCase().replace(/[^a-z0-9]+/g, ""), c);
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
      const funilStage = ESTAGIO_TO_FUNIL[estagio] || "base_fria";

      const notasParts = [
        r[idxs.status_email] ? `[Status email] ${r[idxs.status_email]}` : "",
        r[idxs.resultado] ? `[Resultado] ${r[idxs.resultado]}` : "",
        r[idxs.prox] ? `[Próximo passo] ${r[idxs.prox]}` : "",
        r[idxs.notas] ? `[Notas] ${r[idxs.notas]}` : "",
      ].filter(Boolean);

      const tags = [
        r[idxs.rede] ? `rede:${r[idxs.rede]}` : "",
        r[idxs.origem] ? `origem:${r[idxs.origem]}` : "",
      ].filter(Boolean);

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
        funilStage,
        notas: notasParts.join(" · ") || null,
        tags,
        origemLead: "prospeccao_propria",
        responsavel: "gabriel",
      };

      const existente =
        (cnpjRaw && porCnpj.get(cnpjRaw)) ||
        porNome.get(nome.toLowerCase().replace(/[^a-z0-9]+/g, "")) ||
        (rs && porNome.get(rs.toLowerCase().replace(/[^a-z0-9]+/g, "")));

      if (existente) {
        if (!dryRun) {
          try {
            await db
              .update(conta)
              .set({ ...dados, updatedAt: new Date() })
              .where(eq(conta.contaId, existente.contaId));
          } catch (e) {
            resultado.erros.push(`linha ${i + 1} (${nome}): ${(e as Error).message}`);
            continue;
          }
        }
        resultado.atualizados++;
      } else {
        if (!dryRun) {
          try {
            await db.insert(conta).values(dados);
          } catch (e) {
            resultado.erros.push(`linha ${i + 1} (${nome}): ${(e as Error).message}`);
            continue;
          }
        }
        resultado.novos++;
      }
    }

    if (!dryRun) {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/pipeline");
    }
    return { ok: true, data: resultado };
  } catch (e) {
    return {
      ok: false,
      data: resultado,
      error: (e as Error).message,
    };
  }
}
