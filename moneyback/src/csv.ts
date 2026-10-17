import type { ConnectionProvider, Transaction, TransactionCategory } from "./model";
import { normalizeMerchant, roundMoney } from "./model";

export type CsvParseResult = {
  transactions: Transaction[];
  errors: string[];
};

const CATEGORIES = new Set<TransactionCategory>([
  "shopping",
  "electronics",
  "groceries",
  "restaurant",
  "subscription",
  "fitness",
  "utilities",
  "travel",
  "transit",
  "housing",
  "other",
]);

export function parseTransactionCsv(text: string, connectionId: string, source: ConnectionProvider = "csv"): CsvParseResult {
  const rows = parseRows(text);
  if (rows.length === 0) return { transactions: [], errors: ["The file is empty."] };
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const dateIndex = header.findIndex((cell) => ["date", "posted", "occurred", "transaction date"].includes(cell));
  const merchantIndex = header.findIndex((cell) => ["merchant", "description", "name", "payee"].includes(cell));
  const amountIndex = header.findIndex((cell) => ["amount", "amt"].includes(cell));
  if (dateIndex < 0 || merchantIndex < 0 || amountIndex < 0) {
    return { transactions: [], errors: ["Use a header row with date, merchant, and amount columns."] };
  }
  const statusIndex = header.findIndex((cell) => cell === "status");
  const categoryIndex = header.findIndex((cell) => cell === "category");
  const referenceIndex = header.findIndex((cell) => ["reference", "order", "id"].includes(cell));
  const errors: string[] = [];
  const transactions: Transaction[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => cell.trim() === "")) return;
    const line = index + 2;
    const date = normalizeDate(row[dateIndex] ?? "");
    const merchantRaw = (row[merchantIndex] ?? "").trim();
    const amountRaw = (row[amountIndex] ?? "").trim();
    if (!date || !merchantRaw || !amountRaw) {
      errors.push(`Row ${line} is missing a date, merchant, or amount.`);
      return;
    }
    const parsed = parseAmount(amountRaw);
    if (!parsed) {
      errors.push(`Row ${line} has an amount MoneyBack cannot read.`);
      return;
    }
    const statusCell = (statusIndex >= 0 ? row[statusIndex] : "posted").trim().toLowerCase();
    const status = statusCell === "pending" ? "pending" : "posted";
    const categoryCell = (categoryIndex >= 0 ? row[categoryIndex] : "").trim().toLowerCase();
    const category = CATEGORIES.has(categoryCell as TransactionCategory)
      ? (categoryCell as TransactionCategory)
      : guessCategory(merchantRaw);
    const reference = referenceIndex >= 0 ? row[referenceIndex]?.trim() || null : null;
    const externalId = reference
      ? `${date}|${merchantRaw.toLowerCase()}|${parsed.amount}|${parsed.direction}|${reference}|${line}`
      : `${date}|${merchantRaw.toLowerCase()}|${parsed.amount}|${parsed.direction}|${line}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    const merchant = normalizeMerchant(merchantRaw);
    transactions.push({
      id: `tx_${connectionId}_${transactions.length + 1}`,
      connectionId,
      externalId,
      merchantName: merchantRaw,
      merchantId: merchant.merchantId,
      amount: parsed.amount,
      direction: parsed.direction,
      currency: "USD",
      occurredAt: `${date}T12:00:00.000Z`,
      postedAt: status === "posted" ? `${date}T12:00:00.000Z` : null,
      status,
      category,
      reference,
      settlesAuthorizationId: null,
      source,
    });
  });

  if (transactions.length === 0 && errors.length === 0) {
    errors.push("No transaction rows were found.");
  }
  return { transactions, errors };
}

function parseRows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitCsvLine);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

function parseAmount(value: string): { amount: number; direction: "debit" | "credit" } | null {
  const creditMarked = /\bCR\b/i.test(value) || /^\(.*\)$/.test(value.trim()) || value.trim().startsWith("-");
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return null;
  return { amount: roundMoney(numeric), direction: creditMarked ? "credit" : "debit" };
}

function guessCategory(merchant: string): TransactionCategory {
  const name = merchant.toLowerCase();
  if (/gym|fitness|peloton/.test(name)) return "fitness";
  if (/netflix|spotify|hulu|icloud|disney|youtube|subscription/.test(name)) return "subscription";
  if (/power|electric|water|internet|xfinity|comcast|utility/.test(name)) return "utilities";
  if (/restaurant|cafe|coffee|grill|kitchen|doordash|uber eats/.test(name)) return "restaurant";
  if (/market|grocery|trader|kroger|safeway/.test(name)) return "groceries";
  if (/airline|hotel|airbnb|united|delta/.test(name)) return "travel";
  if (/uber|lyft|transit|metro/.test(name)) return "transit";
  if (/rent|apartments|property/.test(name)) return "housing";
  if (/best buy|apple|electronics/.test(name)) return "electronics";
  return "shopping";
}
