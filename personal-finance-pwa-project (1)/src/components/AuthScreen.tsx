import React from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Button, Field, Input, Modal, Logo } from "./ui";
import { useToast } from "./Toast";
import { ADMIN_EMAIL, DEMO_BUILD, DEMO_EMAIL, DEMO_MODE_KEY, SUPPORT_EMAIL, passwordStrength, useAuth } from "../state/auth";
import { useTheme } from "../state/theme";
import { Moon, Sun } from "lucide-react";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const { ready, db, signIn, signUp, resetPasswordWithCode } = useAuth();
  const firstRun = db.accounts.length === 0;
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = React.useState<Mode>("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [demoData, setDemoData] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [demoMode, setDemoMode] = React.useState(() => {
    if (!DEMO_BUILD) return false;
    try {
      return localStorage.getItem(DEMO_MODE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [showDemo, setShowDemo] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryEmail, setRecoveryEmail] = React.useState("");
  const [recoveryCode, setRecoveryCode] = React.useState("");
  const [recoveryPassword, setRecoveryPassword] = React.useState("");
  const [recoveryConfirm, setRecoveryConfirm] = React.useState("");
  const [recoveryBusy, setRecoveryBusy] = React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);
  const [newRecoveryCode, setNewRecoveryCode] = React.useState<string | null>(null);
  const [signupRecoveryCode, setSignupRecoveryCode] = React.useState<string | null>(null);
  const [signupRecoveryAck, setSignupRecoveryAck] = React.useState(false);
  const [cleanEmailForSignup, setCleanEmailForSignup] = React.useState("");

  React.useEffect(() => {
    if (!DEMO_BUILD) {
      setDemoMode(false);
      return;
    }
    try {
      setDemoMode(localStorage.getItem(DEMO_MODE_KEY) !== "off");
    } catch {
      setDemoMode(true);
    }
  }, []);

  function disableDemo() {
    try {
      localStorage.setItem(DEMO_MODE_KEY, "off");
    } catch {
      // ignora
    }
    setDemoMode(false);
    toast.push("Acesso de demonstração ocultado. Use os seus logins reais.", "success");
  }

  const strength = passwordStrength(password);

  function fillDemo(kind: "user" | "admin") {
    setMode("login");
    setEmail(kind === "admin" ? ADMIN_EMAIL : DEMO_EMAIL);
    setError(null);
  }

  async function submitRecovery(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError(null);
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError("As senhas não conferem.");
      return;
    }
    setRecoveryBusy(true);
    const result = await resetPasswordWithCode(recoveryEmail, recoveryCode, recoveryPassword);
    setRecoveryBusy(false);
    if (!result.ok) {
      setRecoveryError(result.message ?? "Não foi possível redefinir.");
      return;
    }
    setNewRecoveryCode(result.recoveryCode ?? null);
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryConfirm("");
    setMode("login");
    setEmail(recoveryEmail);
    setPassword("");
    toast.push("Senha redefinida. Entre com a nova senha.");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login" && !firstRun) {
        const result = await signIn(email, password);
        if (!result.ok) setError(result.message ?? "Não foi possível entrar.");
        else {
          window.location.hash = "overview";
          if (result.message) toast.push(result.message, "warning");
          else toast.push("Bem-vindo de volta ao Ninho.");
        }
      } else {
        if (password !== confirmPassword) {
          setError("As senhas não conferem.");
          return;
        }
        if (!acceptTerms) {
          setError("Aceite os termos de uso para continuar.");
          return;
        }
        const result = await signUp({ name, email, password, seedDemo: demoData, firstAdmin: firstRun });
        if (!result.ok) setError(result.message ?? "Não foi possível criar a conta.");
        else {
          setSignupRecoveryAck(false);
          setCleanEmailForSignup(email.trim().toLowerCase());
          setSignupRecoveryCode(result.recoveryCode ?? null);
          toast.push("Seu Ninho foi criado. Guarde o código de recuperação.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid min-h-dvh max-w-[1240px] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden border-r p-10 lg:flex lg:flex-col" style={{ borderColor: "var(--border)", background: "var(--hero-bg)" }}>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(204,245,110,.18), transparent 68%)" }}
          />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="chip !border-white/15 !bg-white/[0.06] !text-[9px] !text-white/70">beta</span>
            </div>

            <div className="mt-auto">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ccf56e]">Finanças na palma da mão</p>
              <h1 className="font-display mt-3 max-w-[460px] text-[36px] font-semibold leading-[1.08] tracking-[-0.05em] text-white">
                Um Ninho para o seu dinheiro — e para o de quem você ama.
              </h1>
              <p className="mt-4 max-w-[430px] text-[13px] leading-relaxed text-white/55">
                Plano do mês, gastos no crédito, comissões, metas e sonhos em um só lugar. Dois logins, os mesmos dados, nenhuma planilha.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Wallet, title: "Plano e gastos", text: "Planejado x realizado, sem susto no fim do mês." },
                  { icon: Target, title: "Metas com sugestões", text: "O Ninho calcula quanto guardar e como chegar lá." },
                  { icon: Users, title: "Casa compartilhada", text: "Cada um com seu login, o mesmo Ninho." },
                  { icon: ShieldCheck, title: "Dados salvos", text: "Cada login guarda tudo o que foi editado." },
                ].map((feature) => (
                  <div key={feature.title} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <feature.icon size={15} className="text-[#ccf56e]" />
                    <p className="mt-2 text-[11px] font-bold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-white/45">{feature.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/35">Planos a partir de</span>
                <span className="num text-[17px] font-semibold text-white">R$ 34,90<span className="text-[10px] font-medium text-white/45"> /mês</span></span>
                <span className="rounded-full border border-[#ccf56e]/25 bg-[#ccf56e]/10 px-2 py-1 text-[8.5px] font-bold text-[#d9ff8e]">
                  anual com desconto
                </span>
              </div>
            </div>

            <p className="mt-auto pt-8 text-[9px] leading-relaxed text-white/25">
              {DEMO_BUILD
                ? "Ambiente de demonstração: contas e pagamentos são armazenados neste navegador."
                : "Dados salvos neste dispositivo. Pagamentos de assinatura processados pelo Stripe."}
            </p>
          </div>
        </aside>

        <main className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
          <div className="flex items-center justify-between">
            <div className="lg:hidden"><Logo /></div>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="icon-btn ml-auto"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8">
            <div className="lg:hidden">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Finanças na palma da mão</p>
              <h1 className="font-display mt-2 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-[var(--text)]">
                {firstRun ? "Bem-vindo ao seu Ninho" : "Bem-vindo ao Ninho"}<span style={{ color: "var(--accent)" }}>.</span>
              </h1>
            </div>

            <div className="mt-6 hidden lg:block">
              <h2 className="font-display text-[24px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                {firstRun ? "Configurar o administrador" : mode === "login" ? "Entrar no seu Ninho" : "Criar seu Ninho"}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                {firstRun
                  ? "Primeiro acesso deste Ninho. A conta criada aqui será a administradora: gerencia clientes, planos, módulos e promoções."
                  : mode === "login"
                    ? "Use o e-mail e a senha que você cadastrou."
                    : "Comece com 14 dias de teste. Sem cartão agora."}
              </p>
            </div>

            {!firstRun ? (
              <div className="segmented mt-6">
                <button type="button" data-active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>Entrar</button>
                <button type="button" data-active={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>Criar conta</button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border p-3" style={{ borderColor: "rgba(204,245,110,.25)", background: "var(--success-soft)" }}>
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text)]"><ShieldCheck size={12} /> Primeiro acesso</p>
                <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
                  Crie a conta de administrador agora. Depois de criada, outras pessoas só entram por convite ou assinatura. Não há senha padrão exposta.
                </p>
              </div>
            )}

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {mode === "signup" || firstRun ? (
                <Field label={firstRun ? "Seu nome (administrador)" : "Seu nome"}>
                  <div className="relative">
                    <UserRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos te chamar?" className="!pl-9" autoComplete="name" />
                  </div>
                </Field>
              ) : null}

              <Field label="E-mail">
                <div className="relative">
                  <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@email.com"
                    className="!pl-9"
                    autoComplete="email"
                  />
                </div>
              </Field>

              <Field label="Senha">
                <div className="relative">
                  <LockKeyhole size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "Sua senha"}
                    className="!pl-9 !pr-10"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-3)]"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              {mode === "signup" || firstRun ? (
                <>
                  {password ? (
                    <div className="flex items-center gap-2">
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          className="h-1 flex-1 rounded-full"
                          style={{
                            background:
                              index < strength
                                ? strength <= 1 ? "var(--coral)" : strength === 2 ? "var(--amber)" : "var(--accent)"
                                : "var(--surface-3)",
                          }}
                        />
                      ))}
                      <span className="w-[64px] text-right text-[8.5px] font-bold" style={{ color: "var(--muted)" }}>
                        {strength <= 1 ? "fraca" : strength === 2 ? "média" : strength === 3 ? "boa" : "forte"}
                      </span>
                    </div>
                  ) : null}
                  <Field label="Confirmar senha">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                  </Field>

                  {!firstRun ? <button
                    type="button"
                    onClick={() => setDemoData((current) => !current)}
                    className="flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left"
                    style={{ borderColor: demoData ? "var(--accent)" : "var(--border)", background: demoData ? "var(--success-soft)" : "var(--surface-2)" }}
                  >
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
                      style={{
                        borderColor: demoData ? "var(--accent)" : "var(--border-strong)",
                        background: demoData ? "var(--accent)" : "transparent",
                        color: "var(--accent-ink)",
                      }}
                    >
                      {demoData ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="block text-[10.5px] font-bold text-[var(--text)]">Começar com dados de exemplo</span>
                      <span className="block text-[9px] text-[var(--muted)]">Útil para explorar. Você pode substituir tudo depois.</span>
                    </span>
                  </button> : null}

                  <button
                    type="button"
                    onClick={() => setAcceptTerms((current) => !current)}
                    className="flex items-start gap-2 text-left"
                  >
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
                      style={{
                        borderColor: acceptTerms ? "var(--accent)" : "var(--border-strong)",
                        background: acceptTerms ? "var(--accent)" : "transparent",
                        color: "var(--accent-ink)",
                      }}
                    >
                      {acceptTerms ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                    <span className="text-[9.5px] leading-relaxed text-[var(--muted)]">
                      Aceito guardar meus dados neste dispositivo e concordo com o uso do Ninho para organização financeira.
                    </span>
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-[10px] font-bold text-[var(--accent)] hover:underline"
                    onClick={() => {
                      setRecoveryOpen(true);
                      setRecoveryError(null);
                      setNewRecoveryCode(null);
                      setRecoveryEmail(email);
                    }}
                  >
                    Esqueci minha senha
                  </button>
                  <button type="button" className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setMode("signup")}>
                    Criar conta
                  </button>
                </div>
              )}

              {error ? (
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,128,140,.3)", background: "var(--coral-soft)" }}>
                  <p className="text-[10.5px] leading-relaxed text-[var(--danger)]">{error}</p>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? <KeyRound size={16} /> : <Sparkles size={16} />}
                {busy ? "Verificando..." : firstRun ? "Criar administrador" : mode === "login" ? "Entrar" : "Criar meu Ninho"}
                {!busy ? <ArrowRight size={15} /> : null}
              </Button>
            </form>

            {DEMO_BUILD ? <div className="mt-5 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {demoMode ? "Ambiente de demonstração" : "Demonstração desativada"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowDemo((current) => !current)}
                  className="text-[8.5px] font-bold text-[var(--accent)]"
                >
                  {showDemo ? "ocultar" : "ver contas"}
                </button>
              </div>
              {demoMode && showDemo ? (
                <>
                  <div className="mt-2 space-y-1.5">
                    <button type="button" onClick={() => fillDemo("user")} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-[var(--surface-3)]">
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-bold text-[var(--text)]">Pessoa · {DEMO_EMAIL}</span>
                        <span className="block text-[8.5px] text-[var(--muted)]">preencher e-mail</span>
                      </span>
                      <ArrowRight size={11} className="shrink-0 text-[var(--faint)]" />
                    </button>
                    <button type="button" onClick={() => fillDemo("admin")} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-[var(--surface-3)]">
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-bold text-[var(--text)]">Admin · {ADMIN_EMAIL}</span>
                        <span className="block text-[8.5px] text-[var(--muted)]">preencher e-mail</span>
                      </span>
                      <ArrowRight size={11} className="shrink-0 text-[var(--faint)]" />
                    </button>
                  </div>
                  <p className="mt-2 text-[8px] leading-relaxed text-[var(--faint)]">
                    A senha não é exibida. Use a que você definiu no primeiro acesso ou peça uma redefinição ao administrador.
                  </p>
                </>
              ) : (
                <div className="mt-2 flex items-start gap-2">
                  <p className="flex-1 text-[8.5px] leading-relaxed text-[var(--muted)]">
                    {demoMode
                      ? "As contas de teste estão ocultas. Elas continuam existindo até você trocar as senhas."
                      : "Use os logins que você criou. Nenhuma senha de demonstração é exibida nesta tela."}
                  </p>
                </div>
              )}
              {demoMode ? (
                <button type="button" onClick={disableDemo} className="mt-2 text-[8.5px] font-bold text-[var(--coral)]">
                  Ocultar contas de demonstração
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(DEMO_MODE_KEY);
                    } catch {
                      // ignora
                    }
                    setDemoMode(true);
                    setShowDemo(false);
                    toast.push("Demonstração reativada. As credenciais continuam as que você definiu.", "success");
                  }}
                  className="mt-2 text-[8.5px] font-bold text-[var(--muted)]"
                >
                  Reativar contas de demonstração
                </button>
              )}
            </div> : null}
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-[8.5px] text-[var(--faint)]">Ninho · finanças na palma da mão</span>
            <span className="flex items-center gap-1 text-[8.5px] text-[var(--faint)]"><ShieldCheck size={10} /> dados locais</span>
          </div>
        </main>
      </div>

      <Modal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title={newRecoveryCode ? "Guarde seu novo código" : "Recuperar minha senha"}
        subtitle={newRecoveryCode ? "Ele será exigido caso você esqueça a senha novamente." : "Use o código de recuperação que você guardou no cadastro."}
        icon={<KeyRound size={17} />}
        size="sm"
        footer={
          newRecoveryCode ? (
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newRecoveryCode);
                  toast.push("Código copiado. Guarde em local seguro.");
                } catch {
                  toast.push("Não foi possível copiar. Anote o código.", "warning");
                }
              }}
            >
              <Copy size={14} /> Copiar código
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setRecoveryOpen(false)}>Cancelar</Button>
              <Button onClick={submitRecovery} disabled={recoveryBusy}>
                {recoveryBusy ? "Salvando..." : "Redefinir senha"}
              </Button>
            </>
          )
        }
      >
        {newRecoveryCode ? (
          <div className="space-y-3">
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--accent)", background: "var(--success-soft)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Novo código de recuperação</p>
              <p className="num mt-2 text-[20px] font-semibold tracking-[0.08em] text-[var(--text)]">{newRecoveryCode}</p>
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">
                Este código aparece uma única vez. Anote ou copie antes de fechar.
              </p>
            </div>
            <p className="flex items-start gap-2 text-[9px] leading-relaxed text-[var(--faint)]">
              <ShieldCheck size={11} className="mt-0.5 shrink-0" />
              Quem tiver este código pode redefinir sua senha. Não compartilhe. Se perder o código, o administrador do Ninho ainda pode redefinir o acesso.
            </p>
          </div>
        ) : (
          <form onSubmit={submitRecovery} className="space-y-3">
            <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
              Digite seu e-mail, o código de recuperação e a nova senha. O código é de uso único e será substituído após a redefinição.
            </p>
            <Field label="E-mail do login">
              <Input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" />
            </Field>
            <Field label="Código de recuperação" hint="Formato XXXX-XXXX-XXXX-XXXX, entregue no cadastro.">
              <Input
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="font-mono tracking-[0.08em]"
                autoComplete="one-time-code"
              />
            </Field>
            <Field label="Nova senha">
              <Input type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
            </Field>
            <Field label="Confirmar nova senha">
              <Input type="password" value={recoveryConfirm} onChange={(event) => setRecoveryConfirm(event.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
            </Field>
            {recoveryError ? (
              <p className="rounded-xl border px-3 py-2 text-[9.5px] leading-relaxed" style={{ borderColor: "rgba(255,128,140,.3)", background: "var(--coral-soft)", color: "var(--danger)" }}>
                {recoveryError}
              </p>
            ) : null}
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-bold text-[var(--text)]">Não tem o código?</p>
              <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
                O administrador do Ninho pode redefinir sua senha pelo painel de perfis. Ele nunca vê sua senha e você deverá trocá-la no primeiro acesso.
                Suporte: <strong className="text-[var(--text-soft)]">{SUPPORT_EMAIL}</strong>
              </p>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!signupRecoveryCode}
        onClose={() => {
          if (!signupRecoveryAck) {
            toast.push("Confirme que guardou o código antes de continuar.", "warning");
            return;
          }
          setSignupRecoveryCode(null);
          setMode("login");
          setEmail(cleanEmailForSignup);
          setPassword("");
          toast.push("Conta criada. Entre com a senha que você acabou de definir.", "success");
        }}
        title="Seu código de recuperação"
        subtitle="Ele é a sua chave se esquecer a senha. Aparece só uma vez."
        icon={<ShieldCheck size={17} />}
        size="sm"
        footer={
          <Button
            onClick={() => {
              setSignupRecoveryCode(null);
              setMode("login");
              setEmail(cleanEmailForSignup);
              setPassword("");
              toast.push("Conta criada. Entre com a senha que você definiu.", "success");
            }}
            disabled={!signupRecoveryAck}
          >
            <Check size={14} /> Continuar para o Ninho
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--accent)", background: "var(--success-soft)" }}>
            <p className="num text-[21px] font-semibold tracking-[0.08em] text-[var(--text)]">{signupRecoveryCode}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">
              Anote ou copie. Este código não será exibido novamente.
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              if (!signupRecoveryCode) return;
              try {
                await navigator.clipboard.writeText(signupRecoveryCode);
                toast.push("Código copiado.");
              } catch {
                toast.push("Não foi possível copiar. Anote manualmente.", "warning");
              }
            }}
          >
            <Copy size={14} /> Copiar código
          </Button>
          <button
            type="button"
            onClick={() => setSignupRecoveryAck((current) => !current)}
            className="flex w-full items-start gap-2 rounded-xl border p-3 text-left"
            style={{ borderColor: signupRecoveryAck ? "var(--accent)" : "var(--border)", background: signupRecoveryAck ? "var(--success-soft)" : "var(--surface-2)" }}
          >
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
              style={{
                borderColor: signupRecoveryAck ? "var(--accent)" : "var(--border-strong)",
                background: signupRecoveryAck ? "var(--accent)" : "transparent",
                color: "var(--accent-ink)",
              }}
            >
              {signupRecoveryAck ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            <span className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              Guardei o código em local seguro e entendo que ele permite redefinir minha senha.
            </span>
          </button>
          <p className="flex items-start gap-2 text-[9px] leading-relaxed text-[var(--faint)]">
            <ShieldCheck size={11} className="mt-0.5 shrink-0" />
            Também é possível gerar um novo código em Ajustes → Conta e segurança a qualquer momento.
          </p>
        </div>
      </Modal>

    </div>
  );
}
