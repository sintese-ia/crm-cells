# Cells CRM

CRM B2B interno da Cells DTC. Next.js 16 + Drizzle + Postgres (schema `b2b`).

## Stack

- Next.js 16 + TypeScript + Tailwind + shadcn/ui
- Drizzle ORM sobre Postgres (schema `b2b` em `dadoscells`)
- NextAuth v5 (credenciais hardcoded — trocar pra magic link depois)
- Identidade visual Cells (carbon/bone/signal · Alias Extended/DM Sans)

## Telas

- `/hoje` — fila de ações pendentes do dia por responsável
- `/contas` — lista filtrável (busca, funil, canal, resp, temp, UF)
- `/contas/[id]` — detail com timeline de interações + contatos + edição inline
- `/pipeline` — kanban arrastável (funil_stage)
- `/dashboard` — counts por funil/canal/responsável
- `/importar` — importa MASTER do Google Sheets → upsert em `b2b.conta`

## Regras de FUP automático

Quando uma interação é criada, o sistema analisa o texto e cria automaticamente
uma `b2b.acao` (próxima ação) baseada nestas regras (em ordem de prioridade):

1. **Data específica** mencionada ("daqui 5 dias", "próxima semana", "12/06") → respeita
2. **Positivada/Fechou** → onboarding D+7
3. **Reunião marcada** → pós-reunião D+3
4. **Negativa/Adiado** → retoma D+45
5. **Pediu material/Aguardando** → cobra D+2
6. **Respondeu** → nova abordagem D+2
7. **Sem resposta/Não atendeu** → nova tentativa D+7

Ações pendentes anteriores da mesma conta são canceladas (não empilha).

## Deploy no Easypanel

### Variáveis de ambiente

```
DATABASE_URL=postgresql://claude_b2b:<senha>@<host_interno>:5432/dadoscells
AUTH_SECRET=<gerar com `openssl rand -base64 32`>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://crm.sinteseia.com.br
GOOGLE_OAUTH_TOKEN_JSON=<conteúdo do oauth-token.json em 1 linha>
```

### Setup

1. Easypanel → New Service → **App** → **Source: GitHub**
   - Repo: `sintese-ia/crm-cells`
   - Branch: `main`
   - Build: Dockerfile
2. Port: `3000`
3. Cola as env vars acima
4. **Domain:** adiciona `crm.sinteseia.com.br` (SSL automático via Let's Encrypt)
5. Deploy

### Host interno do Postgres

Se o Postgres está no mesmo project do Easypanel, usa o nome interno do serviço
(geralmente `<project>_dadoscells` ou similar). Se está em outro project, usa
`easypanel.sinteseia.com.br:5432` (público, mais lento).

## Tabelas relevantes (schema `b2b`)

- `b2b.conta` (1932 linhas) — institucional
- `b2b.contato` (600 linhas) — pessoas-chave por conta (N:1)
- `b2b.interacao` — log cronológico de toques
- `b2b.acao` — próximas ações agendadas (FUP)

## Usuários

Hardcoded em `src/auth.ts` (trocar pra magic link Google depois):

- `gabriel@cells.com.br` / `cells2026`
- `yas@cells.com.br` / `cells2026`
- `gabi@cells.com.br` / `cells2026`

## Scripts

- `scripts/import-master.mjs` — importa MASTER do Sheets (rodar `node scripts/import-master.mjs --dry` pra simular)
