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
      if (s?.autoFunil && s.autoFunil !== c?.funilStage) {
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

          await db.insert(acao).values({
            contaId,
            descricao: r.descricaoAcao,
            tipo: r.tipoProximaAcao,
            dataPrevista: dataPrev,
            responsavel: responsavelValido,
            status: "pendente",
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
  try {
    const [a] = await db.select().from(acao).where(eq(acao.acaoId, acaoId));
    await db
      .update(acao)
      .set({ status: "feito", concluidoEm: new Date(), updatedAt: new Date() })
      .where(eq(acao.acaoId, acaoId));
    if (a) {
      await logAuditoria({
        contaId: a.contaId,
        acao: "marcou_acao_feita",
        campo: "acao",
        valorDepois: a.descricao,
      });
    }
    revalidatePath("/hoje");
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

