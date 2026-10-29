# Ninho — finanças na palma da mão

App de finanças pessoais e do casal com login, casa compartilhada, planos, metas, crédito, comissões e módulo de vendas licenciável.

## Rodar localmente

```bash
npm install
npm run dev
```

Para testar as funções do Stripe localmente:

```bash
npx netlify-cli dev
```

## Build

```bash
npm run build
# saída em dist/
```

## Deploy no Netlify

Consulte **[DEPLOY-NETLIFY.md](./DEPLOY-NETLIFY.md)**. O projeto já inclui:

- `netlify.toml` com build, SPA e cabeçalhos de segurança;
- Netlify Functions para Stripe (`netlify/functions/`);
- PWA com ícones e service worker;
- primeiro acesso que cria o administrador sem senha padrão.

Variáveis mais importantes:

```env
VITE_DEMO_MODE=false
VITE_SUPPORT_EMAIL=suporte@seudominio.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Contas de demonstração

Somente quando `VITE_DEMO_MODE=true` no build. Em produção o banco começa vazio e a primeira conta criada é a administradora.

## Segurança e limitações

- Senhas com PBKDF2 + salt; sessão assinada e revogável.
- Stripe Checkout hospedado, com preços definidos no servidor.
- Dados financeiros e de conta ficam no `localStorage` deste navegador. Para sincronização entre celulares e cobrança com banco central, conecte Supabase/PostgreSQL e use o webhook já incluído.
