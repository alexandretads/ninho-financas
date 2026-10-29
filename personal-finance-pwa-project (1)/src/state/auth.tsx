import React from "react";
import type { AppData } from "./types";
import { createEmptyData, createSeedData } from "./seed";

/* -------------------------------------------------------------------------- */
/* Planos comerciais                                                           */
/* -------------------------------------------------------------------------- */

export type PlanId = "monthly_solo" | "monthly_shared" | "annual_solo" | "annual_shared";

export type Plan = {
  id: PlanId;
  label: string;
  shortLabel: string;
  priceCents: number;
  period: "month" | "year";
  seats: number;
  shared: boolean;
  description: string;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  monthly_solo: {
    id: "monthly_solo",
    label: "Mensal individual",
    shortLabel: "Mensal · 1 pessoa",
    priceCents: 3490,
    period: "month",
    seats: 1,
    shared: false,
    description: "Para organizar a vida financeira sozinho.",
    features: ["Todos os módulos", "Metas com sugestões", "1 pessoa", "Cancele quando quiser"],
  },
  monthly_shared: {
    id: "monthly_shared",
    label: "Mensal compartilhado",
    shortLabel: "Mensal · 2 pessoas",
    priceCents: 4990,
    period: "month",
    seats: 2,
    shared: true,
    description: "O mesmo Ninho para o casal, cada um com seu login.",
    features: ["Todos os módulos", "2 logins vinculados", "Dados da casa compartilhados", "Metas em conjunto"],
  },
  annual_solo: {
    id: "annual_solo",
    label: "Anual individual",
    shortLabel: "Anual · 1 pessoa",
    priceCents: 30000,
    period: "year",
    seats: 1,
    shared: false,
    description: "Doze meses de Ninho com desconto.",
    features: ["Tudo do mensal", "1 pessoa", "Pagamento único anual", "Economia de 3,4 mensalidades"],
  },
  annual_shared: {
    id: "annual_shared",
    label: "Anual compartilhado",
    shortLabel: "Anual · 2 pessoas",
    priceCents: 50000,
    period: "year",
    seats: 2,
    shared: true,
    description: "O ano inteiro do casal com o melhor preço.",
    features: ["Tudo do compartilhado", "2 logins", "Pagamento único anual", "Economia de 2 mensalidades"],
  },
};

export const PLAN_ORDER: PlanId[] = ["monthly_solo", "monthly_shared", "annual_solo", "annual_shared"];

export type ModuleId = "sales";

export const MODULE_CATALOG: Record<ModuleId, { label: string; short: string; description: string }> = {
  sales: {
    label: "Vendas & Comissões",
    short: "Vendas",
    description: "Funil de cotas, comissões em 13x, fechamento de ciclo e conciliação de renda.",
  },
};

export const ALL_MODULES: ModuleId[] = ["sales"];

export function monthlyEquivalentCents(planId: PlanId) {
  const plan = PLANS[planId];
  return plan.period === "year" ? Math.round(plan.priceCents / 12) : plan.priceCents;
}

export function annualSavings(planId: PlanId) {
  const plan = PLANS[planId];
  if (plan.period !== "year") return null;
  const monthlyId: PlanId = plan.shared ? "monthly_shared" : "monthly_solo";
  const fullYear = PLANS[monthlyId].priceCents * 12;
  const savingsCents = fullYear - plan.priceCents;
  const percent = fullYear > 0 ? (savingsCents / fullYear) * 100 : 0;
  return { fullYearCents: fullYear, savingsCents, percent, monthsFree: savingsCents / PLANS[monthlyId].priceCents };
}

/* -------------------------------------------------------------------------- */
/* Tipos do banco                                                             */
/* -------------------------------------------------------------------------- */

export type PaymentMethodType = "card" | "pix";
export type SubscriptionStatus = "trial" | "active" | "canceled" | "past_due" | "blocked";

export type NinhoPayment = {
  id: string;
  atISO: string;
  amountCents: number;
  planId: PlanId;
  method: PaymentMethodType;
  reference: string;
  status: "paid" | "refunded";
  note?: string;
};

export type NinhoAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: "admin" | "user";
  householdId: string;
  createdAtISO: string;
  lastLoginISO?: string;
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAtISO: string;
  currentPeriodEndISO?: string;
  compAccess: boolean;
  compNote?: string;
  blocked: boolean;
  payments: NinhoPayment[];
  /** Incrementado ao trocar a senha: revoga sessões antigas. */
  sessionEpoch?: number;
  /** Código de recuperação de uso único (armazenado com hash). */
  recoveryCodeHash?: string;
  recoveryCodeSalt?: string;
  recoveryGeneratedAtISO?: string;
  /** Indica que a senha foi definida pelo administrador e deve ser trocada. */
  mustChangePassword?: boolean;
  /** Módulos liberados pelo administrador para o titular deste Ninho. */
  enabledModules?: ModuleId[];
  /** Vínculo com o Stripe para gerenciamento real da assinatura. */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export type HouseholdInvite = {
  email: string;
  invitedByAccountId: string;
  createdAtISO: string;
  acceptedAtISO?: string;
};

export type NinhoHousehold = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  invites: HouseholdInvite[];
  data: AppData;
  createdAtISO: string;
};

export type PromotionAudience = "all" | "paying" | "trial" | "expired";

export type Promotion = {
  id: string;
  createdAtISO: string;
  createdByAccountId: string;
  title: string;
  message: string;
  discountPercent: number;
  planIds: PlanId[];
  code: string;
  expiresAtISO: string;
  audience: PromotionAudience | "individual";
  recipientCount: number;
};

export type PromotionDelivery = {
  id: string;
  promotionId: string;
  accountId: string;
  sentAtISO: string;
  readAtISO?: string;
  redeemedAtISO?: string;
};

export type PromotionInput = {
  title: string;
  message: string;
  discountPercent: number;
  planIds: PlanId[];
  expiresInDays: number;
  code?: string;
  audience: PromotionAudience | "individual";
  accountId?: string;
};

export type LoginAttempt = { email: string; count: number; firstAtISO: string; lockedUntilISO?: string };

export type NinhoDB = {
  version: 1;
  accounts: NinhoAccount[];
  households: NinhoHousehold[];
  promotions: Promotion[];
  deliveries: PromotionDelivery[];
  /** Identificador da conta da sessão. */
  sessionUserId: string | null;
  /** Assinatura da sessão: impede trocar sessionUserId no DevTools. */
  sessionSignature: string | null;
  attempts: LoginAttempt[];
  updatedAtISO: string;
};

export type ClientPromotion = {
  delivery: PromotionDelivery;
  promotion: Promotion;
  expired: boolean;
  redeemed: boolean;
};

function normalizeDB(db: NinhoDB): NinhoDB {
  return {
    ...db,
    accounts: db.accounts.map((account) => ({
      ...account,
      // Contas antigas mantêm o módulo para não perder histórico; novas
      // contas começam sem Vendas até o administrador liberar.
      enabledModules: Array.isArray(account.enabledModules)
        ? account.enabledModules.filter((id): id is ModuleId => ALL_MODULES.includes(id as ModuleId))
        : account.role === "admin"
          ? [...ALL_MODULES]
          : ["sales"],
    })),
    promotions: Array.isArray(db.promotions) ? db.promotions : [],
    deliveries: Array.isArray(db.deliveries) ? db.deliveries : [],
    attempts: Array.isArray(db.attempts) ? db.attempts : [],
    sessionSignature:
      typeof db.sessionSignature === "string" ? db.sessionSignature : null,
  };
}

const SESSION_SECRET_KEY = "ninho:session-secret:v1";

function sessionSecret() {
  try {
    let secret = localStorage.getItem(SESSION_SECRET_KEY);
    if (!secret) {
      secret = randomHex(32);
      localStorage.setItem(SESSION_SECRET_KEY, secret);
    }
    return secret;
  } catch {
    return "ninho-local-demo-secret";
  }
}

function signSession(accountId: string, epoch = 0) {
  const source = `${accountId}:${epoch}:${sessionSecret()}:${navigator.userAgent}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `s_${(hash >>> 0).toString(16)}_${accountId.slice(-6)}`;
}



const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

const TAB_SESSION_KEY = "ninho:session:v1";

type TabSession = { accountId: string; epoch: number; signature: string };

function readTabSession(): TabSession | null {
  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TabSession;
    if (!parsed?.accountId || !parsed?.signature) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTabSession(session: TabSession | null) {
  try {
    if (session) sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(TAB_SESSION_KEY);
  } catch {
    // sessão apenas em memória
  }
}

/** Módulos efetivos: admin tem todos; convidados herdam do titular da casa. */
export function modulesForAccount(db: NinhoDB, account: NinhoAccount | null): ModuleId[] {
  if (!account) return [];
  if (account.role === "admin") return [...ALL_MODULES];
  const home = db.households.find((item) => item.id === account.householdId);
  const owner = home ? db.accounts.find((item) => item.id === home.ownerId) : null;
  const source = owner ?? account;
  return (source.enabledModules ?? []).filter((id): id is ModuleId => ALL_MODULES.includes(id));
}

export function canUseModule(db: NinhoDB, account: NinhoAccount | null, moduleId: ModuleId) {
  return modulesForAccount(db, account).includes(moduleId);
}

/** Quem recebe a liberação é o titular do Ninho (o cliente), não o convidado. */
export function moduleOwnerFor(db: NinhoDB, account: NinhoAccount): NinhoAccount | null {
  const home = db.households.find((item) => item.id === account.householdId);
  return home ? db.accounts.find((item) => item.id === home.ownerId) ?? null : account;
}

export function planForAccount(db: NinhoDB, account: NinhoAccount): Plan {
  const home = db.households.find((item) => item.id === account.householdId);
  const owner = home ? db.accounts.find((item) => item.id === home.ownerId) : null;
  return PLANS[owner?.planId ?? account.planId];
}

export function ownerPlanId(db: NinhoDB, account: NinhoAccount): PlanId {
  const home = db.households.find((item) => item.id === account.householdId);
  const owner = home ? db.accounts.find((item) => item.id === home.ownerId) : null;
  return owner?.planId ?? account.planId;
}

export function promotionPrice(priceCents: number, discountPercent: number) {
  const discount = Math.max(0, Math.min(100, discountPercent));
  return Math.max(0, Math.round(priceCents * (1 - discount / 100)));
}

export const DB_KEY = "ninho:db:v1";
/**
 * Credenciais de demonstração.
 * São geradas no primeiro acesso e só existem enquanto o ambiente de
 * demonstração estiver ativo (sem `ninho:demo-hidden`). Para produção,
 * remova o bootstrap e crie o administrador no servidor.
 */
export const DEMO_MODE_KEY = "ninho:demo-mode";
export const DEMO_BUILD = import.meta.env.VITE_DEMO_MODE === "true";
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "suporte@ninho.app";
export const ADMIN_EMAIL = "admin@ninho.app";
export const DEMO_EMAIL = "marina@ninho.app";

function demoAccessEnabled() {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) !== "off";
  } catch {
    return false;
  }
}

function demoPassword(fallback: string) {
  if (!demoAccessEnabled()) return "";
  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Utilitários                                                                */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function randomHex(size = 16) {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => (bytes[index] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function id(prefix: string) {
  return `${prefix}_${randomHex(8)}`;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  try {
    if (crypto?.subtle) {
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: encoder.encode(salt), iterations: 120_000, hash: "SHA-256" },
        keyMaterial,
        256
      );
      return bytesToBase64(new Uint8Array(bits));
    }
  } catch {
    // contexto sem WebCrypto: usa fallback determinístico de demonstração
  }
  const data = encoder.encode(`${salt}:${password}:${salt}`);
  let hash = 2166136261;
  data.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  });
  return `fallback_${(hash >>> 0).toString(16)}`;
}

export async function hashRecoveryCode(code: string, salt: string) {
  return hashPassword(`recover:${code.trim().toUpperCase()}`, salt);
}

export function generateRecoveryCode() {
  // 4 blocos de 4 caracteres, excluindo letras ambíguas.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const blocks: string[] = [];
  for (let block = 0; block < 4; block += 1) {
    let part = "";
    for (let index = 0; index < 4; index += 1) {
      const bytes = new Uint8Array(1);
      crypto.getRandomValues(bytes);
      part += alphabet[bytes[0] % alphabet.length];
    }
    blocks.push(part);
  }
  return blocks.join("-");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, Math.floor(score * 0.7));
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function readDB(): NinhoDB | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NinhoDB;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts)) return null;
    return normalizeDB(parsed);
  } catch {
    return null;
  }
}

function writeDB(db: NinhoDB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify({ ...db, updatedAtISO: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

async function makeAccount(args: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  householdId: string;
  planId: PlanId;
  trialDays?: number;
  compAccess?: boolean;
  enabledModules?: ModuleId[];
}): Promise<NinhoAccount> {
  const salt = randomHex(16);
  const recoverySalt = randomHex(16);
  const recoveryCode = generateRecoveryCode();
  return {
    id: id("acc"),
    recoveryCodeSalt: recoverySalt,
    recoveryCodeHash: await hashRecoveryCode(recoveryCode, recoverySalt),
    recoveryGeneratedAtISO: new Date().toISOString(),
    name: args.name.trim(),
    email: normalizeEmail(args.email),
    passwordHash: await hashPassword(args.password, salt),
    passwordSalt: salt,
    role: args.role,
    householdId: args.householdId,
    createdAtISO: new Date().toISOString(),
    planId: args.planId,
    subscriptionStatus: "trial",
    trialEndsAtISO: daysFromNow(args.trialDays ?? 14),
    compAccess: args.compAccess ?? false,
    blocked: false,
    payments: [],
    enabledModules: args.enabledModules ?? [],
  };
}

function emptyDB(): NinhoDB {
  return {
    version: 1,
    accounts: [],
    households: [],
    promotions: [],
    deliveries: [],
    sessionUserId: null,
    sessionSignature: null,
    attempts: [],
    updatedAtISO: new Date().toISOString(),
  };
}

async function bootstrapDB(): Promise<NinhoDB> {
  // Em produção o banco nasce vazio: o primeiro acesso cria o administrador.
  if (!DEMO_BUILD) {
    const db = emptyDB();
    writeDB(db);
    return db;
  }
  const now = new Date().toISOString();
  const adminHouseholdId = id("hh");
  const demoHouseholdId = id("hh");
  const admin = await makeAccount({
    name: "Administrador Ninho",
    email: ADMIN_EMAIL,
    password: demoPassword("Ninho@2026"),
    role: "admin",
    householdId: adminHouseholdId,
    planId: "annual_shared",
    compAccess: true,
    enabledModules: [...ALL_MODULES],
  });
  const demo = await makeAccount({
    name: "Marina Alves",
    email: DEMO_EMAIL,
    password: demoPassword("Ninho@2026"),
    role: "user",
    householdId: demoHouseholdId,
    planId: "monthly_shared",
    trialDays: 30,
    enabledModules: [...ALL_MODULES],
  });

  let demoData: AppData;
  try {
    const legacy =
      localStorage.getItem("prumo:financas:v1") ?? localStorage.getItem("norte:financas:v1");
    demoData = legacy ? (JSON.parse(legacy) as AppData) : createSeedData();
    demoData.profile = { name: demo.name, email: demo.email };
    if (!Array.isArray(demoData.goals)) demoData.goals = [];
  } catch {
    demoData = createSeedData();
  }

  const db: NinhoDB = {
    version: 1,
    accounts: [admin, demo],
    households: [
      {
        id: adminHouseholdId,
        name: "Ninho administrador",
        ownerId: admin.id,
        memberIds: [admin.id],
        invites: [],
        data: { ...createEmptyData(admin.name, admin.email), profile: { name: admin.name, email: admin.email } },
        createdAtISO: now,
      },
      {
        id: demoHouseholdId,
        name: "Ninho de Marina",
        ownerId: demo.id,
        memberIds: [demo.id],
        invites: [],
        data: demoData,
        createdAtISO: now,
      },
    ],
    promotions: [],
    deliveries: [],
    sessionUserId: null,
    sessionSignature: null,
    attempts: [],
    updatedAtISO: now,
  };
  writeDB(db);
  return db;
}

export function ownerOf(db: NinhoDB, account: NinhoAccount | null) {
  if (!account) return null;
  const household = db.households.find((item) => item.id === account.householdId);
  if (!household) return null;
  return db.accounts.find((item) => item.id === household.ownerId) ?? null;
}

export function accountHasAccess(account: NinhoAccount | null, now = new Date()) {
  if (!account) return false;
  if (account.blocked) return false;
  if (account.role === "admin" || account.compAccess) return true;
  if (account.subscriptionStatus === "trial") return new Date(account.trialEndsAtISO) > now;
  if (account.subscriptionStatus === "active" || account.subscriptionStatus === "canceled") {
    return !account.currentPeriodEndISO || new Date(account.currentPeriodEndISO) > now;
  }
  return false;
}

export function accessLabel(account: NinhoAccount | null) {
  if (!account) return "Sem sessão";
  if (account.role === "admin") return "Administrador";
  if (account.compAccess) return "Acesso liberado";
  if (account.blocked) return "Bloqueado";
  if (account.subscriptionStatus === "trial") {
    const days = Math.max(0, Math.ceil((new Date(account.trialEndsAtISO).getTime() - Date.now()) / 86_400_000));
    return `Teste · ${days} dia${days === 1 ? "" : "s"}`;
  }
  if (account.subscriptionStatus === "active") return PLANS[account.planId].label;
  if (account.subscriptionStatus === "canceled") return "Cancelado (acesso até o fim do período)";
  return "Sem acesso";
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

type AuthResult = { ok: boolean; message?: string; recoveryCode?: string; recipients?: number };

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  seedDemo?: boolean;
  /** Somente o primeiro cadastro de um banco vazio pode virar administrador. */
  firstAdmin?: boolean;
};

type AuthContextValue = {
  ready: boolean;
  db: NinhoDB;
  account: NinhoAccount | null;
  household: NinhoHousehold | null;
  workspace: AppData | null;
  isAdmin: boolean;
  hasAccess: boolean;
  enabledModules: ModuleId[];
  canUseModule: (moduleId: ModuleId) => boolean;
  adminSetModule: (accountId: string, moduleId: ModuleId, enabled: boolean) => AuthResult;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => void;
  saveWorkspace: (data: AppData) => boolean;
  updateOwnProfile: (args: { name: string; email: string }) => AuthResult;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string; devCode?: string }>;
  resetPasswordWithCode: (email: string, code: string, nextPassword: string) => Promise<AuthResult>;
  getRecoveryCode: () => Promise<{ ok: boolean; message?: string; code?: string }>;
  regenerateRecoveryCode: () => Promise<{ ok: boolean; message?: string; code?: string }>;
  inviteMember: (email: string) => AuthResult;
  removeMember: (accountId: string) => AuthResult;
  renameHousehold: (name: string) => AuthResult;
  pendingInvites: HouseholdInvite[];
  incomingInvites: Array<{ household: NinhoHousehold; invite: HouseholdInvite }>;
  acceptInvite: (householdId: string) => AuthResult;
  declineInvite: (householdId: string) => AuthResult;
  subscribe: (planId: PlanId, method: PaymentMethodType, promotionCode?: string) => AuthResult;
  activateExternalSubscription: (args: {
    planId: PlanId;
    amountCents: number;
    reference: string;
    paidAtISO?: string;
    provider?: string;
    customerId?: string | null;
    subscriptionId?: string | null;
  }) => AuthResult;
  myPromotions: ClientPromotion[];
  markPromotionRead: (deliveryId: string) => void;
  sendPromotion: (input: PromotionInput) => { ok: boolean; message?: string; recipients?: number };
  promotions: Promotion[];
  deliveries: PromotionDelivery[];
  cancelSubscription: () => void;
  adminGrantFree: (accountId: string, grant: boolean, note?: string) => AuthResult;
  adminSetPlan: (accountId: string, planId: PlanId) => AuthResult;
  adminBlock: (accountId: string, blocked: boolean) => AuthResult;
  adminResetPassword: (accountId: string, temporaryPassword: string) => Promise<AuthResult>;
  adminDeleteAccount: (accountId: string) => AuthResult;
  refreshDB: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [db, setDBState] = React.useState<NinhoDB | null>(null);
  const dbRef = React.useRef<NinhoDB | null>(null);
  const [tabSession, setTabSession] = React.useState<TabSession | null>(() => readTabSession());
  const [ready, setReady] = React.useState(false);

  const setDB = React.useCallback((next: NinhoDB | null) => {
    dbRef.current = next;
    setDBState(next);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let stored = readDB();
      if (!stored) stored = await bootstrapDB();
      if (!mounted) return;
      setDB(stored);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [setDB]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== DB_KEY || !event.newValue) return;
      const incoming = readDB();
      if (incoming) {
        dbRef.current = incoming;
        setDBState(incoming);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  /**
   * Aplica a mutação de forma síncrona sobre a referência atual, grava e só
   * então atualiza o React. Evita perda de alterações por estado defasado.
   */
  const applySession = React.useCallback((accountId: string, epoch: number) => {
    const next = { accountId, epoch, signature: signSession(accountId, epoch) };
    writeTabSession(next);
    setTabSession(next);
  }, []);

  const clearSession = React.useCallback(() => {
    writeTabSession(null);
    setTabSession(null);
  }, []);

  const commit = React.useCallback((mutator: (current: NinhoDB) => NinhoDB): AuthResult => {
    const current = dbRef.current;
    if (!current) return { ok: false, message: "Banco de dados indisponível." };
    let next: NinhoDB;
    try {
      next = mutator(current);
    } catch {
      return { ok: false, message: "Não foi possível concluir a operação." };
    }
    if (!writeDB(next)) {
      return { ok: false, message: "Não foi possível salvar. O armazenamento do navegador está cheio." };
    }
    setDB(next);
    return { ok: true };
  }, [setDB]);

  const account = React.useMemo(() => {
    if (!db || !tabSession) return null;
    const found = db.accounts.find((item) => item.id === tabSession.accountId) ?? null;
    if (!found || found.blocked) return null;
    const epoch = found.sessionEpoch ?? 0;
    // Época diferente ou assinatura inválida = credencial revogada.
    if (tabSession.epoch !== epoch) return null;
    if (tabSession.signature !== signSession(found.id, epoch)) return null;
    return found;
  }, [db, tabSession]);

  const household = React.useMemo(() => {
    if (!db || !account) return null;
    return db.households.find((item) => item.id === account.householdId) ?? null;
  }, [db, account]);

  const owner = React.useMemo(() => ownerOf(
      db ?? {
        version: 1,
        accounts: [],
        households: [],
        promotions: [],
        deliveries: [],
        sessionUserId: null,
        sessionSignature: null,
        attempts: [],
        updatedAtISO: "",
      },
      account
    ), [db, account]);
  const hasAccess = React.useMemo(
    () => Boolean(account && (account.compAccess || accountHasAccess(account) || (owner && owner.id !== account.id && (owner.compAccess || accountHasAccess(owner))))),
    [account, owner]
  );

  const enabledModules = React.useMemo(
    () => (db ? modulesForAccount(db, account) : []),
    [db, account]
  );
  const canUse = React.useCallback(
    (moduleId: ModuleId) => enabledModules.includes(moduleId),
    [enabledModules]
  );

  const signIn = React.useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      if (!db) return { ok: false, message: "Banco de dados indisponível." };
      const cleanEmail = normalizeEmail(email);
      const attempt = db.attempts.find((item) => item.email === cleanEmail);
      if (attempt?.lockedUntilISO && new Date(attempt.lockedUntilISO) > new Date()) {
        const minutes = Math.ceil((new Date(attempt.lockedUntilISO).getTime() - Date.now()) / 60000);
        return { ok: false, message: `Muitas tentativas. Tente novamente em ${minutes} minuto(s).` };
      }
      const target = db.accounts.find((item) => item.email === cleanEmail);
      if (!target) return { ok: false, message: "E-mail ou senha não conferem." };
      if (target.blocked) return { ok: false, message: "Este acesso foi bloqueado. Fale com o administrador." };
      const hash = await hashPassword(password, target.passwordSalt);
      if (hash !== target.passwordHash) {
        const failures = (attempt?.count ?? 0) + 1;
        const locked = failures >= MAX_ATTEMPTS;
        commit((current) => ({
          ...current,
          attempts: [
            ...current.attempts.filter((item) => item.email !== cleanEmail),
            {
              email: cleanEmail,
              count: failures,
              firstAtISO: attempt?.firstAtISO ?? new Date().toISOString(),
              lockedUntilISO: locked
                ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
                : undefined,
            },
          ],
        }));
        return {
          ok: false,
          message: locked
            ? `Muitas tentativas. Bloqueado por ${LOCK_MINUTES} minutos.`
            : `E-mail ou senha não conferem. ${MAX_ATTEMPTS - failures} tentativa(s) restante(s).`,
        };
      }
      const persisted = commit((current) => ({
        ...current,
        sessionUserId: target.id,
        sessionSignature: signSession(target.id, target.sessionEpoch ?? 0),
        attempts: current.attempts.filter((item) => item.email !== cleanEmail),
        accounts: current.accounts.map((item) =>
          item.id === target.id ? { ...item, lastLoginISO: new Date().toISOString() } : item
        ),
      }));
      if (persisted.ok) applySession(target.id, target.sessionEpoch ?? 0);
      return persisted.ok && target.mustChangePassword
        ? { ...persisted, message: "Sua senha foi definida pelo administrador. Troque em Ajustes → Alterar senha." }
        : persisted;
    },
    [db, commit, applySession]
  );

  const signUp = React.useCallback<AuthContextValue["signUp"]>(
    async ({ name, email, password, seedDemo, firstAdmin }) => {
      if (!db) return { ok: false, message: "Banco de dados indisponível." };
      const cleanName = name.trim();
      const cleanEmail = normalizeEmail(email);
      if (cleanName.length < 2) return { ok: false, message: "Informe seu nome completo." };
      if (!validEmail(cleanEmail)) return { ok: false, message: "Informe um e-mail válido." };
      if (db.accounts.some((item) => item.email === cleanEmail)) {
        return { ok: false, message: "Já existe uma conta com este e-mail. Faça login." };
      }
      if (password.length < 8) return { ok: false, message: "A senha precisa ter pelo menos 8 caracteres." };
      const isFirstAdmin = Boolean(firstAdmin) && db.accounts.length === 0;
      if (firstAdmin && !isFirstAdmin) {
        return { ok: false, message: "Já existe uma conta. Peça acesso ao administrador." };
      }

      // Convite pendente para este e-mail? Entra na casa que convidou.
      const invitationHousehold = db.households.find((item) =>
        item.invites.some((invite) => invite.email === cleanEmail && !invite.acceptedAtISO)
      );
      const householdId = invitationHousehold?.id ?? id("hh");
      const recoveryCode = generateRecoveryCode();
      const recoverySalt = randomHex(16);
      const recoveryHash = await hashRecoveryCode(recoveryCode, recoverySalt);
      const newAccount = await makeAccount({
        name: cleanName,
        email: cleanEmail,
        password,
        role: isFirstAdmin ? "admin" : "user",
        householdId,
        planId: isFirstAdmin
          ? "annual_shared"
          : invitationHousehold
            ? db.accounts.find((item) => item.id === invitationHousehold.ownerId)?.planId ?? "monthly_shared"
            : "monthly_solo",
        trialDays: 14,
        compAccess: isFirstAdmin,
        enabledModules: isFirstAdmin ? [...ALL_MODULES] : [],
      });
      if (!newAccount.email) return { ok: false, message: "Não foi possível criar a conta." };
      newAccount.recoveryCodeHash = recoveryHash;
      newAccount.recoveryCodeSalt = recoverySalt;
      newAccount.recoveryGeneratedAtISO = new Date().toISOString();

      const workspace: AppData = seedDemo ? createSeedData() : createEmptyData(cleanName, cleanEmail);
      workspace.profile = { name: cleanName, email: cleanEmail };

      const created = commit((current) => {
        const targetHousehold = current.households.find((item) => item.id === householdId);
        const households = targetHousehold
          ? current.households.map((item) =>
              item.id === householdId
                ? {
                    ...item,
                    memberIds: [...new Set([...item.memberIds, newAccount.id])],
                    invites: item.invites.map((invite) =>
                      invite.email === cleanEmail && !invite.acceptedAtISO
                        ? { ...invite, acceptedAtISO: new Date().toISOString() }
                        : invite
                    ),
                  }
                : item
            )
          : [
              ...current.households,
              {
                id: householdId,
                name: `Ninho de ${cleanName.split(" ")[0]}`,
                ownerId: newAccount.id,
                memberIds: [newAccount.id],
                invites: [],
                data: workspace,
                createdAtISO: new Date().toISOString(),
              },
            ];
        return {
          ...current,
          accounts: [...current.accounts, newAccount],
          households,
          // A sessão só é aberta após o usuário guardar o código de recuperação.
          sessionUserId: null,
          sessionSignature: null,
        };
      });
      return created.ok ? { ...created, recoveryCode } : created;
    },
    [db, commit, applySession]
  );

  const signOut = React.useCallback(() => {
    clearSession();
    commit((current) => ({ ...current, sessionUserId: null, sessionSignature: null }));
  }, [clearSession, commit]);

  const saveWorkspace = React.useCallback(
    (data: AppData) => {
      if (!account) return false;
      const result = commit((current) => ({
        ...current,
        households: current.households.map((item) =>
          item.id === account.householdId ? { ...item, data } : item
        ),
      }));
      return result.ok;
    },
    [account, commit]
  );

  const replaceAccount = React.useCallback(
    (accountId: string, updater: (item: NinhoAccount) => NinhoAccount) => {
      return commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) => (item.id === accountId ? updater(item) : item)),
      }));
    },
    [commit]
  );

  const updateOwnProfile = React.useCallback<AuthContextValue["updateOwnProfile"]>(
    ({ name, email }) => {
      if (!account) return { ok: false, message: "Sessão expirada." };
      const cleanEmail = normalizeEmail(email);
      const cleanName = name.trim();
      if (cleanName.length < 2) return { ok: false, message: "Informe seu nome." };
      if (!validEmail(cleanEmail)) return { ok: false, message: "E-mail inválido." };
      if (!db) return { ok: false, message: "Banco indisponível." };
      if (db.accounts.some((item) => item.email === cleanEmail && item.id !== account.id)) {
        return { ok: false, message: "Este e-mail já pertence a outra conta." };
      }
      const home = db.households.find((item) => item.id === account.householdId);
      const isOwner = home?.ownerId === account.id;
      const previousFirstName = account.name.trim().split(/\s+/)[0] ?? "";
      const newFirstName = cleanName.split(/\s+/)[0] ?? cleanName;
      // Nome automático "Ninho de X" acompanha o primeiro nome do titular.
      // Um nome personalizado do Ninho nunca é sobrescrito.
      const autoHouseholdName = `Ninho de ${previousFirstName}`;
      const shouldRenameHome = Boolean(
        isOwner && home && (home.name === autoHouseholdName || home.name.trim() === "")
      );
      return commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) =>
          item.id === account.id ? { ...item, name: cleanName, email: cleanEmail } : item
        ),
        households: current.households.map((item) => {
          if (item.id !== account.householdId) return item;
          const nextName = shouldRenameHome ? `Ninho de ${newFirstName}` : item.name;
          // Só o titular atualiza a identidade do workspace. O convidado altera
          // apenas a própria conta, sem renomear o perfil da casa.
          return {
            ...item,
            name: nextName,
            data: isOwner
              ? { ...item.data, profile: { name: cleanName, email: cleanEmail } }
              : item.data,
          };
        }),
      }));
    },
    [account, db, commit]
  );

  const requestPasswordReset = React.useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      if (!db) return { ok: false, message: "Banco de dados indisponível." };
      const cleanEmail = normalizeEmail(email);
      const target = db.accounts.find((item) => item.email === cleanEmail);
      // Não revela se o e-mail existe (proteção contra enumeração).
      if (!target) {
        return { ok: true, message: "Se o e-mail estiver cadastrado, as instruções foram geradas." };
      }
      if (target.blocked) {
        return { ok: true, message: "Se o e-mail estiver cadastrado, as instruções foram geradas." };
      }
      // Sem servidor de e-mail neste ambiente: o código é exibido somente aqui,
      // liberado por um código de recuperação em posse do usuário.
      return { ok: true, message: "Use o código de recuperação que você guardou no cadastro." };
    },
    [db]
  );

  const resetPasswordWithCode = React.useCallback<AuthContextValue["resetPasswordWithCode"]>(
    async (email, code, nextPassword) => {
      if (!db) return { ok: false, message: "Banco de dados indisponível." };
      const cleanEmail = normalizeEmail(email);
      if (!validEmail(cleanEmail)) return { ok: false, message: "Informe um e-mail válido." };
      if (!code.trim()) return { ok: false, message: "Informe o código de recuperação." };
      if (nextPassword.length < 8) return { ok: false, message: "A nova senha precisa ter 8 caracteres ou mais." };
      const target = db.accounts.find((item) => item.email === cleanEmail);
      const generic = "Código de recuperação inválido ou expirado.";
      if (!target) return { ok: false, message: generic };
      if (!target.recoveryCodeHash || !target.recoveryCodeSalt) {
        return {
          ok: false,
          message: "Esta conta ainda não tem código de recuperação. Entre e gere um em Ajustes ou peça ao administrador.",
        };
      }
      if (target.blocked) return { ok: false, message: "Este acesso está bloqueado. Fale com o administrador." };
      const attemptKey = `${cleanEmail}:recovery`;
      const attempt = db.attempts.find((item) => item.email === attemptKey);
      if (attempt?.lockedUntilISO && new Date(attempt.lockedUntilISO) > new Date()) {
        return { ok: false, message: "Muitas tentativas. Tente novamente em alguns minutos." };
      }
      const hash = await hashRecoveryCode(code, target.recoveryCodeSalt);
      if (hash !== target.recoveryCodeHash) {
        const failures = (attempt?.count ?? 0) + 1;
        commit((current) => ({
          ...current,
          attempts: [
            ...current.attempts.filter((item) => item.email !== attemptKey),
            {
              email: attemptKey,
              count: failures,
              firstAtISO: attempt?.firstAtISO ?? new Date().toISOString(),
              lockedUntilISO:
                failures >= MAX_ATTEMPTS
                  ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
                  : undefined,
            },
          ],
        }));
        return { ok: false, message: generic };
      }
      const salt = randomHex(16);
      const passwordHash = await hashPassword(nextPassword, salt);
      const nextEpoch = (target.sessionEpoch ?? 0) + 1;
      // Código de recuperação é de uso único: gera um novo e devolve para guardar.
      const newRecoveryCode = generateRecoveryCode();
      const recoverySalt = randomHex(16);
      const recoveryHash = await hashRecoveryCode(newRecoveryCode, recoverySalt);
      const result = commit((current) => ({
        ...current,
        attempts: current.attempts.filter((item) => item.email !== attemptKey),
        accounts: current.accounts.map((item) =>
          item.id === target.id
            ? {
                ...item,
                passwordSalt: salt,
                passwordHash,
                sessionEpoch: nextEpoch,
                mustChangePassword: false,
                recoveryCodeSalt: recoverySalt,
                recoveryCodeHash: recoveryHash,
                recoveryGeneratedAtISO: new Date().toISOString(),
              }
            : item
        ),
        sessionUserId: null,
        sessionSignature: null,
      }));
      if (result.ok) clearSession();
      return result.ok
        ? { ok: true, message: "Senha redefinida. Guarde o novo código de recuperação.", recoveryCode: newRecoveryCode }
        : result;
    },
    [db, commit, clearSession]
  );

  const getRecoveryCode = React.useCallback(async () => {
    if (!account) return { ok: false, message: "Sessão expirada." };
    // O código original nunca é armazenado em texto puro: só pode ser gerado um novo.
    return { ok: false, message: "Por segurança, o código original não pode ser exibido. Gere um novo." };
  }, [account]);

  const regenerateRecoveryCode = React.useCallback(async () => {
    if (!account) return { ok: false, message: "Sessão expirada." };
    const code = generateRecoveryCode();
    const salt = randomHex(16);
    const hash = await hashRecoveryCode(code, salt);
    const result = replaceAccount(account.id, (item) => ({
      ...item,
      recoveryCodeSalt: salt,
      recoveryCodeHash: hash,
      recoveryGeneratedAtISO: new Date().toISOString(),
    }));
    return result.ok ? { ok: true, code } : result;
  }, [account, replaceAccount]);

  const changePassword = React.useCallback<AuthContextValue["changePassword"]>(
    async (currentPassword, nextPassword) => {
      if (!account) return { ok: false, message: "Sessão expirada." };
      if (nextPassword.length < 8) return { ok: false, message: "A nova senha precisa ter 8 caracteres ou mais." };
      const currentHash = await hashPassword(currentPassword, account.passwordSalt);
      if (currentHash !== account.passwordHash) return { ok: false, message: "Senha atual incorreta." };
      const salt = randomHex(16);
      const passwordHash = await hashPassword(nextPassword, salt);
      const nextEpoch = (account.sessionEpoch ?? 0) + 1;
      const result = commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) =>
          item.id === account.id
            ? {
                ...item,
                passwordSalt: salt,
                passwordHash,
                sessionEpoch: nextEpoch,
                mustChangePassword: false,
              }
            : item
        ),
        // Mantém apenas a sessão atual válida após a troca.
        sessionUserId: account.id,
        sessionSignature: signSession(account.id, nextEpoch),
      }));
      if (result.ok) applySession(account.id, nextEpoch);
      return result;
    },
    [account, commit, applySession]
  );

  const inviteMember = React.useCallback<AuthContextValue["inviteMember"]>(
    (email) => {
      if (!db || !account || !household) return { ok: false, message: "Sessão expirada." };
      const cleanEmail = normalizeEmail(email);
      if (!validEmail(cleanEmail)) return { ok: false, message: "Informe um e-mail válido." };
      if (household.ownerId !== account.id) return { ok: false, message: "Só quem criou o Ninho pode convidar." };
      if (cleanEmail === account.email) return { ok: false, message: "Você já faz parte deste Ninho." };
      const owner = db.accounts.find((item) => item.id === household.ownerId);
      const plan = PLANS[owner?.planId ?? "monthly_solo"];
      const entitled = Boolean(owner?.compAccess) || plan.shared;
      if (!entitled) {
        return { ok: false, message: "Seu plano é individual. Faça upgrade para o compartilhado para convidar alguém." };
      }
      if (household.memberIds.length >= plan.seats && !owner?.compAccess) {
        return { ok: false, message: `Este Ninho já tem ${plan.seats} pessoas.` };
      }
      const existing = db.accounts.find((item) => item.email === cleanEmail);
      if (existing && existing.householdId === household.id) {
        return { ok: false, message: "Esta pessoa já está no Ninho." };
      }
      if (existing?.role === "admin") {
        return { ok: false, message: "Contas administradoras não podem ser vinculadas." };
      }
      const pendingForEmail = household.invites.filter((invite) => !invite.acceptedAtISO && invite.email !== cleanEmail).length;
      if (household.memberIds.length + pendingForEmail >= plan.seats && !owner?.compAccess) {
        return { ok: false, message: `Este Ninho já tem ${plan.seats} pessoas (ou convites pendentes).` };
      }
      return commit((current) => ({
        ...current,
        households: current.households.map((item) =>
          item.id === household.id
            ? {
                ...item,
                invites: [
                  ...item.invites,
                  { email: cleanEmail, invitedByAccountId: account.id, createdAtISO: new Date().toISOString() },
                ],
              }
            : item
        ),
      }));
    },
    [db, account, household, commit]
  );

  const removeMember = React.useCallback<AuthContextValue["removeMember"]>(
    (accountId) => {
      if (!db || !account || !household) return { ok: false, message: "Sessão expirada." };
      if (household.ownerId !== account.id) return { ok: false, message: "Só quem criou o Ninho pode remover." };
      if (accountId === account.id) return { ok: false, message: "Você não pode remover a si mesmo." };
      const newHouseholdId = id("hh");
      const member = db.accounts.find((item) => item.id === accountId);
      if (!member) return { ok: false, message: "Pessoa não encontrada." };
      return commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) =>
          item.id === accountId ? { ...item, householdId: newHouseholdId } : item
        ),
        households: [
          ...current.households.map((item) =>
            item.id === household.id
              ? { ...item, memberIds: item.memberIds.filter((memberId) => memberId !== accountId) }
              : item
          ),
          {
            id: newHouseholdId,
            name: `Ninho de ${member.name.split(" ")[0]}`,
            ownerId: member.id,
            memberIds: [member.id],
            invites: [],
            data: { ...(current.households.find((item) => item.id === household.id)?.data ?? createEmptyData(member.name, member.email)), profile: { name: member.name, email: member.email } },
            createdAtISO: new Date().toISOString(),
          },
        ],
      }));
    },
    [db, account, household, commit]
  );

  const renameHousehold = React.useCallback<AuthContextValue["renameHousehold"]>(
    (name) => {
      if (!household || !account) return { ok: false, message: "Sessão expirada." };
      if (household.ownerId !== account.id && account.role !== "admin") {
        return { ok: false, message: "Só o titular pode mudar o nome do Ninho." };
      }
      const cleanName = name.trim();
      if (cleanName.length < 2) return { ok: false, message: "Dê um nome ao Ninho." };
      if (cleanName.length > 40) return { ok: false, message: "Use até 40 caracteres." };
      return commit((current) => ({
        ...current,
        households: current.households.map((item) =>
          item.id === household.id ? { ...item, name: cleanName } : item
        ),
      }));
    },
    [household, account, commit]
  );

  const subscribe = React.useCallback<AuthContextValue["subscribe"]>(
    (planId, method, promotionCode) => {
      if (!account || !db) return { ok: false, message: "Sessão expirada." };
      const plan = PLANS[planId];
      let amountCents = plan.priceCents;
      let appliedPromotion: Promotion | null = null;
      let deliveryId: string | null = null;
      if (promotionCode?.trim()) {
        const code = promotionCode.trim().toUpperCase();
        const candidates = db.deliveries.filter(
          (item) => item.accountId === account.id && !item.redeemedAtISO
        );
        const match = candidates
          .map((item) => ({ delivery: item, promotion: db.promotions.find((promo) => promo.id === item.promotionId) }))
          .find((entry) => entry.promotion?.code === code);
        if (!match?.promotion) return { ok: false, message: "Cupom inválido para este login." };
        if (new Date(match.promotion.expiresAtISO) <= new Date()) return { ok: false, message: "Este cupom expirou." };
        if (match.promotion.planIds.length && !match.promotion.planIds.includes(planId)) {
          return { ok: false, message: "Este cupom não vale para o plano escolhido." };
        }
        appliedPromotion = match.promotion;
        deliveryId = match.delivery.id;
        amountCents = promotionPrice(plan.priceCents, match.promotion.discountPercent);
      }
      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.period === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      const payment: NinhoPayment = {
        id: id("pay"),
        atISO: now.toISOString(),
        amountCents,
        planId,
        method,
        reference: `NINHO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomHex(4).toUpperCase()}`,
        status: "paid",
        note: appliedPromotion
          ? `Cupom ${appliedPromotion.code} (-${appliedPromotion.discountPercent}%) · pagamento simulado`
          : method === "card" ? "Pagamento simulado · ambiente de demonstração" : "Pix simulado · ambiente de demonstração",
      };
      return commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) =>
          item.id === account.id
            ? {
                ...item,
                planId,
                subscriptionStatus: "active",
                currentPeriodEndISO: periodEnd.toISOString(),
                payments: [payment, ...item.payments],
              }
            : item
        ),
        deliveries: current.deliveries.map((item) =>
          item.id === deliveryId ? { ...item, readAtISO: item.readAtISO ?? now.toISOString(), redeemedAtISO: now.toISOString() } : item
        ),
      }));
    },
    [account, db, commit]
  );

  const cancelSubscription = React.useCallback(() => {
    if (!account) return;
    replaceAccount(account.id, (item) => ({ ...item, subscriptionStatus: "canceled" }));
  }, [account, replaceAccount]);

  const adminSetModule = React.useCallback<AuthContextValue["adminSetModule"]>(
    (accountId, moduleId, enabled) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores podem liberar módulos." };
      if (!db) return { ok: false, message: "Banco de dados indisponível." };
      const target = db.accounts.find((item) => item.id === accountId);
      if (!target) return { ok: false, message: "Cliente não encontrado." };
      if (target.role === "admin") return { ok: false, message: "O administrador já tem todos os módulos." };
      const owner = moduleOwnerFor(db, target);
      if (!owner) return { ok: false, message: "Titular do Ninho não encontrado." };
      const current = owner.enabledModules ?? [];
      const next = enabled
        ? Array.from(new Set([...current, moduleId]))
        : current.filter((id) => id !== moduleId);
      const result = replaceAccount(owner.id, (item) => ({ ...item, enabledModules: next }));
      return result.ok
        ? {
            ok: true,
            message: enabled
              ? `Módulo ${MODULE_CATALOG[moduleId].label} liberado para ${owner.name}.`
              : `Módulo ${MODULE_CATALOG[moduleId].label} bloqueado para ${owner.name}.`,
          }
        : result;
    },
    [account, db, replaceAccount]
  );

  const adminGrantFree = React.useCallback<AuthContextValue["adminGrantFree"]>(
    (accountId, grant, note) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores." };
      if (accountId === account.id) return { ok: false, message: "Você já tem acesso administrativo." };
      if (!db) return { ok: false, message: "Banco indisponível." };
      const target = db.accounts.find((item) => item.id === accountId);
      if (!target) return { ok: false, message: "Conta não encontrada." };
      if (target.role === "admin") return { ok: false, message: "Administradores não recebem cortesia." };
      if (grant) {
        const activeFree = db.accounts.filter((item) => item.role !== "admin" && item.compAccess).length;
        if (activeFree >= 50) return { ok: false, message: "Limite de 50 cortesias ativas. Revogue alguma antes." };
      }
      return replaceAccount(accountId, (item) => ({
        ...item,
        compAccess: grant,
        compNote: grant ? note ?? "Liberado pelo administrador" : undefined,
        subscriptionStatus: grant ? "active" : item.compAccess ? "trial" : item.subscriptionStatus,
      }));
    },
    [account, db, replaceAccount]
  );

  const adminSetPlan = React.useCallback<AuthContextValue["adminSetPlan"]>(
    (accountId, planId) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores." };
      if (!db) return { ok: false, message: "Banco indisponível." };
      const target = db.accounts.find((item) => item.id === accountId);
      if (!target) return { ok: false, message: "Conta não encontrada." };
      const home = db.households.find((item) => item.id === target.householdId);
      const seats = PLANS[planId].seats;
      if (home && home.memberIds.length > seats && !target.compAccess) {
        return {
          ok: false,
          message: `Este Ninho tem ${home.memberIds.length} pessoas. Remova membros ou mantenha um plano com ${home.memberIds.length} lugares.`,
        };
      }
      return replaceAccount(accountId, (item) => ({ ...item, planId }));
    },
    [account, db, replaceAccount]
  );

  const adminBlock = React.useCallback<AuthContextValue["adminBlock"]>(
    (accountId, blocked) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores." };
      if (accountId === account.id) return { ok: false, message: "Você não pode bloquear a si mesmo." };
      return replaceAccount(accountId, (item) => ({ ...item, blocked, subscriptionStatus: blocked ? "blocked" : "trial" }));
    },
    [account, replaceAccount]
  );

  const adminResetPassword = React.useCallback<AuthContextValue["adminResetPassword"]>(
    async (accountId, temporaryPassword) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores." };
      if (temporaryPassword.length < 8) return { ok: false, message: "Use ao menos 8 caracteres." };
      const target = db?.accounts.find((item) => item.id === accountId);
      if (!target) return { ok: false, message: "Conta não encontrada." };
      const salt = randomHex(16);
      const passwordHash = await hashPassword(temporaryPassword, salt);
      return replaceAccount(accountId, (item) => ({
        ...item,
        passwordSalt: salt,
        passwordHash,
        mustChangePassword: true,
        sessionEpoch: (item.sessionEpoch ?? 0) + 1,
      }));
    },
    [account, db, replaceAccount]
  );

  const adminDeleteAccount = React.useCallback<AuthContextValue["adminDeleteAccount"]>(
    (accountId) => {
      if (account?.role !== "admin") return { ok: false, message: "Somente administradores." };
      if (accountId === account.id) return { ok: false, message: "Você não pode excluir a própria conta." };
      return commit((current) => {
        const target = current.accounts.find((item) => item.id === accountId);
        if (!target) return current;
        const households = current.households
          .map((item) => ({
            ...item,
            // Se o titular sai, o membro mais antigo assume o Ninho.
            ownerId: item.ownerId === accountId ? item.memberIds.find((member) => member !== accountId) ?? item.ownerId : item.ownerId,
            memberIds: item.memberIds.filter((member) => member !== accountId),
          }))
          .filter((item) => item.memberIds.length > 0);
        return {
          ...current,
          accounts: current.accounts.filter((item) => item.id !== accountId),
          households,
          promotions: current.promotions.filter((promo) => promo.createdByAccountId !== accountId),
          deliveries: current.deliveries.filter(
            (delivery) =>
              delivery.accountId !== accountId &&
              current.promotions.some((promo) => promo.id === delivery.promotionId && promo.createdByAccountId !== accountId)
          ),
          sessionUserId: current.sessionUserId === accountId ? null : current.sessionUserId,
          sessionSignature: current.sessionUserId === accountId ? null : current.sessionSignature,
        };
      });
    },
    [account, commit]
  );

  const refreshDB = React.useCallback(() => {
    const stored = readDB();
    if (stored) {
      dbRef.current = stored;
      setDBState(stored);
    }
  }, []);

  const myPromotions = React.useMemo<ClientPromotion[]>(() => {
    if (!db || !account) return [];
    const now = new Date();
    return db.deliveries
      .filter((delivery) => delivery.accountId === account.id)
      .map((delivery) => {
        const promotion = db.promotions.find((item) => item.id === delivery.promotionId);
        if (!promotion) return null;
        return {
          delivery,
          promotion,
          expired: new Date(promotion.expiresAtISO) <= now,
          redeemed: Boolean(delivery.redeemedAtISO),
        };
      })
      .filter((entry): entry is ClientPromotion => entry !== null)
      .sort((a, b) => b.delivery.sentAtISO.localeCompare(a.delivery.sentAtISO));
  }, [db, account]);

  const markPromotionRead = React.useCallback(
    (deliveryId: string) => {
      if (!account) return;
      commit((current) => ({
        ...current,
        deliveries: current.deliveries.map((item) =>
          item.id === deliveryId && !item.readAtISO ? { ...item, readAtISO: new Date().toISOString() } : item
        ),
      }));
    },
    [account, commit]
  );

  const sendPromotion = React.useCallback<AuthContextValue["sendPromotion"]>(
    (input) => {
      if (!db || account?.role !== "admin") return { ok: false, message: "Somente administradores podem enviar promoções." };
      if (input.title.trim().length < 3) return { ok: false, message: "Dê um título à promoção." };
      if (input.discountPercent <= 0 || input.discountPercent > 100) return { ok: false, message: "Informe um desconto entre 1% e 100%." };
      if (input.discountPercent >= 80 && input.audience !== "individual") {
        return { ok: false, message: "Descontos acima de 80% exigem envio individual para reduzir risco de abuso." };
      }
      const clients = db.accounts.filter((item) => item.role !== "admin");
      const now = new Date();
      let recipients = clients;
      const isIndividual = Boolean(input.accountId);
      if (isIndividual) {
        recipients = clients.filter((item) => item.id === input.accountId);
        if (!recipients.length) return { ok: false, message: "Cliente não encontrado." };
      } else if (input.audience === "paying") {
        recipients = clients.filter((item) => item.subscriptionStatus === "active" && !item.compAccess);
      } else if (input.audience === "trial") {
        recipients = clients.filter((item) => item.subscriptionStatus === "trial" && accountHasAccess(item, now));
      } else if (input.audience === "expired") {
        recipients = clients.filter((item) => !accountHasAccess(item, now));
      }
      if (!recipients.length) return { ok: false, message: "Nenhum cliente neste público." };
      const rawCode = (input.code?.trim() || `NINHO${randomHex(3)}`).toUpperCase();
      if (db.promotions.some((promo) => promo.code === rawCode)) {
        return { ok: false, message: "Já existe uma promoção com este código." };
      }
      const promotion: Promotion = {
        id: id("promo"),
        createdAtISO: now.toISOString(),
        createdByAccountId: account.id,
        title: input.title.trim(),
        message: input.message.trim(),
        discountPercent: Math.round(input.discountPercent),
        planIds: input.planIds,
        code: rawCode,
        expiresAtISO: new Date(Date.now() + Math.max(1, input.expiresInDays) * 86_400_000).toISOString(),
        audience: isIndividual ? "individual" : input.audience,
        recipientCount: recipients.length,
      };
      const deliveries: PromotionDelivery[] = recipients.map((recipient) => ({
        id: id("pmd"),
        promotionId: promotion.id,
        accountId: recipient.id,
        sentAtISO: now.toISOString(),
      }));
      const result = commit((current) => ({
        ...current,
        promotions: [promotion, ...current.promotions],
        deliveries: [...deliveries, ...current.deliveries],
      }));
      return result.ok ? { ok: true, recipients: recipients.length } : result;
    },
    [db, account, commit]
  );

  const activateExternalSubscription = React.useCallback<AuthContextValue["activateExternalSubscription"]>(
    ({ planId, amountCents, reference, paidAtISO, provider, customerId, subscriptionId }) => {
      if (!account) return { ok: false, message: "Entre na sua conta para ativar o plano." };
      if (!PLANS[planId]) return { ok: false, message: "Plano inválido." };
      if (!reference || amountCents < 0) return { ok: false, message: "Pagamento inválido." };
      if (account.payments.some((payment) => payment.reference === reference && payment.status === "paid")) {
        return { ok: true, message: "Este pagamento já foi aplicado." };
      }
      const plan = PLANS[planId];
      const paidAt = paidAtISO ? new Date(paidAtISO) : new Date();
      const periodEnd = new Date(paidAt);
      if (plan.period === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      const payment: NinhoPayment = {
        id: id("pay"),
        atISO: paidAt.toISOString(),
        amountCents,
        planId,
        method: "card",
        reference,
        status: "paid",
        note: `${provider ?? "Stripe"} · pagamento confirmado`,
      };
      return replaceAccount(account.id, (item) => ({
        ...item,
        planId,
        subscriptionStatus: "active",
        currentPeriodEndISO: periodEnd.toISOString(),
        stripeCustomerId: customerId ?? item.stripeCustomerId,
        stripeSubscriptionId: subscriptionId ?? item.stripeSubscriptionId,
        payments: [payment, ...item.payments],
      }));
    },
    [account, replaceAccount]
  );

  const pendingInvites = React.useMemo(
    () => household?.invites.filter((invite) => !invite.acceptedAtISO) ?? [],
    [household]
  );

  const incomingInvites = React.useMemo(() => {
    if (!db || !account) return [];
    return db.households.flatMap((item) => {
      if (item.id === account.householdId) return [];
      return item.invites
        .filter((invite) => !invite.acceptedAtISO && invite.email === account.email)
        .map((invite) => ({ household: item, invite }));
    });
  }, [db, account]);

  const acceptInvite = React.useCallback<AuthContextValue["acceptInvite"]>(
    (householdId) => {
      if (!db || !account) return { ok: false, message: "Sessão expirada." };
      const target = db.households.find((item) => item.id === householdId);
      if (!target) return { ok: false, message: "Ninho não encontrado." };
      const owner = db.accounts.find((item) => item.id === target.ownerId);
      const plan = PLANS[owner?.planId ?? "monthly_solo"];
      if (!owner?.compAccess && (!plan.shared || target.memberIds.length >= plan.seats)) {
        return { ok: false, message: "Este Ninho não tem vagas disponíveis no plano atual." };
      }
      if (!target.invites.some((invite) => invite.email === account.email && !invite.acceptedAtISO)) {
        return { ok: false, message: "Convite não encontrado ou já utilizado." };
      }
      return commit((current) => ({
        ...current,
        accounts: current.accounts.map((item) =>
          item.id === account.id ? { ...item, householdId } : item
        ),
        households: current.households.map((item) => {
          if (item.id === householdId) {
            return {
              ...item,
              memberIds: [...new Set([...item.memberIds, account.id])],
              invites: item.invites.map((invite) =>
                invite.email === account.email && !invite.acceptedAtISO
                  ? { ...invite, acceptedAtISO: new Date().toISOString() }
                  : invite
              ),
            };
          }
          const remaining = item.memberIds.filter((member) => member !== account.id);
          // Se quem sai era titular, o membro mais antigo assume o Ninho.
          const nextOwner =
            item.ownerId === account.id
              ? remaining[0] ?? item.ownerId
              : item.ownerId;
          return { ...item, ownerId: nextOwner, memberIds: remaining };
        }),
      }));
    },
    [db, account, commit]
  );

  const declineInvite = React.useCallback<AuthContextValue["declineInvite"]>(
    (householdId) => {
      if (!account) return { ok: false, message: "Sessão expirada." };
      return commit((current) => ({
        ...current,
        households: current.households.map((item) =>
          item.id === householdId
            ? { ...item, invites: item.invites.filter((invite) => invite.email !== account.email) }
            : item
        ),
      }));
    },
    [account, commit]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ready,
      db: db ?? {
        version: 1,
        accounts: [],
        households: [],
        promotions: [],
        deliveries: [],
        sessionUserId: null,
        sessionSignature: null,
        attempts: [],
        updatedAtISO: "",
      },
      account,
      household,
      workspace: household?.data ?? null,
      isAdmin: account?.role === "admin",
      hasAccess,
      enabledModules,
      canUseModule: canUse,
      adminSetModule,
      signIn,
      signUp,
      signOut,
      saveWorkspace,
      updateOwnProfile,
      changePassword,
      requestPasswordReset,
      resetPasswordWithCode,
      getRecoveryCode,
      regenerateRecoveryCode,
      inviteMember,
      removeMember,
      renameHousehold,
      pendingInvites,
      incomingInvites,
      acceptInvite,
      declineInvite,
      subscribe,
      activateExternalSubscription,
      myPromotions,
      markPromotionRead,
      sendPromotion,
      promotions: db?.promotions ?? [],
      deliveries: db?.deliveries ?? [],
      cancelSubscription,
      adminGrantFree,
      adminSetPlan,
      adminBlock,
      adminResetPassword,
      adminDeleteAccount,
      refreshDB,
    }),
    [
      ready, db, account, household, hasAccess, enabledModules, canUse, adminSetModule, signIn, signUp, signOut, saveWorkspace,
      updateOwnProfile, changePassword, requestPasswordReset, resetPasswordWithCode,
      getRecoveryCode, regenerateRecoveryCode, inviteMember, removeMember, renameHousehold,
      pendingInvites, incomingInvites, acceptInvite, declineInvite, subscribe,
      activateExternalSubscription, myPromotions,
      markPromotionRead, sendPromotion, db?.promotions, db?.deliveries, cancelSubscription, adminGrantFree, adminSetPlan,
      adminBlock, adminResetPassword, adminDeleteAccount, refreshDB,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
