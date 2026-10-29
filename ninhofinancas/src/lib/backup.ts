import type { Category, PaymentMethod, Transaction, TransactionStatus, TransactionType } from "../state/types";
import { CATEGORIES, PAYMENT_METHODS } from "../state/types";

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function transactionsToCSV(transactions: Transaction[]): string {
  const header = ["id", "description", "amountCents", "dateISO", "type", "category", "paymentMethod", "status"];
  const rows = transactions.map((transaction) =>
    [
      transaction.id,
      transaction.description,
      String(transaction.amountCents),
      transaction.dateISO,
      transaction.type,
      transaction.category,
      transaction.paymentMethod,
      transaction.status,
    ]
      .map((value) => escapeCsv(value))
      .join(",")
  );
  return `\uFEFF${[header.join(","), ...rows].join("\r\n")}`;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    if (char === '"' && csvText[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csvText[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function csvToTransactions(csvText: string): Transaction[] {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.toLowerCase());
  const column = (key: string) => header.indexOf(key.toLowerCase());

  return rows.slice(1).flatMap((row, index) => {
    const get = (key: string) => row[column(key)] ?? "";
    const amount = Number(get("amountCents"));
    const type = get("type") as TransactionType;
    const category = get("category") as Category;
    const paymentMethod = get("paymentMethod") as PaymentMethod;
    const status = get("status") as TransactionStatus;

    if (!get("description") || !Number.isFinite(amount) || amount <= 0) return [];
    if (type !== "Income" && type !== "Expense") return [];
    if (!CATEGORIES.includes(category)) return [];
    if (!PAYMENT_METHODS.includes(paymentMethod)) return [];
    if (status !== "Paid" && status !== "Pending") return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(get("dateISO"))) return [];

    const transaction: Transaction = {
      id: get("id") || `csv_${Date.now()}_${index}`,
      description: get("description"),
      amountCents: Math.round(amount),
      dateISO: get("dateISO"),
      type,
      category,
      paymentMethod,
      status,
    };
    return [transaction];
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file, "utf-8");
  });
}
