import React from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Info,
  LockKeyhole,
  Moon,
  Palette,
  RotateCcw,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserRound,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import type { Page } from "../components/Layout";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  SectionHeader,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { useStore, assertValidBackup } from "../state/store";
import { useTheme } from "../state/theme";
import type { AppData } from "../state/types";
import { formatBRL } from "../lib/money";
import { formatDate } from "../lib/date";
import { readFileAsText, csvToTransactions, downloadText, transactionsToCSV } from "../lib/backup";
import { MODULE_CATALOG, PLANS, accessLabel, useAuth } from "../state/auth";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export default function Settings({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { data, dispatch } = useStore();
  const { theme, setTheme } = useTheme();
  const {
    account, household: authHousehold, db, pendingInvites, isAdmin, hasAccess,
    updateOwnProfile, changePassword, inviteMember, removeMember, renameHousehold, signOut,
    getRecoveryCode, regenerateRecoveryCode, canUseModule,
  } = useAuth();
  const toast = useToast();
  const [name, setName] = React.useState(data.profile.name);
  const [email, setEmail] = React.useState(data.profile.email);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [pendingReplace, setPendingReplace] = React.useState<{ backup: AppData; fileName: string } | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = React.useState(false);
  const [installPrompt, setInstallPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = React.useState(isStandaloneMode);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [houseName, setHouseName] = React.useState(authHousehold?.name ?? "");
  const [houseNameBusy, setHouseNameBusy] = React.useState(false);
  const [inviteBusy, setInviteBusy] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [nextPassword, setNextPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryBusy, setRecoveryBusy] = React.useState(false);
  const [recoveryCode, setRecoveryCode] = React.useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = React.useState(false);
  const jsonMergeRef = React.useRef<HTMLInputElement>(null);
  const jsonReplaceRef = React.useRef<HTMLInputElement>(null);
  const csvRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setName(account?.name ?? data.profile.name);
    setEmail(account?.email ?? data.profile.email);
  }, [account?.name, account?.email, data.profile.name, data.profile.email]);

  React.useEffect(() => {
    setHouseName(authHousehold?.name ?? "");
  }, [authHousehold?.name]);

  const houseMembers = (authHousehold?.memberIds ?? [])
    .map((memberId) => db.accounts.find((item) => item.id === memberId))
    .filter(Boolean);
  const isOwner = authHousehold?.ownerId === account?.id;
  const ownerAccount = db.accounts.find((item) => item.id === authHousehold?.ownerId);
  const currentPlan = PLANS[ownerAccount?.planId ?? "monthly_solo"];
  const canInvite = Boolean(ownerAccount?.compAccess) || currentPlan.shared;

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteBusy(true);
    const result = inviteMember(inviteEmail);
    setInviteBusy(false);
    toast.push(result.message ?? (result.ok ? "Convite registrado. A pessoa já pode entrar ou criar a conta com este e-mail." : "Falha ao convidar."), result.ok ? "success" : "warning");
    if (result.ok) setInviteEmail("");
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      toast.push("A confirmação da nova senha não confere.", "warning");
      return;
    }
    setPasswordBusy(true);
    const result = await changePassword(currentPassword, nextPassword);
    setPasswordBusy(false);
    toast.push(result.message ?? (result.ok ? "Senha atualizada com sucesso." : "Não foi possível alterar."), result.ok ? "success" : "error");
    if (result.ok) {
      setPasswordOpen(false);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    }
  }

  React.useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.push("Informe seu nome.", "warning");
      return;
    }
    const result = updateOwnProfile({ name: name.trim(), email: email.trim() });
    toast.push(result.message ?? (result.ok ? "Perfil atualizado no seu login." : "Não foi possível salvar."), result.ok ? "success" : "error");
  }

  function exportBackup() {
    downloadText(
      `ninho-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json"
    );
    toast.push("Backup completo exportado.");
  }

  function exportCsv() {
    downloadText(
      `ninho-lancamentos-${new Date().toISOString().slice(0, 10)}.csv`,
      transactionsToCSV(data.transactions),
      "text/csv"
    );
    toast.push("Lançamentos exportados em CSV.");
  }

  async function handleJsonFile(file: File, mode: "merge" | "replace") {
    try {
      const raw = await readFileAsText(file);
      const parsed = JSON.parse(raw) as unknown;
      assertValidBackup(parsed);
      if (mode === "merge") {
        dispatch({ type: "IMPORT_MERGE_KEEP_EXISTING", backup: parsed });
        toast.push("Backup mesclado com seus dados atuais.");
      } else {
        setPendingReplace({ backup: parsed, fileName: file.name });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível importar o arquivo.";
      toast.push(message, "error");
    }
  }

  async function handleCsvFile(file: File) {
    try {
      const raw = await readFileAsText(file);
      const imported = csvToTransactions(raw);
      if (!imported.length) {
        toast.push("Nenhum lançamento válido encontrado no CSV.", "warning");
        return;
      }
      const existing = new Set(data.transactions.map((transaction) => transaction.id));
      const additions = imported.filter((transaction) => !existing.has(transaction.id));
      additions.forEach((transaction) => dispatch({ type: "ADD_TX", tx: transaction }));
      toast.push(`${additions.length} lançamento${additions.length === 1 ? "" : "s"} importado${additions.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível importar o CSV.";
      toast.push(message, "error");
    }
  }

  async function installApp() {
    if (standalone) {
      toast.push("O Ninho já está instalado neste dispositivo.", "info");
      return;
    }
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.push("Instalação iniciada. Até já!");
      } else {
        toast.push("Você pode instalar depois em Ajustes.", "info");
      }
      setInstallPrompt(null);
    } catch {
      setInstallHelpOpen(true);
    }
  }

  const updatedAt = new Date(data.updatedAtISO);
  const storageSizeKb = (JSON.stringify(data).length / 1024).toFixed(1);
  const totalCardOutstanding = data.cardPurchases.reduce((total, purchase) => total + purchase.amountCents, 0);

  return (
    <div className="page-enter">
      <div>
        <p className="overline">Seu app, do seu jeito</p>
        <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
          Ajustes<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
          Preferências, dados e uma cópia segura sempre por perto.
        </p>
      </div>

      <section className="panel mt-5 overflow-hidden">
        <div aria-hidden className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, var(--accent), rgba(125,211,252,.6), transparent)" }} />
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3 lg:w-[300px]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--success-soft)", color: "var(--accent)" }}>
              <Users size={18} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[14px] font-semibold text-[var(--text)]">{authHousehold?.name ?? "Meu Ninho"}</p>
                <Badge tone={currentPlan.shared ? "accent" : "neutral"}>{currentPlan.shared ? "compartilhado" : "individual"}</Badge>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
                {canInvite
                  ? "Convides por e-mail. A pessoa cria o próprio login e passa a ver e editar os mesmos dados da casa."
                  : "Seu plano é individual. Para convidar alguém, ative um plano compartilhado."}
              </p>
              <p className="mt-1 text-[9px] text-[var(--faint)]">
                {houseMembers.length} de {currentPlan.seats} login{currentPlan.seats === 1 ? "" : "s"} · {accessLabel(ownerAccount ?? null)}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="space-y-1.5">
              {houseMembers.map((member) => member ? (
                <div key={member.id} className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <Avatar name={member.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-bold text-[var(--text)]">
                      {member.name} {member.id === authHousehold?.ownerId ? <span className="text-[8px] font-semibold text-[var(--accent)]">· titular</span> : null}
                    </p>
                    <p className="truncate text-[8.5px] text-[var(--muted)]">{member.email}</p>
                  </div>
                  {member.compAccess ? <Badge tone="accent">grátis</Badge> : null}
                  {isOwner && member.id !== authHousehold?.ownerId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const result = removeMember(member.id);
                        toast.push(result.ok ? "Pessoa removida do Ninho. Ela mantém um espaço próprio." : result.message ?? "Falha", result.ok ? "success" : "error");
                      }}
                      aria-label={`Remover ${member.name}`}
                      className="rounded-md p-1.5 text-[var(--faint)] transition hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              ) : null)}
              {pendingInvites.map((invite) => (
                <div key={invite.email} className="flex items-center gap-2 rounded-xl border border-dashed p-2" style={{ borderColor: "var(--border-strong)" }}>
                  <Mail size={14} className="shrink-0 text-[var(--amber)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-[var(--text)]">{invite.email}</p>
                    <p className="text-[8px] text-[var(--faint)]">convite pendente · criado em {formatDate(invite.createdAtISO.slice(0, 10))}</p>
                  </div>
                  <Badge tone="amber">aguardando</Badge>
                </div>
              ))}
            </div>

            {isOwner ? (
              canInvite ? (
                <form onSubmit={sendInvite} className="mt-2 flex gap-1.5">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="email da pessoa"
                    aria-label="E-mail para convidar"
                    className="!min-h-[34px]"
                  />
                  <Button size="sm" type="submit" disabled={inviteBusy || !inviteEmail.trim()}>
                    <UserPlus size={12} /> Convidar
                  </Button>
                </form>
              ) : (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => onNavigate("billing")}>
                  <Wallet size={12} /> Ver planos compartilhados
                </Button>
              )
            ) : (
              <p className="mt-2 text-[8.5px] text-[var(--faint)]">Só o titular pode convidar ou remover pessoas.</p>
            )}
            {isOwner ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setHouseNameBusy(true);
                  const result = renameHousehold(houseName);
                  setHouseNameBusy(false);
                  toast.push(
                    result.ok ? "Nome do Ninho atualizado." : result.message ?? "Não foi possível salvar.",
                    result.ok ? "success" : "error"
                  );
                }}
                className="mt-2 flex gap-1.5"
              >
                <Input
                  value={houseName}
                  onChange={(event) => setHouseName(event.target.value)}
                  placeholder="Nome do Ninho"
                  aria-label="Nome do Ninho"
                  maxLength={40}
                  className="!min-h-[34px]"
                />
                <Button size="sm" type="submit" variant="secondary" disabled={houseNameBusy || !houseName.trim()}>
                  Salvar nome
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-[8.5px] text-[var(--faint)]">O nome do Ninho é definido pelo titular.</p>
            )}
            <div className="mt-2 flex items-start gap-1.5 text-[8.5px] leading-relaxed text-[var(--faint)]">
              <ShieldCheck size={10} className="mt-0.5 shrink-0" />
              Cada pessoa entra com o próprio e-mail e senha. Tudo o que for editado fica salvo no Ninho e aparece para os demais logins da casa.
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-4 sm:p-5">
          <SectionHeader title="Seu perfil" description="Nome e e-mail do seu login." action={<UserRound size={15} className="text-[var(--muted)]" />} />
          <form onSubmit={saveProfile}>
            <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <Avatar name={name || data.profile.name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[13px] font-semibold text-[var(--text)]">{name || "Seu nome"}</p>
                <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{email || "Sem e-mail cadastrado"}</p>
              </div>
              <Badge tone="accent" dot>{account?.role === "admin" ? "admin" : "conta"}</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" />
              </Field>
              <Field label="E-mail do login">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" type="submit">Salvar perfil</Button>
            </div>
          </form>
        </section>

        <section className="panel p-4 sm:p-5">
          <SectionHeader title="Aparência" description="Escolha o conforto visual." action={<Palette size={15} className="text-[var(--muted)]" />} />
          <div className="grid grid-cols-2 gap-2.5">
            <ThemeOption
              label="Escuro"
              description="Padrão Ninho"
              active={theme === "dark"}
              icon={<Moon size={14} />}
              preview="dark"
              onClick={() => setTheme("dark")}
            />
            <ThemeOption
              label="Claro"
              description="Para o dia"
              active={theme === "light"}
              icon={<Sun size={14} />}
              preview="light"
              onClick={() => setTheme("light")}
            />
          </div>

          <button
            type="button"
            onClick={installApp}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[var(--border-strong)]"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--accent)" }}>
              {standalone ? <Check size={16} /> : <Smartphone size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold text-[var(--text)]">
                {standalone ? "Aplicativo instalado" : "Instalar no celular"}
              </span>
              <span className="mt-0.5 block text-[9.5px] text-[var(--muted)]">
                {standalone ? "Experiência em tela cheia ativa" : "Acesso rápido e funcionamento offline"}
              </span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-[var(--faint)]" />
          </button>
        </section>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <KeyRound size={14} className="text-[var(--accent)]" />
          <p className="text-[11.5px] font-bold text-[var(--text)]">Conta e segurança</p>
          <Badge tone="accent" className="ml-auto">{accessLabel(account ?? null)}</Badge>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">Login</p>
            <p className="mt-1 truncate text-[11px] font-bold text-[var(--text)]">{account?.name}</p>
            <p className="truncate text-[9.5px] text-[var(--muted)]">{account?.email}</p>
            <p className="mt-1.5 text-[8.5px] text-[var(--faint)]">Senha protegida com PBKDF2 · nunca armazenada em texto puro</p>
            {account?.mustChangePassword ? (
              <p className="mt-1.5 rounded-lg border px-2 py-1 text-[8.5px] font-semibold" style={{ borderColor: "rgba(255,128,140,.3)", background: "var(--coral-soft)", color: "var(--danger)" }}>
                Sua senha foi definida pelo administrador. Troque agora para proteger sua conta.
              </p>
            ) : null}
            <p className="mt-1.5 text-[8.5px] text-[var(--muted)]">
              Código de recuperação: {account?.recoveryGeneratedAtISO ? `gerado em ${formatDate(account.recoveryGeneratedAtISO.slice(0, 10))}` : "ainda não gerado"}
            </p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">Assinatura</p>
            <p className="mt-1 text-[11px] font-bold text-[var(--text)]">{PLANS[account?.planId ?? "monthly_solo"].label}</p>
            <p className="text-[9.5px] text-[var(--muted)]">
              {account?.subscriptionStatus === "trial" ? "Período de teste" : account?.subscriptionStatus === "active" ? "Ativa" : account?.subscriptionStatus === "canceled" ? "Cancelada" : "Sem acesso"}
              {account?.compAccess ? " · cortesia" : ""}
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => onNavigate("billing")}><Wallet size={11} /> Meu plano</Button>
              {isAdmin ? <Button size="sm" variant="ghost" onClick={() => onNavigate("admin")}><Users size={11} /> Admin</Button> : null}
            </div>
          </div>
          <div className="rounded-xl border p-3 sm:col-span-2" style={{ borderColor: canUseModule("sales") ? "var(--accent)" : "var(--border)", background: canUseModule("sales") ? "var(--success-soft)" : "var(--surface-2)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">Módulos liberados</p>
                <p className="mt-1 text-[11px] font-bold text-[var(--text)]">{MODULE_CATALOG.sales.label}</p>
                <p className="text-[9px] text-[var(--muted)]">
                  {canUseModule("sales") ? "Liberado pelo administrador para este Ninho." : "Bloqueado. Solicite liberação ao administrador."}
                </p>
              </div>
              <Badge tone={canUseModule("sales") ? "accent" : "neutral"} dot>{canUseModule("sales") ? "ativo" : "bloqueado"}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <Button size="sm" variant="secondary" onClick={() => setPasswordOpen(true)}><KeyRound size={12} /> Alterar senha</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRecoveryCode(null);
              setRecoveryCopied(false);
              setRecoveryOpen(true);
            }}
          >
            <ShieldCheck size={12} /> Código de recuperação
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut size={12} /> Sair da conta</Button>
          <span className="ml-auto max-w-[320px] text-right text-[8.5px] leading-snug text-[var(--faint)]">
            Sessão assinada por aba · tentativas limitadas · troca de senha revoga outras sessões
          </span>
        </div>
      </section>

      <Modal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title="Código de recuperação"
        subtitle="A chave para redefinir a senha caso você esqueça."
        icon={<ShieldCheck size={17} />}
        size="sm"
        footer={
          recoveryCode ? (
            <>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(recoveryCode);
                    setRecoveryCopied(true);
                    toast.push("Código copiado. Guarde em local seguro.");
                  } catch {
                    toast.push("Não foi possível copiar. Anote manualmente.", "warning");
                  }
                }}
              >
                <Copy size={14} /> {recoveryCopied ? "Copiado" : "Copiar"}
              </Button>
              <Button onClick={() => setRecoveryOpen(false)}><Check size={14} /> Já guardei</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setRecoveryOpen(false)}>Fechar</Button>
              <Button
                onClick={async () => {
                  setRecoveryBusy(true);
                  const result = await regenerateRecoveryCode();
                  setRecoveryBusy(false);
                  if (result.ok && result.code) {
                    setRecoveryCode(result.code);
                    toast.push("Novo código gerado. Ele invalida o anterior.");
                  } else {
                    toast.push(result.message ?? "Não foi possível gerar.", "error");
                  }
                }}
                disabled={recoveryBusy}
              >
                {recoveryBusy ? "Gerando..." : "Gerar novo código"}
              </Button>
            </>
          )
        }
      >
        {recoveryCode ? (
          <div className="space-y-3">
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--accent)", background: "var(--success-soft)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Novo código de recuperação</p>
              <p className="num mt-2 text-[20px] font-semibold tracking-[0.08em] text-[var(--text)]">{recoveryCode}</p>
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">Aparece uma única vez. Anote ou copie antes de fechar.</p>
            </div>
            <p className="flex items-start gap-2 text-[9px] leading-relaxed text-[var(--faint)]">
              <ShieldCheck size={11} className="mt-0.5 shrink-0" />
              O código anterior deixa de funcionar. Quem tiver este código pode redefinir a sua senha.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Como funciona</p>
              <ul className="mt-1.5 space-y-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                <li>• No cadastro você recebe um código de recuperação e deve guardá-lo.</li>
                <li>• Se esquecer a senha, use “Esqueci minha senha” e informe o código.</li>
                <li>• O código é de uso único: ao redefinir, um novo é exibido.</li>
                <li>• O administrador também pode redefinir, sem nunca ver sua senha.</li>
              </ul>
            </div>
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              Por segurança, o código original não pode ser consultado novamente. Você pode gerar um novo agora; isso invalida o anterior.
            </p>
            <button
              type="button"
              onClick={async () => {
                const result = await getRecoveryCode();
                toast.push(result.message ?? "Consulte as instruções.", "info");
              }}
              className="text-[9px] font-bold text-[var(--accent)]"
            >
              Por que não consigo ver meu código antigo?
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Alterar senha"
        subtitle="Sua senha protege o acesso aos dados deste Ninho."
        icon={<KeyRound size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button onClick={submitPassword} disabled={passwordBusy || !currentPassword || nextPassword.length < 8}>
              {passwordBusy ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitPassword} className="space-y-3">
          <Field label="Senha atual"><Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres."><Input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirmar nova senha"><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></Field>
        </form>
      </Modal>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title="Dados e backup"
            description={hasAccess ? "Leve uma cópia ou guarde para restaurar depois." : "Somente leitura: ative um plano para importar ou restaurar."}
            action={<Database size={15} className="text-[var(--muted)]" />}
          />
          <div className="space-y-2">
            <ActionRow
              icon={<FileJson size={16} />}
              title="Backup completo em JSON"
              description="Lançamentos, orçamento, crédito e perfil."
              action={<Button size="sm" variant="secondary" onClick={exportBackup}><Download size={12} /> Exportar</Button>}
            />
            <ActionRow
              icon={<FileSpreadsheet size={16} />}
              title="Lançamentos em CSV"
              description="Compatível com planilhas e outros apps."
              action={<Button size="sm" variant="secondary" onClick={exportCsv}><Download size={12} /> Exportar</Button>}
            />
            <ActionRow
              icon={<CreditCard size={16} />}
              title="Configurações do crédito"
              description="Fechamento, vencimento, limite e taxas."
              action={<Button size="sm" variant="ghost" onClick={() => onNavigate("card")}>Abrir <ArrowUpRight size={12} /></Button>}
            />
          </div>
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
                <HardDrive size={12} /> Dados neste dispositivo
              </span>
              <span className="num text-[10px] font-semibold text-[var(--text-soft)]">{storageSizeKb} KB</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <p className="num text-[13px] font-semibold text-[var(--text)]">{data.transactions.length}</p>
                <p className="text-[8.5px] text-[var(--faint)]">lançamentos</p>
              </div>
              <div>
                <p className="num text-[13px] font-semibold text-[var(--text)]">{data.cardPurchases.length}</p>
                <p className="text-[8.5px] text-[var(--faint)]">compras no crédito</p>
              </div>
              <div>
                <p className="num text-[13px] font-semibold text-[var(--text)]">{formatBRL(totalCardOutstanding)}</p>
                <p className="text-[8.5px] text-[var(--faint)]">em compras</p>
              </div>
            </div>
            <p className="mt-2 text-[8.5px] text-[var(--faint)]">
              Última gravação: {formatDate(updatedAt.toISOString().slice(0, 10))} às{" "}
              {updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title="Importar dados"
            description="Restaure um backup ou traga lançamentos."
            action={<Upload size={15} className="text-[var(--muted)]" />}
          />
          <input
            ref={jsonMergeRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await handleJsonFile(file, "merge");
              event.target.value = "";
            }}
          />
          <input
            ref={jsonReplaceRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await handleJsonFile(file, "replace");
              event.target.value = "";
            }}
          />
          <input
            ref={csvRef}
            type="file"
            accept="text/csv,.csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await handleCsvFile(file);
              event.target.value = "";
            }}
          />
          <div className="space-y-2">
            <ActionRow
              icon={<FileJson size={16} />}
              title="Mesclar backup JSON"
              description="Adiciona apenas registros que ainda não existem."
              action={<Button size="sm" variant="secondary" disabled={!hasAccess} onClick={() => jsonMergeRef.current?.click()}><Upload size={12} /> Escolher</Button>}
            />
            <ActionRow
              icon={<RotateCcw size={16} />}
              title="Substituir tudo por um backup"
              description="Seus dados atuais serão trocados. Pede confirmação."
              action={<Button size="sm" variant="danger" disabled={!hasAccess} onClick={() => jsonReplaceRef.current?.click()}><Upload size={12} /> Escolher</Button>}
            />
            <ActionRow
              icon={<FileSpreadsheet size={16} />}
              title="Importar lançamentos CSV"
              description="Ignora IDs já existentes e mantém o restante."
              action={<Button size="sm" variant="secondary" disabled={!hasAccess} onClick={() => csvRef.current?.click()}><Upload size={12} /> Escolher</Button>}
            />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              O arquivo é processado apenas neste navegador. Nada é enviado para servidores.
            </p>
          </div>
        </section>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <WifiOff size={14} className="text-[var(--accent)]" />
          <p className="text-[11.5px] font-bold text-[var(--text)]">Funciona sem internet</p>
          <Badge tone="accent" className="ml-auto">PWA</Badge>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-3">
          <Feature icon={<LockKeyhole size={15} />} title="Privado" description="Seus dados ficam no LocalStorage deste dispositivo, sem conta e sem nuvem." />
          <Feature icon={<WifiOff size={15} />} title="Offline" description="Depois de aberto uma vez, o app carrega mesmo sem conexão." />
          <Feature icon={<Smartphone size={15} />} title="Na tela inicial" description="Instale como aplicativo e acesse com um toque, em tela cheia." />
        </div>
      </section>

      <section className="panel mt-4 overflow-hidden" style={{ borderColor: "rgba(255,128,140,.2)" }}>
        <div className="flex items-center gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <RotateCcw size={14} style={{ color: "var(--coral)" }} />
          <p className="text-[11.5px] font-bold text-[var(--text)]">Zona de manutenção</p>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[11.5px] font-bold text-[var(--text)]">Restaurar dados de exemplo</p>
            <p className="mt-1 max-w-[540px] text-[10px] leading-relaxed text-[var(--muted)]">
              Apaga o que está salvo e recarrega o conteúdo demonstrativo. Exporte um backup antes de continuar.
            </p>
          </div>
          <Button variant="danger" size="sm" disabled={!hasAccess} onClick={() => setResetOpen(true)}>
            <RotateCcw size={12} /> Restaurar exemplo
          </Button>
        </div>
        <div className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[8.5px] text-[var(--faint)]">
            <span className="flex items-center gap-1"><Info size={10} /> Ninho v1.2</span>
            <span>Esquema 1</span>
            <span>Banco local: contas + dados por login</span>
            <span className="ml-auto flex items-center gap-1"><ShieldCheck size={10} /> Sem rastreamento</span>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={resetOpen}
        title="Restaurar dados de exemplo?"
        message="Todos os lançamentos, compras e planejamentos salvos neste dispositivo serão substituídos pelo conteúdo inicial. Esta ação não pode ser desfeita."
        confirmText="Restaurar exemplo"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          dispatch({ type: "RESET_SEED" });
          setResetOpen(false);
          toast.push("Dados de exemplo restaurados.");
        }}
      />

      <ConfirmDialog
        open={!!pendingReplace}
        title="Substituir todos os dados?"
        message={`O arquivo “${pendingReplace?.fileName ?? ""}” vai substituir todo o conteúdo atual. Exporte um backup antes se quiser guardar uma cópia.`}
        confirmText="Substituir tudo"
        onCancel={() => setPendingReplace(null)}
        onConfirm={() => {
          if (!pendingReplace) return;
          dispatch({ type: "IMPORT_REPLACE", backup: pendingReplace.backup });
          setPendingReplace(null);
          toast.push("Backup restaurado com sucesso.");
        }}
      />

      <Modal
        open={installHelpOpen}
        onClose={() => setInstallHelpOpen(false)}
        title="Instalar o Ninho"
        subtitle="Leve suas finanças para a tela inicial."
        icon={<Smartphone size={17} />}
        size="sm"
        footer={<Button onClick={() => setInstallHelpOpen(false)}>Entendi</Button>}
      >
        <div className="space-y-3">
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
            A instalação depende do navegador. No computador, procure o ícone de instalar na barra de endereço.
          </p>
          <Instruction number="1" title="No iPhone (Safari)" text="Toque em Compartilhar e escolha “Adicionar à Tela de Início”." />
          <Instruction number="2" title="No Android (Chrome)" text="Abra o menu de três pontos e toque em “Instalar app” ou “Adicionar à tela inicial”." />
          <Instruction number="3" title="No computador" text="Use o ícone de instalação na barra do navegador, ao lado do endereço." />
        </div>
      </Modal>
    </div>
  );
}

function ThemeOption({
  label,
  description,
  active,
  icon,
  preview,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  icon: React.ReactNode;
  preview: "dark" | "light";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-2 text-left transition hover:border-[var(--border-strong)]"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--success-soft)" : "var(--surface-2)",
      }}
    >
      <div
        className="relative h-[54px] overflow-hidden rounded-lg border p-2"
        style={{
          borderColor: preview === "dark" ? "rgba(255,255,255,.08)" : "rgba(20,30,18,.08)",
          background: preview === "dark" ? "#101612" : "#fafbf6",
        }}
      >
        <div className="flex gap-1">
          <span className="h-1.5 w-8 rounded-full" style={{ background: preview === "dark" ? "#2a372d" : "#dce1d3" }} />
          <span className="ml-auto h-2 w-5 rounded-sm" style={{ background: "#ccf56e" }} />
        </div>
        <div className="mt-2 h-3 w-16 rounded-sm" style={{ background: preview === "dark" ? "#ccf56e" : "#b6e65c" }} />
        <div className="mt-1.5 flex gap-1">
          <span className="h-3.5 w-1/2 rounded-sm" style={{ background: preview === "dark" ? "#1b251e" : "#e8ecdf" }} />
          <span className="h-3.5 w-1/2 rounded-sm" style={{ background: preview === "dark" ? "#1b251e" : "#e8ecdf" }} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <span style={{ color: active ? "var(--success)" : "var(--muted)" }}>{icon}</span>
        <span className="flex-1 text-[10.5px] font-extrabold text-[var(--text)]">{label}</span>
        {active ? <Check size={12} style={{ color: "var(--success)" }} /> : null}
      </div>
      <p className="mt-0.5 px-0.5 text-[8.5px] text-[var(--faint)]">{description}</p>
    </button>
  );
}

function ActionRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border p-2.5 transition hover:border-[var(--border-strong)]"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold leading-tight text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-[8.5px] leading-snug text-[var(--muted)]">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
        {icon}
      </span>
      <div>
        <p className="text-[10.5px] font-bold text-[var(--text)]">{title}</p>
        <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

function Instruction({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
        {number}
      </span>
      <div>
        <p className="text-[10.5px] font-bold text-[var(--text)]">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">{text}</p>
      </div>
    </div>
  );
}
