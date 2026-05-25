"use server";

import { db } from "@/db";
import {
  conta,
  interacao,
  acao,
  situacao,
  regraCadencia,
  auditoria,
  contato,
  type Conta,
} from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, sql, count, asc, lte, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function fmtISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function logAuditoria(opts: {
  contaId: number;
  acao: string;
  campo?: string;
  valorAntes?: string | null;
  valorDepois?: string | null;
  contexto?: unknown;
}) {
  const session = await auth();
  if (!session?.user) return;
  const u = session.user as { id?: string; name?: string; email?: string };
  await db.insert(auditoria).values({
    contaId: opts.contaId,
    usuarioId: u.id ?? "desconhecido",
    usuarioEmail: u.email ?? "",
    usuarioNome: u.name ?? "",
    acao: opts.acao,
    campo: opts.campo ?? null,
    valorAntes: opts.valorAntes ?? null,
    valorDepois: opts.valorDepois ?? null,
    contexto: opts.contexto ? JSON.stringify(opts.contexto) : null,
  });
}

export async function atualizarConta(
  contaId: number,
  patch: Partial<Conta>
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [antes] = await db.select().from(conta).where(eq(conta.contaId, contaId));
    await db.update(conta).set(patch).where(eq(conta.contaId, contaId));

    // log diferenças
    for (const [campo, novoValor] of Object.entries(patch)) {
      const anteValor = (antes as unknown as Record<string, unknown>)[campo];
      if (String(anteValor ?? "") !== String(novoValor ?? "")) {
        await logAuditoria({
          contaId,
          acao: `mudou_${campo}`,
          campo,
          valorAntes: String(anteValor ?? ""),
          valorDepois: String(novoValor ?? ""),
        });
      }
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/contas");
    revalidatePath("/pipeline");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moverFunil(
  contaId: number,
  novoStage: string
): Promise<{ ok: boolean; error?: string }> {
  return atualizarConta(contaId, { funilStage: novoStage });
}

export async function criarInteracao(
  contaId: number,
  dados: {
    tipo: string;
    texto: string;
    situacaoId?: string | null;
    contatoId?: number | null;
    dataPersonalizada?: string | null; // YYYY-MM-DD, override do user
  }
): Promise<{
  ok: boolean;
  error?: string;
  acaoCriada?: { dias: number | null; descricao: string };
  funilMovido?: { de: string; para: string };
}> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const u = session.user as { id?: string; name?: string };
  const autor = (u.id || "outro").toLowerCase();
  const autorValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian", "claude"].includes(autor) ? autor : "outro";

  try {
    // Contar tentativas anteriores com a mesma situação (pra cadência escalada)
    let tentativaNum = 1;
    if (dados.situacaoId) {
      const tents = await db
        .select({ n: count() })
        .from(interacao)
        .where(and(eq(interacao.contaId, contaId), eq(interacao.situacaoId, dados.situacaoId)));
      tentativaNum = (tents[0]?.n ?? 0) + 1;
    }

    // Inserir interação
    await db.insert(interacao).values({
      contaId,
      tipo: dados.tipo,
      texto: dados.texto,
      contatoId: dados.contatoId ?? null,
      autor: autorValido,
      situacaoId: dados.situacaoId ?? null,
      tentativaNum,
    });

    // Audit
    await logAuditoria({
      contaId,
      acao: "criou_interacao",
      campo: "interacao",
      valorDepois: `${dados.tipo} · ${dados.situacaoId ?? "sem_situacao"} (tentativa ${tentativaNum})`,
    });

    // Pegar situação + regra
    let acaoCriada: { dias: number | null; descricao: string } | undefined;
    let funilMovido: { de: string; para: string } | undefined;

    const [c] = await db
      .select({ funilStage: conta.funilStage, responsavel: conta.responsavel })
      .from(conta)
      .where(eq(conta.contaId, contaId));

    if (dados.situacaoId) {
      // Buscar situação pra ver se auto-move funil
      const [s] = await db.select().from(situacao).where(eq(situacao.situacaoId, dados.situacaoId));

      // === BLOQUEIO: requer homologação E não aprovada bloqueia avanço pra venda ===
      // Se o auto_funil dessa situação é positivado/pedido_realizado e a conta
      // (ou sua matriz) requer homologação não aprovada, NÃO move funil — cria
      // tarefa "Homologar rede X" pra responsável da matriz.
      const VENDA_STAGES = ["positivado", "pedido_realizado", "proposta_enviada"];
      const tentandoAvancarVenda = s?.autoFunil && VENDA_STAGES.includes(s.autoFunil);
      let bloqueadoPor: "homologacao" | "cadastro" | null = null;
      if (tentandoAvancarVenda) {
        const [contaCheia] = await db
          .select({
            requerHom: conta.requerHomologacao,
            statusHom: conta.statusHomologacao,
            requerCad: conta.requerCadastro,
            matrizId: conta.contaMatrizId,
            nome: conta.nome,
          })
          .from(conta)
          .where(eq(conta.contaId, contaId));
        if (contaCheia?.requerHom && contaCheia.statusHom !== "aprovada") {
          bloqueadoPor = "homologacao";
        } else if (contaCheia?.requerCad) {
          // Cadastro aprovado é registrado via interação cadastro_aprovado
          // — se nunca houve, fica bloqueado
          const [cadOk] = await db
            .select({ n: count() })
            .from(interacao)
            .where(and(eq(interacao.contaId, contaId), eq(interacao.situacaoId, "cadastro_aprovado")));
          if ((cadOk?.n ?? 0) === 0) bloqueadoPor = "cadastro";
        }
        if (bloqueadoPor) {
          const alvoId = bloqueadoPor === "homologacao" && contaCheia?.matrizId ? contaCheia.matrizId : contaId;
          const [alvoConta] = await db.select({ nome: conta.nome, responsavel: conta.responsavel }).from(conta).where(eq(conta.contaId, alvoId));
          const respAlvo = ["gabriel","gabi","yasmin","ismael","lilian"].includes(alvoConta?.responsavel || "")
            ? (alvoConta!.responsavel as "gabriel"|"gabi"|"yasmin"|"ismael"|"lilian") : "gabriel";
          // Cria ação na matriz/conta-alvo (se já não existe pendente)
          const jaTem = await db.select({ n: count() }).from(acao)
            .where(and(eq(acao.contaId, alvoId), eq(acao.status, "pendente"),
              bloqueadoPor === "homologacao" ? sql`descricao ILIKE 'Homologar%'` : sql`descricao ILIKE 'Cadastrar%'`));
          if ((jaTem[0]?.n ?? 0) === 0) {
            await db.insert(acao).values({
              contaId: alvoId,
              descricao: bloqueadoPor === "homologacao"
                ? `Homologar ${alvoConta?.nome ?? "rede"} (bloqueia venda nas filhas)`
                : `Cadastrar ${alvoConta?.nome ?? "conta"} (bloqueia venda)`,
              tipo: "follow_up",
              dataPrevista: fmtISODate(new Date()),
              responsavel: respAlvo,
              status: "pendente",
              origem: "bloqueio_homol",
              notas: `Auto-criada por bloqueio de ${bloqueadoPor} — disparado em conta ${contaId}`,
            });
          }
          // NÃO move funil — só registra que tentou
          await logAuditoria({
            contaId,
            acao: "bloqueio_avanco",
            campo: "funilStage",
            valorAntes: c?.funilStage ?? "",
            valorDepois: `[bloqueado: ${bloqueadoPor}]`,
            contexto: { motivo: `Avanço pra ${s.autoFunil} bloqueado — requer ${bloqueadoPor} aprovado` },
          });
        }
      }

      if (s?.autoFunil && s.autoFunil !== c?.funilStage && !bloqueadoPor) {
        await db
          .update(conta)
          .set({ funilStage: s.autoFunil, updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
        funilMovido = { de: c?.funilStage ?? "", para: s.autoFunil };
        await logAuditoria({
          contaId,
          acao: "auto_mudou_funilStage",
          campo: "funilStage",
          valorAntes: c?.funilStage ?? "",
          valorDepois: s.autoFunil,
          contexto: { motivo: `Situação "${s.label}"` },
        });
      }

      // === PROPAGAÇÃO HOMOLOGAÇÃO matriz → filhas ===
      if (dados.situacaoId === "homologacao_aprovada") {
        const hoje = fmtISODate(new Date());
        // Marcar a própria conta como aprovada
        await db.update(conta)
          .set({ statusHomologacao: "aprovada", homologacaoAprovadaEm: hoje, updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
        // Se for matriz com filhas: propagar
        const filhas = await db.select({ id: conta.contaId, nome: conta.nome }).from(conta).where(eq(conta.contaMatrizId, contaId));
        if (filhas.length > 0) {
          await db.update(conta)
            .set({ statusHomologacao: "aprovada", homologacaoAprovadaEm: hoje, homologacaoNotas: sql`COALESCE(homologacao_notas, '') || E'\\nHerdou aprovação da matriz em ' || ${hoje}`, updatedAt: new Date() })
            .where(eq(conta.contaMatrizId, contaId));
          // Cancela ações de bloqueio nas filhas
          await db.update(acao)
            .set({ status: "cancelado", updatedAt: new Date() })
            .where(and(eq(acao.status, "pendente"), sql`conta_id IN (SELECT conta_id FROM b2b.conta WHERE conta_matriz_id = ${contaId})`, sql`origem = 'bloqueio_homol'`));
          for (const f of filhas) {
            await logAuditoria({
              contaId: f.id,
              acao: "homologacao_herdada",
              valorDepois: `aprovada via matriz ${contaId}`,
              contexto: { matriz_id: contaId },
            });
          }
        }
      } else if (dados.situacaoId === "homologacao_docs_enviados") {
        await db.update(conta)
          .set({ statusHomologacao: "docs_enviados", homologacaoIniciadaEm: fmtISODate(new Date()), updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
      } else if (dados.situacaoId === "homologacao_reprovada") {
        await db.update(conta)
          .set({ statusHomologacao: "reprovada", updatedAt: new Date() })
          .where(eq(conta.contaId, contaId));
      }

      // Buscar regra de cadência (situacaoId + tentativaNum)
      const regras = await db
        .select()
        .from(regraCadencia)
        .where(
          and(
            eq(regraCadencia.situacaoId, dados.situacaoId),
            eq(regraCadencia.ativa, true),
            lte(regraCadencia.tentativaMin, tentativaNum),
            sql`(${regraCadencia.tentativaMax} IS NULL OR ${regraCadencia.tentativaMax} >= ${tentativaNum})`
          )
        )
        .orderBy(asc(regraCadencia.ordem))
        .limit(1);

      if (regras[0]) {
        const r = regras[0];

        // se a regra move pra perdido, faz isso
        if (r.moveFunilPara) {
          await db
            .update(conta)
            .set({ funilStage: r.moveFunilPara, updatedAt: new Date() })
            .where(eq(conta.contaId, contaId));
          await logAuditoria({
            contaId,
            acao: "auto_mudou_funilStage",
            campo: "funilStage",
            valorAntes: c?.funilStage ?? "",
            valorDepois: r.moveFunilPara,
            contexto: { motivo: `Regra cadência: ${r.descricaoAcao}` },
          });
        }

        // Amostra enviada: trava FUP por 7 dias (não permite outras
        // cadências competirem nesse período). A própria amostra cria
        // ação D+7 "Confirmar recebimento", então o lead não é esquecido.
        if (dados.situacaoId === "amostra_enviada") {
          const ate = fmtISODate(addDays(new Date(), 7));
          await db
            .update(conta)
            .set({ fupTravadoAte: ate, updatedAt: new Date() })
            .where(eq(conta.contaId, contaId));
        }

        // criar nova ação (se dias_proxima_acao não é null)
        if (r.diasProximaAcao !== null) {
          // Cancela pendentes anteriores (pra não empilhar)
          await db
            .update(acao)
            .set({ status: "cancelado", updatedAt: new Date() })
            .where(and(eq(acao.contaId, contaId), eq(acao.status, "pendente")));

          const responsavelValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian"].includes(c?.responsavel || "")
            ? (c!.responsavel as "gabriel" | "gabi" | "yasmin" | "ismael" | "lilian")
            : "gabriel";

          const dataPrev = dados.dataPersonalizada || fmtISODate(addDays(new Date(), r.diasProximaAcao));

          // Classifica origem: situações de primeiro-contato sem diálogo = frio
          const SITUACOES_FRIAS = ["pc_nao_atendeu", "pc_caixa_postal", "pc_wa_sem_resposta", "pc_numero_invalido", "pc_adiou", "pc_nao_tem_interesse"];
          const origem = SITUACOES_FRIAS.includes(dados.situacaoId) ? "cadencia_frio" : "cadencia_quente";

          await db.insert(acao).values({
            contaId,
            descricao: r.descricaoAcao,
            tipo: r.tipoProximaAcao,
            dataPrevista: dataPrev,
            responsavel: responsavelValido,
            status: "pendente",
            origem,
            notas: `Regra v1: ${dados.situacaoId} · tentativa ${tentativaNum}`,
          });
          acaoCriada = { dias: r.diasProximaAcao, descricao: r.descricaoAcao };
        }
      }
    }

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    revalidatePath("/pipeline");

    return { ok: true, acaoCriada, funilMovido };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function marcarAcaoFeita(
  acaoId: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  const u = session.user as { id?: string; name?: string };
  const autor = (u.id || "outro").toLowerCase();
  const autorValido = ["gabriel", "gabi", "yasmin", "ismael", "lilian", "claude"].includes(autor) ? autor : "outro";

  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    if (!a) return { ok: false, error: "ação não encontrada" };

    // Marca como feita
    await db
      .update(acao)
      .set({ status: "feito", concluidoEm: new Date(), updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));

    // Cria interação genérica na timeline (fecha o ciclo visual mesmo sem
    // resultado escolhido). Tipo da interação espelha o tipo da ação.
    const tipoInter =
      a.tipo === "ligar" ? "ligacao"
      : a.tipo === "mandar_whatsapp" ? "whatsapp"
      : a.tipo === "enviar_proposta" ? "proposta"
      : a.tipo === "visitar" ? "visita"
      : "outro";
    await db.insert(interacao).values({
      contaId: a.contaId,
      tipo: tipoInter,
      texto: `Ação cumprida: ${a.descricao}`,
      autor: autorValido,
      situacaoId: null,
      tentativaNum: null,
    });

    await logAuditoria({
      contaId: a.contaId,
      acao: "marcou_acao_feita",
      campo: "acao",
      valorDepois: a.descricao,
      contexto: { obs: "Sem situação → próxima ação não disparada automaticamente. Use QuickLog pra registrar resultado." },
    });

    revalidatePath(`/contas/${a.contaId}`);
    revalidatePath("/fila");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function adiarAcao(
  acaoId: number,
  diasAFrente: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    const novaData = fmtISODate(addDays(new Date(), diasAFrente));
    await db
      .update(acao)
      .set({ dataPrevista: novaData, updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "adiou_acao",
        campo: "data_prevista",
        valorAntes: a.dataPrevista,
        valorDepois: novaData,
      });
    }
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function vincularMatriz(
  filhaContaId: number,
  matrizContaId: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    // Validações: matriz não pode ser ela mesma; matriz não pode ser filha
    if (filhaContaId === matrizContaId) return { ok: false, error: "Não pode vincular a si mesma" };
    const [matriz] = await db.select({ contaMatrizId: conta.contaMatrizId, nome: conta.nome }).from(conta).where(eq(conta.contaId, matrizContaId));
    if (!matriz) return { ok: false, error: "Matriz não encontrada" };
    if (matriz.contaMatrizId) return { ok: false, error: "Não pode vincular a uma filha (a candidata também é filha de outra rede)" };

    const [antes] = await db.select({ contaMatrizId: conta.contaMatrizId }).from(conta).where(eq(conta.contaId, filhaContaId));

    await db
      .update(conta)
      .set({ contaMatrizId: matrizContaId, updatedAt: new Date() })
      .where(eq(conta.contaId, filhaContaId));

    await logAuditoria({
      contaId: filhaContaId,
      acao: "vinculou_matriz",
      campo: "contaMatrizId",
      valorAntes: String(antes?.contaMatrizId ?? ""),
      valorDepois: `${matrizContaId} (${matriz.nome})`,
    });

    revalidatePath(`/contas/${filhaContaId}`);
    revalidatePath(`/contas/${matrizContaId}`);
    revalidatePath("/contas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function desvincularMatriz(
  contaId: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [antes] = await db.select({ contaMatrizId: conta.contaMatrizId }).from(conta).where(eq(conta.contaId, contaId));

    await db
      .update(conta)
      .set({ contaMatrizId: null, updatedAt: new Date() })
      .where(eq(conta.contaId, contaId));

    await logAuditoria({
      contaId,
      acao: "desvinculou_matriz",
      campo: "contaMatrizId",
      valorAntes: String(antes?.contaMatrizId ?? ""),
      valorDepois: "",
    });

    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/contas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function buscarFilhasCandidatas(
  query: string,
  matrizContaId: number
): Promise<{ ok: boolean; candidatas: { contaId: number; nome: string; cidade: string | null; uf: string | null; canal: string }[] }> {
  const session = await auth();
  if (!session?.user) return { ok: false, candidatas: [] };
  try {
    const q = `%${query}%`;
    const results = await db.execute(sql`
      SELECT c.conta_id AS "contaId", c.nome, c.cidade, c.uf, c.canal
      FROM b2b.conta c
      WHERE c.conta_id != ${matrizContaId}
        AND (c.conta_matriz_id IS NULL OR c.conta_matriz_id != ${matrizContaId})
        AND NOT EXISTS (SELECT 1 FROM b2b.conta f WHERE f.conta_matriz_id = c.conta_id)
        AND (c.nome ILIKE ${q} OR c.razao_social ILIKE ${q} OR c.cnpj ILIKE ${q} OR c.cidade ILIKE ${q})
      ORDER BY c.nome
      LIMIT 50
    `);
    const rows = (results as unknown as { rows?: Record<string, unknown>[] }).rows ?? (results as unknown as Record<string, unknown>[]);
    return { ok: true, candidatas: rows as { contaId: number; nome: string; cidade: string | null; uf: string | null; canal: string }[] };
  } catch {
    return { ok: false, candidatas: [] };
  }
}

export async function vincularFilhasEmMassa(
  matrizContaId: number,
  filhaIds: number[]
): Promise<{ ok: boolean; vinculadas: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, vinculadas: 0, error: "não autenticado" };
  if (filhaIds.length === 0) return { ok: true, vinculadas: 0 };
  try {
    const [matriz] = await db.select({ nome: conta.nome, contaMatrizId: conta.contaMatrizId }).from(conta).where(eq(conta.contaId, matrizContaId));
    if (!matriz) return { ok: false, vinculadas: 0, error: "Matriz não encontrada" };
    if (matriz.contaMatrizId) return { ok: false, vinculadas: 0, error: "Esta conta já é filha de outra matriz" };

    const result = await db
      .update(conta)
      .set({ contaMatrizId: matrizContaId, updatedAt: new Date() })
      .where(and(inArray(conta.contaId, filhaIds), sql`${conta.contaId} != ${matrizContaId}`));

    for (const fid of filhaIds) {
      await logAuditoria({
        contaId: fid,
        acao: "vinculou_matriz",
        campo: "contaMatrizId",
        valorDepois: `${matrizContaId} (${matriz.nome}) · vinculação em massa`,
      });
    }

    revalidatePath(`/contas/${matrizContaId}`);
    revalidatePath("/contas");
    return { ok: true, vinculadas: filhaIds.length };
  } catch (e) {
    return { ok: false, vinculadas: 0, error: (e as Error).message };
  }
}

export async function buscarMatrizesCandidatas(
  query: string,
  excluirContaId?: number
): Promise<{ ok: boolean; matrizes: { contaId: number; nome: string; cidade: string | null; uf: string | null; filhas: number }[] }> {
  const session = await auth();
  if (!session?.user) return { ok: false, matrizes: [] };
  try {
    const q = `%${query}%`;
    const results = await db.execute(sql`
      SELECT c.conta_id AS "contaId", c.nome, c.cidade, c.uf,
             (SELECT count(*)::int FROM b2b.conta f WHERE f.conta_matriz_id = c.conta_id) AS filhas
      FROM b2b.conta c
      WHERE c.conta_matriz_id IS NULL
        AND (c.nome ILIKE ${q} OR c.razao_social ILIKE ${q})
        ${excluirContaId ? sql`AND c.conta_id != ${excluirContaId}` : sql``}
      ORDER BY filhas DESC, c.nome
      LIMIT 20
    `);
    const rows = (results as unknown as { rows?: Record<string, unknown>[] }).rows ?? (results as unknown as Record<string, unknown>[]);
    return { ok: true, matrizes: rows as { contaId: number; nome: string; cidade: string | null; uf: string | null; filhas: number }[] };
  } catch {
    return { ok: false, matrizes: [] };
  }
}

export async function criarConta(dados: {
  nome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  canal: string;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  responsavel: string;
  contato?: {
    nome: string;
    cargo?: string;
    telefone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  };
}): Promise<{ ok: boolean; contaId?: number; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [inserted] = await db
      .insert(conta)
      .values({
        nome: dados.nome,
        razaoSocial: dados.razaoSocial ?? null,
        cnpj: dados.cnpj ?? null,
        canal: dados.canal,
        cidade: dados.cidade ?? null,
        uf: dados.uf ?? null,
        telefoneInstitucional: dados.telefone ?? null,
        whatsappInstitucional: dados.whatsapp ?? null,
        emailInstitucional: dados.email ?? null,
        site: dados.site ?? null,
        responsavel: dados.responsavel,
        funilStage: "base_fria",
        origemLead: "prospeccao_propria",
      })
      .returning({ contaId: conta.contaId });
    const contaId = inserted.contaId;

    if (dados.contato?.nome) {
      await db.insert(contato).values({
        contaId,
        nome: dados.contato.nome,
        cargo: dados.contato.cargo ?? "Comprador",
        telefone: dados.contato.telefone ?? null,
        whatsapp: dados.contato.whatsapp ?? null,
        email: dados.contato.email ?? null,
        papel: "decisor",
        relevancia: "alta",
        ePrincipal: true,
        ativo: true,
      });
    }

    await logAuditoria({
      contaId,
      acao: "criou_conta",
      campo: "conta",
      valorDepois: dados.nome,
    });

    revalidatePath("/contas");
    revalidatePath("/equipe");
    return { ok: true, contaId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function criarContato(
  contaId: number,
  dados: {
    nome: string;
    cargo?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    papel?: string;
    ePrincipal?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    // Se quer marcar como principal, primeiro tira o flag de outros (constraint UNIQUE WHERE e_principal=true)
    if (dados.ePrincipal) {
      await db.update(contato).set({ ePrincipal: false }).where(eq(contato.contaId, contaId));
    }
    await db.insert(contato).values({
      contaId,
      nome: dados.nome,
      cargo: dados.cargo ?? null,
      email: dados.email ?? null,
      telefone: dados.telefone ?? null,
      whatsapp: dados.whatsapp ?? null,
      papel: dados.papel ?? "outro",
      ePrincipal: dados.ePrincipal ?? false,
      ativo: true,
    });
    await logAuditoria({
      contaId,
      acao: "criou_contato",
      campo: "contato",
      valorDepois: `${dados.nome} (${dados.cargo ?? "sem cargo"})`,
    });
    revalidatePath(`/contas/${contaId}`);
    revalidatePath("/compradores");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reagendarAcao(
  acaoId: number,
  dataISO: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "não autenticado" };
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    await db
      .update(acao)
      .set({ dataPrevista: dataISO, updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "reagendou_acao",
        campo: "data_prevista",
        valorAntes: a.dataPrevista,
        valorDepois: dataISO,
      });
    }
    revalidatePath(`/contas/${a?.contaId}`);
    revalidatePath("/hoje");
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// FILA DO DIA — getProximoCard
// Retorna 1 card a servir pra pessoa, seguindo ordenação:
// 1) Tarefa explícita de homologação/cadastro/bloqueio (origem='bloqueio_homol')
// 2) Atrasada quente (cadencia_quente OU manual, data_prevista < hoje)
// 3) Conta em risco (funil quente + última interação > 15d, sem ação ativa)
// 4) Hoje (data_prevista = hoje)
// 5) Próximos 3 dias quentes
// 6) Fila de frios (base_fria, sem matriz pai, sem interação, prioridade alta primeiro)
// ============================================================

export type CardFila = {
  origem: "bloqueio" | "atrasada" | "em_risco" | "hoje" | "proximo" | "frio";
  porQue: string;
  contaId: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
  tel: string | null;
  wa: string | null;
  funilStage: string;
  requerHomol: boolean;
  statusHomol: string | null;
  requerCad: boolean;
  contatoPrincipal: string | null;
  ultimaSituacao: string | null;
  ultimaInteracaoEm: Date | null;
  ultimaInteracaoTexto: string | null;
  acaoId: number | null;
  acaoTipo: string | null;
  acaoDescricao: string | null;
  acaoDataPrevista: string | null;
};

export async function getProximoCard(
  pessoa: string,
  pulados: number[] = []
): Promise<CardFila | null> {
  const session = await auth();
  if (!session?.user) return null;

  const baseQuery = (whereExtra: string, orderExtra: string) => sql`
    SELECT c.conta_id, c.nome, c.cidade, c.uf,
           c.telefone_institucional AS tel, c.whatsapp_institucional AS wa,
           c.funil_stage, c.requer_homologacao, c.status_homologacao, c.requer_cadastro,
           (SELECT ct.nome FROM b2b.contato ct WHERE ct.conta_id=c.conta_id ORDER BY ct.e_principal DESC LIMIT 1) AS contato_principal,
           (SELECT i.situacao_id FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_situacao,
           (SELECT i.ocorrido_em FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_em,
           (SELECT i.texto FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_texto,
           a.acao_id, a.tipo AS acao_tipo, a.descricao AS acao_descricao, a.data_prevista AS acao_data
    FROM b2b.conta c
    LEFT JOIN b2b.acao a ON a.conta_id=c.conta_id AND a.status='pendente' AND a.responsavel=${pessoa}
    WHERE c.responsavel = ${pessoa}
      ${pulados.length > 0 ? sql`AND c.conta_id != ALL(${pulados}::bigint[])` : sql``}
      ${sql.raw(whereExtra)}
    ${sql.raw(orderExtra)}
    LIMIT 1
  `;

  // 1. Bloqueio (homologação/cadastro)
  let r = await db.execute(baseQuery(
    `AND a.origem = 'bloqueio_homol' AND a.status='pendente'`,
    `ORDER BY a.data_prevista ASC`
  ));
  let rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "bloqueio", rows[0].acao_descricao as string);

  // 2. Atrasada quente
  r = await db.execute(baseQuery(
    `AND a.status='pendente' AND a.data_prevista < CURRENT_DATE AND a.origem IN ('cadencia_quente','manual')`,
    `ORDER BY a.data_prevista ASC`
  ));
  rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "atrasada", "Atrasada — precisa ligar agora");

  // 3. Em risco (funil quente, última interação > 15d, sem ação ativa hoje)
  r = await db.execute(sql`
    SELECT c.conta_id, c.nome, c.cidade, c.uf,
           c.telefone_institucional AS tel, c.whatsapp_institucional AS wa,
           c.funil_stage, c.requer_homologacao, c.status_homologacao, c.requer_cadastro,
           (SELECT ct.nome FROM b2b.contato ct WHERE ct.conta_id=c.conta_id ORDER BY ct.e_principal DESC LIMIT 1) AS contato_principal,
           (SELECT i.situacao_id FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_situacao,
           (SELECT i.ocorrido_em FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_em,
           (SELECT i.texto FROM b2b.interacao i WHERE i.conta_id=c.conta_id ORDER BY i.ocorrido_em DESC LIMIT 1) AS ultima_texto,
           NULL::bigint AS acao_id, NULL::text AS acao_tipo, NULL::text AS acao_descricao, NULL::date AS acao_data
    FROM b2b.conta c
    WHERE c.responsavel = ${pessoa}
      AND c.funil_stage IN ('visitado','proposta_enviada','pedido_realizado','positivado')
      AND (SELECT max(i.ocorrido_em) FROM b2b.interacao i WHERE i.conta_id=c.conta_id) < (NOW() - INTERVAL '15 days')
      AND NOT EXISTS (SELECT 1 FROM b2b.acao a WHERE a.conta_id=c.conta_id AND a.status='pendente')
      ${pulados.length > 0 ? sql`AND c.conta_id != ALL(${pulados}::bigint[])` : sql``}
    ORDER BY (SELECT max(i.ocorrido_em) FROM b2b.interacao i WHERE i.conta_id=c.conta_id) ASC
    LIMIT 1
  `);
  rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "em_risco", "⚠️ Quente parado >15d — vai esfriar");

  // 4. Hoje
  r = await db.execute(baseQuery(
    `AND a.status='pendente' AND a.data_prevista = CURRENT_DATE`,
    `ORDER BY a.acao_id ASC`
  ));
  rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "hoje", rows[0].acao_descricao as string);

  // 5. Próximos 3 dias quentes
  r = await db.execute(baseQuery(
    `AND a.status='pendente' AND a.data_prevista <= CURRENT_DATE + INTERVAL '3 days' AND a.origem IN ('cadencia_quente','manual')`,
    `ORDER BY a.data_prevista ASC`
  ));
  rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "proximo", `Quente em ${rows[0].acao_data}`);

  // 6. Fila de frios (sem interação, sem matriz pai, prioridade alta primeiro)
  r = await db.execute(sql`
    SELECT c.conta_id, c.nome, c.cidade, c.uf,
           c.telefone_institucional AS tel, c.whatsapp_institucional AS wa,
           c.funil_stage, c.requer_homologacao, c.status_homologacao, c.requer_cadastro,
           NULL::text AS contato_principal,
           NULL::text AS ultima_situacao, NULL::timestamptz AS ultima_em, NULL::text AS ultima_texto,
           NULL::bigint AS acao_id, NULL::text AS acao_tipo, NULL::text AS acao_descricao, NULL::date AS acao_data
    FROM b2b.conta c
    WHERE c.responsavel = ${pessoa}
      AND c.funil_stage = 'base_fria'
      AND c.conta_matriz_id IS NULL
      AND coalesce(c.prioridade_manual, c.prioridade_calc) != 'descartar'
      AND NOT EXISTS (SELECT 1 FROM b2b.interacao i WHERE i.conta_id=c.conta_id)
      ${pulados.length > 0 ? sql`AND c.conta_id != ALL(${pulados}::bigint[])` : sql``}
    ORDER BY
      CASE coalesce(c.prioridade_manual, c.prioridade_calc)
        WHEN 'alta' THEN 0 WHEN 'media' THEN 1 WHEN 'baixa' THEN 2 ELSE 3 END ASC,
      c.conta_id
    LIMIT 1
  `);
  rows = (r as unknown as { rows?: Record<string, unknown>[] }).rows ?? (r as unknown as Record<string, unknown>[]);
  if (rows.length > 0) return mapCard(rows[0], "frio", "Primeira abordagem");

  return null;
}

function mapCard(row: Record<string, unknown>, origem: CardFila["origem"], porQue: string): CardFila {
  return {
    origem,
    porQue,
    contaId: Number(row.conta_id),
    nome: String(row.nome),
    cidade: (row.cidade as string) ?? null,
    uf: (row.uf as string) ?? null,
    tel: (row.tel as string) ?? null,
    wa: (row.wa as string) ?? null,
    funilStage: String(row.funil_stage),
    requerHomol: Boolean(row.requer_homologacao),
    statusHomol: (row.status_homologacao as string) ?? null,
    requerCad: Boolean(row.requer_cadastro),
    contatoPrincipal: (row.contato_principal as string) ?? null,
    ultimaSituacao: (row.ultima_situacao as string) ?? null,
    ultimaInteracaoEm: row.ultima_em ? new Date(row.ultima_em as string) : null,
    ultimaInteracaoTexto: (row.ultima_texto as string) ?? null,
    acaoId: row.acao_id ? Number(row.acao_id) : null,
    acaoTipo: (row.acao_tipo as string) ?? null,
    acaoDescricao: (row.acao_descricao as string) ?? null,
    acaoDataPrevista: (row.acao_data as string) ?? null,
  };
}

