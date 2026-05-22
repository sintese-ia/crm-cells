# Deploy no Easypanel — Cells CRM

## 1. No painel Easypanel (sinteseia)

1. **App → Create → From Source**
2. Source: **GitHub** (ou Git remoto)
   - Repositório: `cells-crm-app` (a criar)
   - Branch: `main`
3. **Build:** Dockerfile (já está no repo)
4. **Port:** `3000`

## 2. Environment Variables

```
DATABASE_URL=postgresql://claude_b2b:HUGGlvuTsBYuduJTP4RvG7rOho4ANtzt@cells-postgres:5432/dadoscells
AUTH_SECRET=<gerar com: openssl rand -base64 32>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://crm.sinteseia.com.br
NODE_ENV=production
```

> **Atenção:** dentro do Easypanel, o host do Postgres geralmente é o nome do serviço interno (ex: `cells-postgres` ou `dadoscells`). Confirma no painel. Se a app está no mesmo project, conexão é via rede interna (latência 0). Se está em project separado, use `easypanel.sinteseia.com.br:5432`.

## 3. Domain

- **Add domain:** `crm.sinteseia.com.br`
- **SSL:** Let's Encrypt (Easypanel cuida)
- DNS já deve estar apontando pra IP do Easypanel (se o painel está em `easypanel.sinteseia.com.br`, é o mesmo IP)

## 4. Primeiro deploy

- Easypanel buildica o Dockerfile (~2-3 min)
- Se passar, aparece "Running" em verde
- Acessar `https://crm.sinteseia.com.br/login`
- Login: `gabriel@cells.com.br` / senha `cells2026` (TROCAR DEPOIS no `src/auth.ts`)

## 5. Atualizar senhas/usuários

Edita `src/auth.ts` (array `USUARIOS`) e commit + push. Easypanel redeploya automático.

Pra senha melhor, trocar pra hash bcrypt e arquivo separado depois.

## 6. Troubleshooting

- **DB connection refused:** confere se `DATABASE_URL` usa host interno do Easypanel (não `localhost`)
- **NEXT_REDIRECT em produção:** `AUTH_TRUST_HOST=true` é obrigatório
- **Imagens não carregam:** Easypanel proxy pode precisar ativar "forward host header"

## 7. Próximos passos pós-deploy

- [ ] Trocar `AUTH_SECRET` por valor real
- [ ] Trocar senha padrão `cells2026` por uma por usuário
- [ ] Rodar `/importar` (modo real) pra subir 2006 leads da MASTER → b2b.conta
- [ ] Verificar contatos (b2b.contato vazio — depois quando alguém cadastrar)
- [ ] Validar com Yas e Gabi
