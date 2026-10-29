import type { Category, Goal, PaymentMethod, TransactionType } from "../state/types";
import { CATEGORIES } from "../state/types";
import { addMonthsYM, dateToISO, monthName, todayISO, ymFromISO, parseISODate } from "./date";
import { parseMoneyToCents } from "./money";

export type AssistantMode = "transaction" | "plan" | "goal";

export type ParsedEntry = {
  mode: AssistantMode;
  type: TransactionType;
  description: string;
  amountCents: number;
  dateISO: string;
  category: Category;
  paymentMethod: PaymentMethod;
  isCard: boolean;
  installments: number;
  fixed: boolean;
  confidence: number;
  goalId?: string;
  goalTitle?: string;
};

const CATEGORY_KEYWORDS: Array<[Category, string[]]> = [
  ["Moradia", ["aluguel", "condomínio", "condominio", "luz", "energia", "elétrica", "eletrica", "água", "agua", "esgoto", "internet", "tv", "celular", "gás", "gas", "faxina", "diarista", "casa"]],
  ["Transporte", ["combustível", "combustivel", "gasolina", "etanol", "uber", "99", "ônibus", "onibus", "metrô", "metro", "moto", "carro", "estacionamento", "pedágio", "pedagio", "mecânico", "mecanico", "pneus"]],
  ["Alimentação", ["mercado", "supermercado", "padaria", "restaurante", "lanche", "ifood", "café", "cafe", "feira", "açougue", "acougue", "carnes", "almoço", "almoco", "jantar", "pizza", "alimentação", "alimentacao"]],
  ["Filhos", ["filho", "filha", "leite", "fralda", "escola", "creche", "brinquedo", "pediatra", "babá", "baba", "uniforme", "colégio", "colegio"]],
  ["Cuidados Pessoais", ["farmácia", "farmacia", "remédio", "remedio", "cabelo", "barbearia", "beleza", "academia", "dermato", "cosmético", "cosmetico", "manicure", "curso", "inglês", "ingles", "spa"]],
  ["Cartão", ["fatura", "pagamento do cartão", "pagamento do cartao", "anuidade", "rotativo"]],
  ["Dízimo", ["dízimo", "dizimo", "igreja", "oferta", "dízimos", "dizimos"]],
];

const CARD_WORDS = ["cartão", "cartao", "crédito", "credito", "parcelado", "parcelada", "em até"];
const INCOME_WORDS = ["recebi", "receber", "receita", "entrou", "entrada", "salário", "salario", "caiu", "ganhei", "freelance", "renda", "vale alimentação", "vale alimentacao", "reembolso"];
const FIXED_WORDS = ["fixo", "fixa", "mensal", "todo mês", "todo mes", "recorrente", "assinatura"];
const GOAL_VERBS = ["guardei", "guardar", "poupei", "poupar", "separei", "separar", "aportei", "aportar", "economizei", "economizar", "reservei", "reservar", "depositei", "depositar", "coloquei", "colocar", "juntei", "juntar"];
const GOAL_REFERENCE_WORDS = ["meta", "objetivo", "sonho"];
const GOAL_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "para", "na", "no", "em", "minha", "meu", "the"]);
const PLAN_WORDS = ["previsão", "previsao", "previsto", "prevista", "planejar", "planejado", "agendar", "vence", "vencimento", "conta de"];
const PAYMENT_WORDS: Array<[PaymentMethod, string[]]> = [
  ["Vale Alimentação", ["vale alimentação", "vale alimentacao", "vale", "ticket", "alimentação"]],
  ["Dinheiro", ["dinheiro", "espécie", "especie"]],
  ["Pix/Débito", ["pix", "débito", "debito", "débito automático", "debito automatico"]],
];

const MONTH_PATTERN = "(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";
const MONTH_NUMBERS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTH_ALIASES: Record<string, number> = { marco: 2, março: 2 };

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectCategory(text: string): Category {
  const search = normalize(text);
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some((word) => search.includes(normalize(word)))) return category;
  }
  return "Outros";
}

function detectPayment(text: string): PaymentMethod {
  const search = normalize(text);
  for (const [method, words] of PAYMENT_WORDS) {
    if (words.some((word) => search.includes(normalize(word)))) return method;
  }
  return "Pix/Débito";
}

function resolveDate(
  text: string,
  planning: boolean,
  referenceDateISO?: string
): { dateISO: string; hadDate: boolean } {
  const today = todayISO();
  const reference = referenceDateISO ?? today;
  const days = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const search = normalize(text);
  const nextOccurrence = (day: number, forceNextMonth = false) => {
    const now = parseISODate(reference);
    const current = parseISODate(today);
    let year = now.getFullYear();
    let month = now.getMonth();
    if (forceNextMonth || (!referenceDateISO && planning && day < current.getDate())) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const lastDay = new Date(year, month + 1, 0).getDate();
    return dateToISO(new Date(year, month, Math.min(day, lastDay)));
  };

  const relative = search.match(/\b(hoje|ontem|amanha|amanhã)\b/);
  if (relative) {
    if (relative[1] === "hoje") return { dateISO: today, hadDate: true };
    const current = parseISODate(today);
    const delta = relative[1] === "ontem" ? -1 : 1;
    return {
      dateISO: dateToISO(new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta)),
      hadDate: true,
    };
  }

  const explicit = search.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]) - 1;
    const currentYear = parseISODate(today).getFullYear();
    const rawYear = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : currentYear;
    const date = new Date(rawYear, month, day);
    if (!Number.isNaN(date.getTime()) && month >= 0 && month <= 11) {
      return { dateISO: dateToISO(date), hadDate: true };
    }
  }

  const named = normalize(text).match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+${MONTH_PATTERN}\\b`));
  if (named) {
    const day = Number(named[1]);
    const monthNameRaw = named[2];
    const index = MONTH_NUMBERS.findIndex((name) => normalize(name) === monthNameRaw) >= 0
      ? MONTH_NUMBERS.findIndex((name) => normalize(name) === monthNameRaw)
      : MONTH_ALIASES[monthNameRaw] ?? parseISODate(today).getMonth();
    const currentYear = parseISODate(today).getFullYear();
    return { dateISO: dateToISO(new Date(currentYear, index, day)), hadDate: true };
  }

  const nextMonth = search.includes("mes que vem") || search.includes("proximo mes") || search.includes("mes seguinte");
  const weekdayMatch = days.find((day) => search.includes(normalize(day)));
  if (weekdayMatch) {
    const target = days.indexOf(weekdayMatch);
    const now = parseISODate(today);
    const delta = (target - now.getDay() + 7) % 7 || 7;
    return {
      dateISO: dateToISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta)),
      hadDate: true,
    };
  }

  const dueMatch = search.match(/\b(?:dia|vence|vencimento|todo dia)\s+(\d{1,2})\b/) || search.match(/\bdia\s+(\d{1,2})\b/);
  if (dueMatch) {
    return { dateISO: nextOccurrence(Number(dueMatch[1]), nextMonth), hadDate: true };
  }
  if (nextMonth) {
    const nextYM = addMonthsYM(ymFromISO(reference), 1);
    return { dateISO: `${nextYM}-01`, hadDate: true };
  }
  return { dateISO: referenceDateISO ?? today, hadDate: false };
}

function resolveAmount(text: string): { amountCents: number; raw: string } {
  const matches = [...text.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})|\d+(?:\.\d{1,2})?)/gi)];
  const candidates = matches
    .map((match) => {
      const index = match.index ?? 0;
      const before = text.slice(Math.max(0, index - 6), index).toLowerCase();
      const after = text.slice(index + match[0].length, index + match[0].length + 12).toLowerCase();
      const ignore = /dia\s*$/.test(before) || /^\s*(x|vezes|parcelas?)/.test(after) || /^\s*de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/.test(after);
      const numeric = parseMoneyToCents(match[1]);
      return { raw: match[0], numeric, ignore, hasCents: /[.,]\d{1,2}$/.test(match[1]) };
    })
    .filter((candidate) => !candidate.ignore && candidate.numeric > 0);

  if (!candidates.length) return { amountCents: 0, raw: "" };
  const preferred =
    candidates.find((candidate) => candidate.raw.toLowerCase().includes("r$")) ??
    candidates.find((candidate) => candidate.hasCents) ??
    candidates.reduce((largest, candidate) => (candidate.numeric > largest.numeric ? candidate : largest));
  return { amountCents: preferred.numeric, raw: preferred.raw };
}

function significantTokens(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !GOAL_STOPWORDS.has(token));
}

/**
 * Encontra a meta citada na frase. Usa o título, a categoria e os tokens
 * significativos, então "reserva de emergência" e "reserva" chegam na mesma meta.
 */
export function matchGoal(text: string, goals: Goal[]) {
  const search = normalize(text);
  const searchTokens = new Set(significantTokens(text));
  let best: { goal: Goal; score: number } | null = null;
  for (const goal of goals) {
    const title = normalize(goal.title);
    const titleTokens = significantTokens(goal.title);
    if (!titleTokens.length) continue;
    let score = 0;
    if (search.includes(title)) score += 1;
    const matchedTokens = titleTokens.filter((token) => searchTokens.has(token) || search.includes(token));
    score += (matchedTokens.length / titleTokens.length) * 0.8;
    if (search.includes(normalize(goal.category))) score += 0.25;
    if (goal.category === "reserva" && (search.includes("emergencia") || search.includes("reserva"))) score += 0.35;
    if (score > (best?.score ?? 0)) best = { goal, score };
  }
  return best && best.score >= 0.45 ? best : null;
}

export function isGoalIntent(text: string, goals: Goal[]) {
  const search = normalize(text);
  const hasVerb = GOAL_VERBS.some((verb) => search.includes(normalize(verb)));
  const hasReference = GOAL_REFERENCE_WORDS.some((word) => search.includes(normalize(word)));
  const matched = matchGoal(text, goals);
  if (matched && (hasVerb || hasReference)) return true;
  if (hasVerb && hasReference) return true;
  // Frase de aporte sem nome da meta: com uma única meta, o destino é óbvio.
  if (hasVerb && goals.length === 1) return true;
  return false;
}

function cleanupDescription(text: string, rawAmount: string, fallback: string, isCard: boolean) {
  let clean = text;
  if (rawAmount) clean = clean.replace(rawAmount, " ");
  clean = clean
    .replace(/\br\$\s*[\d.,]+/gi, " ")
    .replace(/\b(hoje|ontem|amanhã|amanha)\b/gi, " ")
    .replace(/\bdia\s+\d{1,2}\b/gi, " ")
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}(\s*\/\s*\d{2,4})?\b/gi, " ")
    .replace(new RegExp(`\\b\\d{1,2}\\s+de\\s+${MONTH_PATTERN}\\b`, "gi"), " ")
    .replace(/\b(pr[oó]ximo|mes que vem|m[eê]s seguinte)\s+m[eê]s?\b/gi, " ")
    .replace(/\bem\s+(?:at[eé]\s+)?\d{1,2}\s*(?:x|vezes|parcelas?)\b/gi, " ")
    .replace(/\b\d{1,2}\s*x\b/gi, " ")
    .replace(/\b(parcelado|parcelada|fixo|fixa|mensal|recorrente|todo dia|todo m[eê]s|previs[aã]o|previst[oa]|planejad[oa]|agendar)\b/gi, " ")
    .replace(/\b(gastei|paguei|comprei|recebi|recebo|receber|entrou|caiu|ganhei|ganho|lan[cç]ar|registrar|adicionar|gasto|despesa|receita|renda)\b/gi, " ")
    .replace(/\b(guardei|guardar|poupei|poupar|separei|separar|aportei|aportar|economizei|economizar|reservei|reservar|depositei|depositar|coloquei|colocar|juntei|juntar|meta|objetivo|do|da|para|pra|na|no)\b/gi, " ")
    .replace(/\b(todo|todos|o|a|os|as)\s*$/gi, " ")
    .replace(/^\s*(de|do|da|dos|das|no|na|com|para|pra)\s+/i, " ")
    .replace(/\b(no|de|do|da|com|o|a)\s+(cart[aã]o|cr[eé]dito|pix|d[eé]bito|dinheiro|vale alimenta[cç][aã]o|ticket)\b/gi, " ")
    .replace(/\b(no|de|do|da|com|para)\s+$/gi, " ")
    .replace(/\b(r\$|reais|conta de)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, "")
    .trim();
  if (!clean || clean.length < 2) clean = fallback;
  if (isCard && clean.toLowerCase().startsWith("cartão")) clean = clean.slice(6).trim() || fallback;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function detectInstallments(text: string): number {
  const search = normalize(text);
  const match = search.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas?)\b/) ?? search.match(/\bem\s+(\d{1,2})\s+vezes\b/);
  const value = match ? Number(match[1]) : 1;
  return Number.isFinite(value) ? Math.max(1, Math.min(48, value)) : 1;
}

export function parseAssistantText(
  text: string,
  mode: AssistantMode,
  options?: { referenceDateISO?: string; goals?: Goal[] }
): ParsedEntry {
  const trimmed = text.trim();
  const normalized = normalize(trimmed);
  const goals = options?.goals ?? [];
  const goalIntent = mode === "goal" || isGoalIntent(trimmed, goals);
  const planning = !goalIntent && (mode === "plan" || PLAN_WORDS.some((word) => normalized.includes(normalize(word))));
  const installments = goalIntent ? 1 : detectInstallments(trimmed);
  const { amountCents, raw } = resolveAmount(trimmed);
  const income = INCOME_WORDS.some((word) => normalized.includes(normalize(word)));
  const type: TransactionType = income ? "Income" : "Expense";
  const fatura = normalized.includes("fatura");
  const isCard = type === "Expense" && !fatura && (CARD_WORDS.some((word) => normalized.includes(normalize(word))) || installments > 1);
  const category = type === "Income" ? "Outros" : detectCategory(trimmed);
  const paymentMethod = isCard ? "Cartão de Crédito" : type === "Income" && normalized.includes("vale") ? "Vale Alimentação" : detectPayment(trimmed);
  const { dateISO, hadDate } = resolveDate(trimmed, mode === "plan" || planning, options?.referenceDateISO);
  const fixed = !goalIntent && (FIXED_WORDS.some((word) => normalized.includes(normalize(word))) || mode === "plan");
  const matchedGoal = goalIntent ? matchGoal(trimmed, goals)?.goal : undefined;
  const description = goalIntent
    ? matchedGoal?.title ?? cleanupDescription(trimmed, raw, "Minha meta", false)
    : cleanupDescription(trimmed, raw, CATEGORIES.includes(category) ? category : "Novo lançamento", isCard);
  let confidence = 0.35;
  if (amountCents > 0) confidence += 0.3;
  if (description) confidence += 0.15;
  if (category !== "Outros") confidence += 0.1;
  if (hadDate) confidence += 0.1;

  return {
    mode: goalIntent ? "goal" : planning ? "plan" : "transaction",
    type,
    description,
    amountCents,
    dateISO,
    category,
    paymentMethod,
    isCard: goalIntent ? false : isCard,
    installments,
    fixed,
    confidence: Math.min(0.98, confidence),
    goalId: matchedGoal?.id,
    goalTitle: matchedGoal?.title,
  };
}

export function planEntryDescription(entry: ParsedEntry) {
  return `${entry.description} · ${monthName(ymFromISO(entry.dateISO))}`;
}
