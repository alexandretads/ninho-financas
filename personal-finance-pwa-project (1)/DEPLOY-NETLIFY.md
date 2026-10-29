# Ninho no Netlify — guia de produção

Este projeto está configurado para rodar no Netlify como **SPA + PWA + Netlify Functions** para o Stripe.

## 1. O que já está pronto

- `netlify.toml` com build, redirects SPA, cabeçalhos de segurança e cache do PWA.
- Funções serverless:
  - `netlify/functions/payments.mjs` — configuração e criação de Checkout de assinatura no Stripe (preços no servidor).
  - `netlify/functions/verify-payment.mjs` — verifica no Stripe se a sessão foi realmente paga.
  - `netlify/functions/billing-portal.mjs` — abre o portal oficial do Stripe para o cliente trocar pagamento ou cancelar a assinatura.
  - `netlify/functions/stripe-webhook.mjs` — valida a assinatura do webhook (pronto para conectar banco remoto).
- Checkout real com redirecionamento para o Stripe; fallback automático para pagamento demonstrativo quando não há chave.
- Primeiro acesso seguro: banco vazio, primeira conta criada vira administradora. Não existe senha padrão.
- PWA instalável com ícones 192/512/apple-touch e service worker.
- Metas, planos, clientes, promoções, módulo de vendas licenciável, crédito, comissões e recuperação de senha.

## 2. Deploy rápido

### Via painel do Netlify
1. Envie o projeto para um repositório no GitHub/GitLab.
2. No Netlify: **Add new site → Import an existing project**.
3. Selecione o repositório.
4. Confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Em **Site configuration → Environment variables**, configure as variáveis da seção 3.
6. Faça o deploy.

### Via CLI
```bash
npm install
npm run build
npx netlify-cli deploy --prod
```

O arquivo `netlify.toml` já contém a configuração necessária.

## 3. Variáveis de ambiente

| Variável | Onde usar | Obrigatória? | Descrição |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Netlify Functions | Para cobranças reais | `sk_test_...` para teste, `sk_live_...` para produção. Nunca prefixe com `VITE_`. |
| `STRIPE_WEBHOOK_SECRET` | Webhook | Recomendada | `whsec_...` do endpoint do webhook. |
| `VITE_SUPPORT_EMAIL` | Build | Opcional | E-mail exibido no suporte e nos pedidos de liberação de módulo. |
| `VITE_DEMO_MODE` | Build | Opcional | `false` (padrão do deploy). `true` cria dados fictícios de demonstração. |
| `URL` | Netlify | Automática | A Netlify injeta a URL pública. |
| `ALLOWED_ORIGINS` | Netlify Functions | Opcional | Domínios extras permitidos no checkout, separados por vírgula. |

> **Importante:** `STRIPE_SECRET_KEY` é server-side. Ela **não** deve ser exposta no bundle do navegador. Só as variáveis `VITE_*` vão para o cliente.

## 4. Configurar o Stripe

1. Crie uma conta em <https://stripe.com> e confirme o modo **Teste**.
2. Em **Developers → API keys**, copie a chave secreta de teste (`sk_test_...`).
3. No Netlify, adicione `STRIPE_SECRET_KEY`.
4. Faça um novo deploy (variáveis só entram no próximo build/deploy das funções).
5. No app, abra **Assinatura → trocar plano**. O checkout hospedado do Stripe deve abrir.
6. Cartão de teste: `4242 4242 4242 4242`, validade futura e CVC qualquer.
7. Para produção, troque a chave para `sk_live_...` e faça o teste final com um valor real pequeno.

### Portal de assinatura (cancelamento)
No Stripe, ative o **Billing Portal** em **Settings → Billing → Customer portal** e permita as ações desejadas (atualizar cartão, cancelar, ver faturas). O botão **Gerenciar assinatura** no Ninho abre esse portal.

### Webhook
Crie o endpoint no Stripe:
```
https://SEU-SITE.netlify.app/.netlify/functions/stripe-webhook
```
Eventos recomendados:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copie o `whsec_...` e configure `STRIPE_WEBHOOK_SECRET`.

### Cupons e promoções
O Stripe Checkout está com `allow_promotion_codes=true`. Crie códigos promocionais no painel do Stripe para descontos reais. Os cupons internos do Ninho (criados pelo admin) são aplicáveis apenas no modo demonstrativo, pois ainda não existe um banco remoto compartilhado para validá-los no servidor.

## 5. Primeiro acesso ao site publicado

1. Abra a URL do Netlify.
2. A tela mostrará **Configurar o administrador**.
3. Crie a conta com seu nome, e-mail e senha.
4. Guarde o **código de recuperação** exibido uma única vez.
5. Entre com a senha e finalize o setup.
6. Vá em **Ajustes → Casa compartilhada** para convidar alguém.
7. Vá em **Assinatura** para testar o Stripe.

> Faça o primeiro acesso logo após publicar. Quem criar a primeira conta vira administrador.

## 6. Checklist de segurança antes de clientes reais

- [ ] Trocar a senha do admin e guardar o código de recuperação.
- [ ] `VITE_DEMO_MODE=false`.
- [ ] `STRIPE_SECRET_KEY` em modo live somente quando os testes estiverem concluídos.
- [ ] Webhook configurado e `STRIPE_WEBHOOK_SECRET` presente.
- [ ] Testar pagamento aprovado, recusado e cancelado.
- [ ] Testar login, recuperação de senha, convite e troca de planos.
- [ ] Exportar backup em Ajustes.
- [ ] Revisar os termos/privacidade antes de abrir ao público.

## 7. Limitações conhecidas desta versão

- **Persistência local:** contas, senhas, lançamentos e assinaturas ficam no `localStorage` do navegador. O Stripe cobra de verdade, mas a liberação do plano é registrada no navegador após a verificação server-side da sessão.
- **Sem sincronização entre celulares:** para dois aparelhos e um banco central, conecte Supabase/PostgreSQL e RLS no servidor. O webhook já está preparado para esse passo.
- **Troca de plano no Stripe:** a assinatura é criada no checkout e pode ser gerenciada/cancelada no portal. Alterações feitas no portal são refletidas no Stripe; o estado local é atualizado no próximo pagamento/renovação confirmado. Para sincronização automática, conecte o webhook ao banco remoto.
- **Recuperação de senha:** o código de recuperação funciona localmente; o envio automático por e-mail exige backend transacional (Resend, SendGrid etc.).
- **Promoções:** o envio pelo admin é local até existir banco remoto.
- **Pagamento Pix:** o Stripe Checkout desta versão está configurado para cartão em assinaturas; Pix pode ser habilitado no Stripe conforme sua conta e tipo de cobrança.

## 8. Diagnóstico rápido

| Sintoma | Causa provável | Solução |
|---|---|---|
| Checkout abre em modo demonstração | `STRIPE_SECRET_KEY` ausente/inválida | Configurar variável e refazer deploy |
| `/.netlify/functions/payments` retorna 404 | Função não publicada | Confirmar `functions = "netlify/functions"` e que o deploy é Netlify |
| Tela branca após deploy | base/redirect incorreto | Confirmar publish `dist` e redirect `/* → /index.html` |
| PWA não instala | ícones ausentes/CSP | Verificar `/icon-192.png`, `/icon-512.png`, manifest e headers |
| Pagamento aprovado não ativou | Retorno sem `session_id` ou sessão não paga | Verificar Function `verify-payment` e logs do Stripe |
| Webhook 400 | assinatura inválida | Conferir `STRIPE_WEBHOOK_SECRET` |

## 9. Comandos locais

```bash
npm install
npm run dev          # front-end
npx netlify-cli dev  # front-end + functions (recomendado para pagamentos)
npm run build        # build de produção em dist/
npx netlify-cli deploy --prod
```

Para que o checkout real funcione localmente, use `netlify dev` e defina as variáveis no painel do Netlify ou em `.env` (nunca versione `.env`).
