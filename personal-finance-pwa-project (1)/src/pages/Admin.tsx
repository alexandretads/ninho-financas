import React from "react";
import {
  BadgeCheck,
  Ban,
  Check,
  Copy,
  Crown,
  Gift,
  LockKeyhole,
  TrendingUp,
  KeyRound,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionHeader,
  Select,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { MODULE_CATALOG, PLANS, PLAN_ORDER, accountHasAccess, accessLabel, hashPassword, moduleOwnerFor, modulesForAccount, useAuth, type NinhoAccount, type PlanId } from "../state/auth";
import { formatBRL } from "../lib/money";
import { formatDate } from "../lib/date";

export default function Admin() {
  const {
    db, account, isAdmin, adminGrantFree, adminSetPlan, adminBlock, adminSetModule,
    adminResetPassword, adminDeleteAccount, refreshDB,
  } = useAuth();
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "free" | "active" | "blocked">("all");
  const [selected, setSelected] = React.useState<NinhoAccount | null>(null);
  const [grantTarget, setGrantTarget] = React.useState<NinhoAccount | null>(null);
  const [grantNote, setGrantNote] = React.useState("Cortesia do administrador");
  const [resetTarget, setResetTarget] = React.useState<NinhoAccount | null>(null);
  const [tempPassword, setTempPassword] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<NinhoAccount | null>(null);
  const [stillDefaultPassword, setStillDefaultPassword] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!account) return;
    hashPassword("Ninho@2026", account.passwordSalt)
      .then((hash) => {
        if (active) setStillDefaultPassword(hash === account.passwordHash);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account]);

  if (!isAdmin || !account) {
    return (
      <div className="page-enter panel p-6 text-center">
        <ShieldCheck size={26} className="mx-auto text-[var(--muted)]" />
        <p className="font-display mt-2 text-[16px] font-semibold text-[var(--text)]">Área restrita</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">Somente administradores podem abrir esta área.</p>
      </div>
    );
  }

  const accounts = db.accounts;
  const households = db.households;
  const activePaying = accounts.filter(
    (item) => item.role !== "admin" && !item.compAccess && accountHasAccess(item) && item.subscriptionStatus === "active"
  );
  const mrrCents = activePaying.reduce((total, item) => {
    const plan = PLANS[item.planId];
    return total + (plan.period === "year" ? Math.round(plan.priceCents / 12) : plan.priceCents);
  }, 0);
  const freeCount = accounts.filter((item) => item.compAccess).length;

  const filtered = accounts
    .filter((item) => {
      if (filter === "free") return item.compAccess;
      if (filter === "blocked") return item.blocked;
      if (filter === "active") return accountHasAccess(item) && item.role !== "admin";
      return true;
    })
    .filter((item) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      const household = households.find((home) => home.id === item.householdId);
      return `${item.name} ${item.email} ${household?.name ?? ""}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => (a.role === b.role ? b.createdAtISO.localeCompare(a.createdAtISO) : a.role === "admin" ? -1 : 1));

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Administração</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Pessoas & acessos<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Libere o Ninho de graça, ajuste planos e cuide das contas.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { refreshDB(); toast.push("Lista atualizada."); }}>
          Atualizar lista
        </Button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: stillDefaultPassword ? "rgba(255,144,121,.35)" : "var(--border)", background: stillDefaultPassword ? "var(--coral-soft)" : "var(--surface-2)" }}>
        <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: stillDefaultPassword ? "var(--coral)" : "var(--success)" }} />
        <p className="text-[9px] leading-relaxed text-[var(--muted)]">
          {stillDefaultPassword ? (
            <>
              <strong className="text-[var(--coral)]">Sua senha do administrador ainda é a de demonstração.</strong> Troque agora em{" "}
              <strong className="text-[var(--text-soft)]">Ajustes → Alterar senha</strong>. Enquanto isso, qualquer pessoa que conheça a senha padrão acessa o painel.
            </>
          ) : (
            "Senha do administrador personalizada. Sessões são assinadas, tentativas são limitadas e a troca de senha revoga acessos antigos."
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminKpi label="Pessoas" value={`${accounts.length}`} hint={`${households.length} casas`} icon={<Users size={14} />} />
        <AdminKpi label="Assinantes ativos" value={`${activePaying.length}`} hint={`${accounts.filter((item) => item.subscriptionStatus === "trial").length} em teste`} icon={<BadgeCheck size={14} />} />
        <AdminKpi label="Receita simulada" value={formatBRL(mrrCents)} hint="MRR equivalente" icon={<Wallet size={14} />} />
        <AdminKpi label="Acessos grátis" value={`${freeCount}`} hint="liberados por você" icon={<Gift size={14} />} />
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, e-mail ou Ninho..." className="!pl-9 !min-h-[38px]" aria-label="Buscar pessoas" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[280px]">
          <Select
            ariaLabel="Filtrar acessos"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "free", label: "Grátis" },
              { value: "blocked", label: "Bloqueados" },
            ]}
            className="!min-h-[38px]"
          />
          <div className="input flex items-center !min-h-[38px] text-[10px] text-[var(--muted)]">
            <ShieldCheck size={12} className="mr-1.5" /> admin master
          </div>
        </div>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <SectionHeader
            title="Perfis cadastrados"
            description={`${filtered.length} de ${accounts.length} contas · dados salvos por login`}
            className="!mb-0"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<UserRound size={20} />} title="Nenhuma conta encontrada" description="Ajuste a busca ou o filtro." />
        ) : (
          <div>
            {filtered.map((item, index) => {
              const home = households.find((entry) => entry.id === item.householdId);
              const plan = PLANS[item.planId];
              const isSelf = item.id === account.id;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-2.5 px-4 py-3 transition hover:bg-[var(--surface-2)] sm:px-5"
                  style={index < filtered.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-display text-[10px] font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: item.role === "admin" ? "var(--amber)" : "var(--accent)" }}>
                    {item.role === "admin" ? <Crown size={14} /> : item.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                  </span>
                  <button type="button" onClick={() => setSelected(item)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[11.5px] font-bold text-[var(--text)]">{item.name}</p>
                      {isSelf ? <span className="chip !py-0.5 !text-[8px]">você</span> : null}
                      {item.compAccess ? <Badge tone="accent" dot>grátis</Badge> : null}
                      {item.blocked ? <Badge tone="coral" dot>bloqueado</Badge> : null}
                      {item.role !== "admin" ? (
                        <span className="chip !py-0.5 !text-[7.5px]" style={{ color: modulesForAccount(db, item).includes("sales") ? "var(--accent)" : "var(--muted)" }}>
                          {modulesForAccount(db, item).includes("sales") ? <TrendingUp size={8} /> : <LockKeyhole size={8} />}
                          vendas {modulesForAccount(db, item).includes("sales") ? "on" : "off"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{item.email} · {home?.name ?? "sem Ninho"}</p>
                    <p className="mt-0.5 text-[8.5px] text-[var(--faint)]">{item.role === "admin" ? "Administrador" : plan.shortLabel} · {accessLabel(item)}</p>
                  </button>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title={modulesForAccount(db, item).includes("sales") ? "Revogar módulo de vendas" : "Liberar módulo de vendas"}
                      aria-label={modulesForAccount(db, item).includes("sales") ? "Revogar módulo de vendas" : "Liberar módulo de vendas"}
                      disabled={item.role === "admin"}
                      onClick={() => {
                        const ownerTarget = moduleOwnerFor(db, item);
                        if (!ownerTarget) return;
                        const result = adminSetModule(ownerTarget.id, "sales", !modulesForAccount(db, item).includes("sales"));
                        toast.push(result.message ?? (result.ok ? "Módulo atualizado." : "Falha"), result.ok ? "success" : "error");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--accent)] disabled:opacity-30"
                      style={{
                        borderColor: "var(--border)",
                        background: modulesForAccount(db, item).includes("sales") ? "var(--success-soft)" : "var(--surface-2)",
                        color: modulesForAccount(db, item).includes("sales") ? "var(--success)" : "var(--muted)",
                      }}
                    >
                      <TrendingUp size={13} />
                    </button>
                    <button
                      type="button"
                      title={item.compAccess ? "Remover acesso grátis" : "Liberar sistema grátis"}
                      aria-label={item.compAccess ? "Remover acesso grátis" : "Liberar sistema grátis"}
                      onClick={() => {
                        if (item.compAccess) {
                          const result = adminGrantFree(item.id, false);
                          toast.push(result.ok ? "Acesso grátis removido." : result.message ?? "Falha", result.ok ? "success" : "error");
                        } else {
                          setGrantTarget(item);
                          setGrantNote("Cortesia do administrador");
                        }
                      }}
                      disabled={item.role === "admin"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--accent)] disabled:opacity-30"
                      style={{ borderColor: "var(--border)", background: item.compAccess ? "var(--success-soft)" : "var(--surface-2)", color: item.compAccess ? "var(--success)" : "var(--muted)" }}
                    >
                      <Gift size={13} />
                    </button>
                    <button
                      type="button"
                      title={item.blocked ? "Desbloquear" : "Bloquear acesso"}
                      aria-label={item.blocked ? "Desbloquear" : "Bloquear"}
                      onClick={() => {
                        const result = adminBlock(item.id, !item.blocked);
                        toast.push(result.ok ? (item.blocked ? "Conta desbloqueada." : "Conta bloqueada.") : result.message ?? "Falha", result.ok ? "success" : "error");
                      }}
                      disabled={isSelf || item.role === "admin"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--coral)] disabled:opacity-30"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: item.blocked ? "var(--coral)" : "var(--muted)" }}
                    >
                      <Ban size={13} />
                    </button>
                    <button
                      type="button"
                      title="Detalhes"
                      aria-label="Detalhes da conta"
                      onClick={() => setSelected(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--border-strong)]"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}
                    >
                      <KeyRound size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Conta"}
        subtitle={selected?.email}
        icon={<UserRound size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
            {selected && selected.role !== "admin" ? (
              <Button onClick={() => { setGrantTarget(selected); setSelected(null); }}>
                <Gift size={13} /> Liberar grátis
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selected.compAccess ? "accent" : "sky"}>{selected.compAccess ? "Acesso gratuito" : accessLabel(selected)}</Badge>
              <Badge>{selected.role === "admin" ? "Administrador" : "Pessoa"}</Badge>
              <Badge>{PLANS[selected.planId].label}</Badge>
              <Badge tone={modulesForAccount(db, selected).includes("sales") ? "accent" : "neutral"} dot>
                {modulesForAccount(db, selected).includes("sales") ? "Vendas liberadas" : "Vendas bloqueadas"}
              </Badge>
            </div>
            {selected.role !== "admin" ? (
              <div className="rounded-xl border p-3" style={{ borderColor: modulesForAccount(db, selected).includes("sales") ? "var(--accent)" : "var(--border)", background: modulesForAccount(db, selected).includes("sales") ? "var(--success-soft)" : "var(--surface-2)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--text)]">Módulo {MODULE_CATALOG.sales.label}</p>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted)]">{MODULE_CATALOG.sales.description}</p>
                    <p className="mt-1 text-[8.5px] text-[var(--faint)]">
                      {moduleOwnerFor(db, selected)?.id === selected.id
                        ? "Liberação do titular deste Ninho."
                        : `Herdado do titular (${moduleOwnerFor(db, selected)?.name ?? "—"}).`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={modulesForAccount(db, selected).includes("sales") ? "secondary" : "primary"}
                    onClick={() => {
                      const ownerTarget = moduleOwnerFor(db, selected);
                      if (!ownerTarget) return;
                      const result = adminSetModule(ownerTarget.id, "sales", !modulesForAccount(db, selected).includes("sales"));
                      toast.push(result.message ?? (result.ok ? "Módulo atualizado." : "Falha"), result.ok ? "success" : "error");
                    }}
                  >
                    {modulesForAccount(db, selected).includes("sales") ? <><LockKeyhole size={12} /> Bloquear</> : <><TrendingUp size={12} /> Liberar</>}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Info label="Criada em" value={formatDate(selected.createdAtISO.slice(0, 10), "long")} />
              <Info label="Último login" value={selected.lastLoginISO ? formatDate(selected.lastLoginISO.slice(0, 10), "long") : "Nunca"} />
              <Info label="Teste até" value={formatDate(selected.trialEndsAtISO.slice(0, 10))} />
              <Info label="Fim do período" value={selected.currentPeriodEndISO ? formatDate(selected.currentPeriodEndISO.slice(0, 10)) : "—"} />
            </div>

            <Field label="Plano do Ninho (titular)" hint="Define os recursos e o limite de pessoas da casa deste perfil.">
              <Select
                value={(households.find((home) => home.id === selected.householdId)?.ownerId
                  ? accounts.find((item) => item.id === households.find((home) => home.id === selected.householdId)?.ownerId)?.planId
                  : selected.planId) ?? selected.planId}
                onChange={(planId) => {
                  const home = households.find((item) => item.id === selected.householdId);
                  const targetId = home?.ownerId ?? selected.id;
                  const result = adminSetPlan(targetId, planId as PlanId);
                  toast.push(result.ok ? "Plano do Ninho atualizado." : result.message ?? "Falha", result.ok ? "success" : "error");
                  setSelected({ ...selected, planId: planId as PlanId });
                }}
                options={PLAN_ORDER.map((planId) => ({ value: planId, label: `${PLANS[planId].label} · ${formatBRL(PLANS[planId].priceCents)}` }))}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setResetTarget(selected); setTempPassword(""); }}>
                <KeyRound size={12} /> Redefinir senha
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteTarget(selected)} disabled={selected.id === account.id}>
                <Trash2 size={12} /> Excluir conta
              </Button>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[var(--text)]">Pagamentos</p>
              {selected.payments.length === 0 ? (
                <p className="mt-1 text-[9.5px] text-[var(--muted)]">Nenhum pagamento simulado registrado.</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {selected.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-2 text-[9.5px]">
                      <span className="text-[var(--muted)]">{formatDate(payment.atISO.slice(0, 10))} · {PLANS[payment.planId].label}</span>
                      <span className="num font-semibold text-[var(--text)]">{formatBRL(payment.amountCents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[8.5px] leading-relaxed text-[var(--faint)]">
              Alterações administrativas refletem imediatamente no login da pessoa. O histórico financeiro dela não é apagado ao trocar de plano.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!grantTarget}
        onClose={() => setGrantTarget(null)}
        title="Liberar o Ninho de graça"
        subtitle={grantTarget?.email}
        icon={<Gift size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrantTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!grantTarget) return;
                const result = adminGrantFree(grantTarget.id, true, grantNote.trim() || "Cortesia do administrador");
                toast.push(result.ok ? "Sistema liberado gratuitamente." : result.message ?? "Falha", result.ok ? "success" : "error");
                setGrantTarget(null);
              }}
            >
              <Check size={14} /> Liberar acesso
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            A pessoa terá acesso completo, sem cobrança, inclusive aos recursos compartilhados enquanto a liberação estiver ativa.
          </p>
          <Field label="Motivo / observação" hint="Aparece no painel da pessoa como cortesia.">
            <Input value={grantNote} onChange={(event) => setGrantNote(event.target.value)} placeholder="Ex.: cortesia de lançamento" />
          </Field>
          <div className="flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
            <p className="text-[9px] leading-relaxed text-[var(--muted)]">Você pode revogar a qualquer momento na lista de perfis.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Redefinir senha"
        subtitle={resetTarget?.email}
        icon={<KeyRound size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!resetTarget) return;
                const result = await adminResetPassword(resetTarget.id, tempPassword);
                toast.push(result.ok ? "Senha redefinida. Envie a senha temporária à pessoa." : result.message ?? "Falha", result.ok ? "success" : "error");
                if (result.ok) setResetTarget(null);
              }}
              disabled={tempPassword.length < 8}
            >
              <Check size={14} /> Redefinir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Senha temporária" hint="Mínimo de 8 caracteres. Oriente a pessoa a trocar no primeiro acesso.">
            <Input value={tempPassword} onChange={(event) => setTempPassword(event.target.value)} placeholder="Ex.: Ninho@2026" autoFocus />
          </Field>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setTempPassword(`Ninho@${Math.floor(1000 + Math.random() * 9000)}`)}>
              Gerar senha forte
            </Button>
            {tempPassword ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(tempPassword); toast.push("Senha copiada."); }
                  catch { toast.push("Não foi possível copiar.", "warning"); }
                }}
              >
                <Copy size={12} /> Copiar
              </Button>
            ) : null}
          </div>
          <p className="flex items-start gap-2 text-[9px] leading-relaxed text-[var(--faint)]">
            <ShieldCheck size={11} className="mt-0.5 shrink-0" /> A senha antiga deixa de funcionar imediatamente. Nenhuma senha é armazenada em texto puro.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir esta conta?"
        message={`A conta de ${deleteTarget?.name ?? ""} e o acesso dela serão removidos. Esta ação é permanente.`}
        confirmText="Excluir conta"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const result = adminDeleteAccount(deleteTarget.id);
          toast.push(result.ok ? "Conta excluída." : result.message ?? "Falha", result.ok ? "success" : "error");
          setDeleteTarget(null);
          setSelected(null);
        }}
      />

      <div className="mt-4 flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <XCircle size={13} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <p className="text-[9px] leading-relaxed text-[var(--muted)]">
          Administração local de demonstração. Em produção, operações sensíveis devem exigir autenticação de dois fatores, trilha de auditoria e confirmação por e-mail.
        </p>
      </div>
    </div>
  );
}

function AdminKpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "var(--success-soft)", color: "var(--accent)" }}>{icon}</span>
      </div>
      <p className="num mt-2 text-[17px] font-semibold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1 text-[8.5px] text-[var(--faint)]">{hint}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.06em] text-[var(--faint)]">{label}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
