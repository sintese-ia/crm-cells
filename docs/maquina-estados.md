# CRM Cells — Direcional de Build (máquina de estados do lead)

> Regra de implementação. Fonte: doc do Gabriel + HTML `crm-cells-maquina-estados.html`.

---

## 0. A filosofia que rege TUDO

**O status é sugerido pelas interações, nunca imposto por elas.**

A máquina é **GPS, não trilho.** Recalcula a rota e sugere o próximo passo — mas o usuário sempre pode pular etapas, ir direto, ou corrigir.

- **Nada bloqueia.** Não existe pré-requisito que impeça uma ação.
- **As "travas" do diagrama são DIRECIONAMENTO, não muro.** Sugere ordem + sinaliza fora de sequência (badge), mas permite.
- **Usuário pode forçar qualquer status** registrando a interação correspondente. Interação é fonte da verdade; status é derivado.
- **Objetivo:** reduzir carga cognitiva, não criar burocracia.

Em dúvida entre "rígido e correto" vs "flexível e simples" → **flexível.** O problema é "tá difícil de operar", não "falta controle".

---

## 1. STATUS_LEAD — funil (novo)

```
sem_contato → contato_realizado → reuniao → em_negociacao → pedido_realizado → positivada
                                                                                    ↘ negativa
```

`funil_stage` derivado da última interação. `negativa` alcançável de qualquer etapa.

---

## 2. Estrutura de 3 níveis

```
STATUS_LEAD (funil_stage)
 └─ TIPO_INTERACAO (ligacao, whatsapp, reuniao, proposta, cadastro, amostra,
                    fup, nota_boleto, entrega, despacho, treinamento, degustacao, negativa)
     └─ SITUACAO (atendeu, nao_atendeu, realizada, enviado, etc)
```

Cada situação dispara 3 efeitos como **sugestão**:
1. `move_funil_para` — sugere etapa
2. recalcula temperatura — automático
3. cria próxima ação — regra de cadência

---

## 3. Toda interação tem DATA

- `ocorrido_em` em toda interação, editável sempre.
- Em alguns tipos a data é o input: `reuniao`, `entrega`, `treinamento`, `degustacao` → data futura.
- Interação com data futura também vira **ação** (aparece na Fila no dia).

---

## 4. Catálogo de situações (popular `b2b.situacao`)

### CONTATO_REALIZADO
- **Ligação:** `atendeu` (→contato_realizado) · `nao_atendeu` (cadência frio) · `reuniao_agendada` (→reuniao, pede data)
- **WhatsApp:** `respondeu` (→contato_realizado) · `nao_respondeu` (cadência frio) · `reuniao_agendada`

### REUNIAO
- `agendada` **(auto)** com data
- `realizada` (→em_negociacao + notas do cliente)
- `adiada` (pede nova data)
- `cancelada` (↩ contato_realizado)

### EM_NEGOCIACAO (frentes paralelas)
- **Proposta:** `proposta_enviada` (cria FUP +3/+7/+14)
- **Cadastro** (se `requer_cadastro`): `necessario` · `solicitado` · `realizado` · `nao_necessario`
- **Amostra:** `a_enviar` · `enviado` (trava FUP 7d) · `chegou` · `nao_necessario`
- **FUP:** `respondeu` (→pedido_realizado se fechou) · `nao_respondeu`

### PEDIDO_REALIZADO (fulfillment paralelo, ordem sugerida)
- **Nota+boleto:** `a_realizar` **(auto)** · `realizado`
- **Entrega:** `a_agendar` **(auto)** · `agendado` (pede data) · `nao_necessario`
- **Despacho:** `a_realizar` **(auto)** · `realizado` (→positivada)

> Se `despacho=realizado` sem entrega agendada: **permite** + aviso suave. Não impede.

### POSITIVADA (pós-venda)
- **Treinamento:** `nao_necessario` · `nao_agendado` · `agendado` (data) · `realizado`
- **Degustação:** `nao_necessario` · `nao_agendado` · `agendado` (data) · `realizado`
- **FUP recompra:** `respondeu` (sellout 30d) · `nao_respondeu` (risco churn)

### NEGATIVA (de qualquer etapa)
`negativa` + **motivo obrigatório** (margem · preço · gôndola · concorrente · sem_interesse · pedido_minimo · giro · outro) → reabordagem +45d.

---

## 5. Atalho "ir direto"

- Todos os tipos/situações **sempre acessíveis**.
- Sugeridos pelo estado atual em **destaque** (botões grandes); resto em dropdown.
- Ex: `sem_contato` → vendedor fecha na feira → marca `pedido_realizado` direto → sistema move + cria fulfillment.

---

## 6. Cadência (popular `b2b.regra_cadencia`)

| Gatilho | Próxima ação |
|---|---|
| ligação/wa não atendeu — frio | +7/+7/+14 → reabordagem +30d |
| wa respondeu não agendou | +2/+4/+7 → esfria, reaborda +21d |
| proposta enviada | +3/+7/+14 |
| amostra enviada | trava FUP 7d, depois "confirmar recebimento + feedback" |
| reunião agendada | confirmar D-1 |
| pedido realizado | dispara fulfillment (3 frentes) |
| despacho realizado | → positivada + pós-venda (treino sem.2, sellout 30d, degustação 45d) |
| negativa + motivo | reabordagem +45d |

**Regra:** uma ação ativa por conta. **Exceção:** fulfillment de `pedido_realizado` = checklist com 3 frentes simultâneas.

---

## 7. Pré-requisitos como atributos (não etapas)

- `requer_homologacao` (bool) — portão da matriz, herda pras filhas.
- `requer_cadastro` (bool) — default true pra rede grande.

Quando `true` e não cumprido: sistema **sugere** tarefa + **sinaliza** fora de ordem — **não bloqueia**.

---

## 8. NÃO fazer

- Não criar trava dura.
- Não exigir pré-requisito pra avançar.
- Não esconder situações do catálogo (só priorizar).
- Não tratar `funil_stage` como editável (só admin força).
- Temperatura/prioridade sempre derivadas.

---

## 9. Critério de pronto

- [ ] Registro qualquer interação → funil_stage recalcula sozinho.
- [ ] Marcar `pedido_realizado` num lead `sem_contato` funciona (avisa).
- [ ] Toda interação salva com data; reunião/entrega/treino deixa escolher.
- [ ] Marcar situação cria próxima ação certa.
- [ ] `despacho realizado` → positivada + agenda pós-venda.
- [ ] Nenhuma ação bloqueada — no máximo, avisada.
