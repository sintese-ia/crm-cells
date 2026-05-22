// Importa MASTER (Google Sheets) → b2b.conta + b2b.contato
// Roda standalone via: node scripts/import-master.mjs [--dry]
//
// 1) Lê todas linhas da MASTER (2006)
// 2) Match por CNPJ → Razão Social → Nome Fantasia
// 3) Upsert em b2b.conta com TUDO (email, telefone, site, comprador→contato, etc)
// 4) Reporta novos/atualizados/contatos/erros

import postgres from "postgres";
import fs from "fs/promises";
import path from "path";

const DRY = process.argv.includes("--dry");
const SHEET_ID = "1jXBvqGtCIMSoeeUBG380vHXFN8812Ma2pw2DZeCsxnc";
const DATABASE_URL = "postgresql://claude_b2b:HUGGlvuTsBYuduJTP4RvG7rOho4ANtzt@easypanel.sinteseia.com.br:5432/dadoscells";

const SEGMENTO_TO_CANAL = {
  "Empório": "especializado_natural",
  "Suplementos": "suplementos",
  "Farma": "farma",
  "Farma Key Account": "farma",
  "Distribuidor": "distribuidor",
  "Varejo Alimentar": "outros",
  "Varejo Alimentar Premium": "mercado_premium",
  "Academia": "academia",
  "Perfumaria": "outros",
  "Loja Online": "outros",
  "Padaria": "outros",
  "Outros": "outros",
};

const ESTAGIO_TO_FUNIL = {
  "Sem contato": "base_fria",
  "Em negociação": "contatado",
  "Reunião marcada": "visitado",
  "Positivada": "positivado",
  "Negativa": "perdido",
};

const RESP_MAP = {
  "Gabriel": "gabriel", "gabriel": "gabriel",
  "Yas": "yasmin", "Yasmin": "yasmin", "yasmin": "yasmin", "YAS": "yasmin", "yas": "yasmin",
  "Gabi": "gabi", "gabi": "gabi", "GABI": "gabi",
  "Camila": "gabriel", "camila": "gabriel",  // Camila saiu - reatribui pra Gabriel
  "Ismael": "ismael", "ismael": "ismael",
  "Lilian": "lilian", "lilian": "lilian",
};

const ORIGEM_MAP = {
  "BIOMUNDO": "lista_biomundo",
  "MUNDO_VERDE": "lista_mundo_verde",
};

const RESPONSAVEIS_DE_REDE_BIO_MV = {
  "biomundo": "gabriel",   // BioMundo é meu (Gabriel)
  "bio mundo": "gabriel",
  "mundo verde": "yasmin", // Mundo Verde é da Yas
};

async function getAccessToken() {
  const tokenPath = path.join(
    process.env.HOME,
    "Documents/cells-skills-novo/4. canais/b2b/oauth-token.json"
  );
  const raw = await fs.readFile(tokenPath, "utf-8");
  const tk = JSON.parse(raw);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: tk.client_id,
      client_secret: tk.client_secret,
      refresh_token: tk.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Falha refresh token");
  return j.access_token;
}

async function fetchMaster(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("MASTER!A1:AK")}?valueRenderOption=FORMATTED_VALUE`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Sheets API ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.values;
}

function normNome(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const sql = postgres(DATABASE_URL, { ssl: false, max: 4, prepare: false });

async function main() {
  console.log(`Modo: ${DRY ? "SIMULAÇÃO (não grava)" : "REAL (vai gravar)"}\n`);

  console.log("1. Lendo MASTER do Google Sheets...");
  const token = await getAccessToken();
  const rows = await fetchMaster(token);
  console.log(`   ${rows.length - 1} linhas de dados`);

  const hdr = rows[0];
  const ix = (n) => hdr.indexOf(n);
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

  console.log("2. Mapeando contas existentes no Postgres...");
  const existentes = await sql`SELECT conta_id, cnpj, nome, razao_social FROM b2b.conta`;
  const porCnpj = new Map();
  const porNome = new Map();
  for (const c of existentes) {
    if (c.cnpj) porCnpj.set(c.cnpj.replace(/\D/g, ""), c.conta_id);
    if (c.razao_social) porNome.set(normNome(c.razao_social), c.conta_id);
    if (c.nome) porNome.set(normNome(c.nome), c.conta_id);
  }
  console.log(`   ${existentes.length} contas já existem no banco`);

  const stats = { novos: 0, atualizados: 0, pulados: 0, contatosCriados: 0, erros: [] };
  const data = rows.slice(1);

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const linhaN = i + 2;
    if (!r) { stats.pulados++; continue; }

    const cnpjRaw = (r[idxs.cnpj] || "").replace(/\D/g, "");
    const rs = (r[idxs.rs] || "").trim();
    const nf = (r[idxs.nf] || "").trim();
    const nome = nf || rs;
    if (!nome) { stats.pulados++; continue; }

    const segmento = (r[idxs.seg] || "Outros").trim();
    const canal = SEGMENTO_TO_CANAL[segmento] || "outros";
    const estagio = (r[idxs.estagio] || "").trim();
    const funilStage = ESTAGIO_TO_FUNIL[estagio] || "base_fria";

    // Responsável: prioridade da rede BioMundo/MV → coluna Responsável → default gabriel
    const respPlanilha = (r[idxs.resp] || "").trim();
    const rede = (r[idxs.rede] || "").trim();
    const redeKey = rede.toLowerCase();
    let responsavel = "gabriel";
    if (respPlanilha && RESP_MAP[respPlanilha]) responsavel = RESP_MAP[respPlanilha];
    if (RESPONSAVEIS_DE_REDE_BIO_MV[redeKey]) responsavel = RESPONSAVEIS_DE_REDE_BIO_MV[redeKey];

    const origemRaw = (r[idxs.origem] || "").trim();
    const origemPrimary = (origemRaw.split("+")[0] || "").trim();
    const origemLead =
      ORIGEM_MAP[origemPrimary] ||
      (origemRaw.toLowerCase().includes("inbound") ? "inbound" : "prospeccao_propria");

    const notasParts = [];
    if (r[idxs.status_email]) notasParts.push(`[Status email] ${r[idxs.status_email]}`);
    if (r[idxs.resultado]) notasParts.push(`[Resultado] ${r[idxs.resultado]}`);
    if (r[idxs.prox]) notasParts.push(`[Próximo passo] ${r[idxs.prox]}`);
    if (r[idxs.notas]) notasParts.push(`[Notas] ${r[idxs.notas]}`);

    const tags = [];
    if (rede) tags.push(`rede:${rede}`);
    if (r[idxs.tipoLead]) tags.push(`tipo:${r[idxs.tipoLead]}`);
    if (r[idxs.prioridade]) tags.push(`prio:${r[idxs.prioridade]}`);
    if (origemRaw) tags.push(`origem_planilha:${origemRaw}`);
    if (r[idxs.totalLojas]) tags.push(`lojas:${r[idxs.totalLojas]}`);

    const whatsapp = (r[idxs.telAlt] || r[idxs.tel] || "").trim();

    const dados = {
      nome,
      razao_social: rs || null,
      cnpj: cnpjRaw || null,
      canal,
      cidade: r[idxs.cidade] || null,
      uf: (r[idxs.uf] || null)?.toUpperCase() || null,
      cep: r[idxs.cep] || null,
      endereco: r[idxs.end] || null,
      email_institucional: r[idxs.email] || null,
      telefone_institucional: r[idxs.tel] || null,
      whatsapp_institucional: whatsapp || null,
      site: r[idxs.site] || null,
      funil_stage: funilStage,
      responsavel,
      origem_lead: origemLead,
      notas: notasParts.join(" · ") || null,
      tags,
    };

    const cnpjKey = cnpjRaw || "";
    const nomeKey = normNome(nome);
    const rsKey = rs ? normNome(rs) : "";
    const existeId =
      (cnpjKey && porCnpj.get(cnpjKey)) ||
      porNome.get(nomeKey) ||
      (rsKey && porNome.get(rsKey)) ||
      null;

    let contaId = existeId;

    if (existeId) {
      if (!DRY) {
        try {
          await sql`
            UPDATE b2b.conta SET
              nome = ${dados.nome},
              razao_social = ${dados.razao_social},
              cnpj = ${dados.cnpj},
              canal = ${dados.canal},
              cidade = ${dados.cidade},
              uf = ${dados.uf},
              cep = ${dados.cep},
              endereco = ${dados.endereco},
              email_institucional = ${dados.email_institucional},
              telefone_institucional = ${dados.telefone_institucional},
              whatsapp_institucional = ${dados.whatsapp_institucional},
              site = ${dados.site},
              funil_stage = ${dados.funil_stage},
              responsavel = ${dados.responsavel},
              origem_lead = ${dados.origem_lead},
              notas = ${dados.notas},
              tags = ${dados.tags},
              updated_at = now()
            WHERE conta_id = ${existeId}
          `;
        } catch (e) {
          stats.erros.push(`L${linhaN} (${nome}): ${e.message}`);
          continue;
        }
      }
      stats.atualizados++;
    } else {
      if (!DRY) {
        try {
          const [ins] = await sql`
            INSERT INTO b2b.conta (
              nome, razao_social, cnpj, canal, cidade, uf, cep, endereco,
              email_institucional, telefone_institucional, whatsapp_institucional, site,
              funil_stage, responsavel, origem_lead, notas, tags
            ) VALUES (
              ${dados.nome}, ${dados.razao_social}, ${dados.cnpj}, ${dados.canal},
              ${dados.cidade}, ${dados.uf}, ${dados.cep}, ${dados.endereco},
              ${dados.email_institucional}, ${dados.telefone_institucional}, ${dados.whatsapp_institucional}, ${dados.site},
              ${dados.funil_stage}, ${dados.responsavel}, ${dados.origem_lead}, ${dados.notas}, ${dados.tags}
            ) RETURNING conta_id
          `;
          contaId = ins.conta_id;
          if (cnpjKey) porCnpj.set(cnpjKey, contaId);
          porNome.set(nomeKey, contaId);
        } catch (e) {
          stats.erros.push(`L${linhaN} (${nome}): ${e.message}`);
          continue;
        }
      }
      stats.novos++;
    }

    // Comprador → b2b.contato (só se não existe)
    const compradorNome = (r[idxs.comp] || "").trim();
    if (compradorNome && contaId) {
      if (!DRY) {
        try {
          const exist = await sql`SELECT contato_id FROM b2b.contato WHERE conta_id=${contaId} LIMIT 1`;
          if (exist.length === 0) {
            await sql`
              INSERT INTO b2b.contato (
                conta_id, nome, cargo, email, telefone, whatsapp,
                papel, relevancia, e_principal, ativo
              ) VALUES (
                ${contaId}, ${compradorNome}, 'Comprador',
                ${r[idxs.email] || null}, ${r[idxs.tel] || null}, ${whatsapp || null},
                'decisor', 'alta', true, true
              )
            `;
            stats.contatosCriados++;
          }
        } catch (e) {
          stats.erros.push(`L${linhaN} contato (${compradorNome}): ${e.message}`);
        }
      } else {
        stats.contatosCriados++;
      }
    }

    if (i % 200 === 0 && i > 0) {
      console.log(`   ...${i}/${data.length} (novos=${stats.novos}, atualizados=${stats.atualizados}, contatos=${stats.contatosCriados})`);
    }
  }

  console.log("\n=== RESULTADO ===");
  console.log(`Novos:               ${stats.novos}`);
  console.log(`Atualizados:         ${stats.atualizados}`);
  console.log(`Contatos criados:    ${stats.contatosCriados}`);
  console.log(`Pulados:             ${stats.pulados}`);
  console.log(`Erros:               ${stats.erros.length}`);
  if (stats.erros.length > 0) {
    console.log("\nPrimeiros 10 erros:");
    for (const e of stats.erros.slice(0, 10)) console.log("  -", e);
  }

  // Verificações finais
  const final = await sql`
    SELECT
      (SELECT count(*) FROM b2b.conta)    AS contas,
      (SELECT count(*) FROM b2b.contato)  AS contatos,
      (SELECT count(*) FROM b2b.conta WHERE responsavel='gabriel') AS gabriel,
      (SELECT count(*) FROM b2b.conta WHERE responsavel='yasmin')  AS yasmin,
      (SELECT count(*) FROM b2b.conta WHERE responsavel='gabi')    AS gabi,
      (SELECT count(*) FROM b2b.conta WHERE funil_stage='positivado') AS positivados
  `;
  console.log("\n=== ESTADO FINAL DO BANCO ===");
  console.log(final[0]);
}

main()
  .then(() => sql.end().then(() => process.exit(0)))
  .catch((e) => {
    console.error("FATAL:", e.message);
    sql.end().then(() => process.exit(1));
  });
