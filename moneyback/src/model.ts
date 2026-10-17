export const DEMO_AS_OF = "2026-04-16T15:00:00.000Z";
export const FREE_DRAFT_LIMIT = 1;

export type PlanId = "free" | "pro" | "family";

export function normalizePlan(value: unknown): PlanId {
  if (value === "free" || value === "pro" || value === "family") return value;
  if (value === "plus_monthly" || value === "plus_annual") return "pro";
  return "free";
}
export type Phase = "welcome" | "results" | "ready";
export type ConnectionProvider = "plaid_preview" | "csv" | "sample";
export type ConnectionStatus = "healthy" | "attention" | "disconnected";
export type TransactionStatus = "pending" | "posted";
export type MoneyDirection = "debit" | "credit";

export type TransactionCategory =
  | "shopping"
  | "electronics"
  | "groceries"
  | "restaurant"
  | "subscription"
  | "fitness"
  | "utilities"
  | "travel"
  | "transit"
  | "housing"
  | "other";

export type Transaction = {
  id: string;
  connectionId: string;
  externalId: string;
  merchantName: string;
  merchantId: string;
  amount: number;
  direction: MoneyDirection;
  currency: "USD";
  occurredAt: string;
  postedAt: string | null;
  status: TransactionStatus;
  category: TransactionCategory;
  reference: string | null;
  settlesAuthorizationId: string | null;
  source: ConnectionProvider;
};

export type UserPreference = "essential" | "wanted" | "unwanted" | "unknown";
export type Frequency = "weekly" | "monthly" | "yearly" | "irregular";

export type Cancellation = {
  effectiveOn: string;
  confirmation: string | null;
  recordedAt: string;
};

export type RecurringStream = {
  id: string;
  merchantId: string;
  merchantName: string;
  frequency: Frequency;
  expectedAmount: number;
  confidence: number;
  lastChargeAt: string;
  nextWindowStart: string;
  nextWindowEnd: string;
  userPreference: UserPreference;
  transactionIds: string[];
  cancellation: Cancellation | null;
};

export type OpportunityType =
  | "duplicate_charge"
  | "unwanted_subscription"
  | "post_cancellation_charge"
  | "missing_refund"
  | "price_discrepancy";

export type OpportunityStatus =
  | "needs_review"
  | "eligible"
  | "action_required"
  | "in_progress"
  | "recovered"
  | "unsuccessful"
  | "closed";

export type ConfidenceLabel = "high" | "medium" | "low";

export type Evidence = {
  id: string;
  sourceType: "transaction" | "user_statement" | "receipt" | "merchant_message" | "account_credit";
  summary: string;
  transactionId?: string;
  recordedAt: string;
};

export type Opportunity = {
  id: string;
  type: OpportunityType;
  merchantId: string;
  merchantName: string;
  amountEstimate: number;
  confidence: ConfidenceLabel;
  detectionReason: string;
  status: OpportunityStatus;
  deadline: string | null;
  evidence: Evidence[];
  transactionIds: string[];
  fingerprint: string;
  createdAt: string;
  dismissedReason?: string;
  creditMatchRejected?: boolean;
};

export type CaseStatus =
  | "evidence_review"
  | "user_confirmation"
  | "awaiting_approval"
  | "monitoring"
  | "verified"
  | "rejected"
  | "closed";

export type CaseQuestion = {
  id: string;
  prompt: string;
  helper?: string;
  required: boolean;
  answer: string | null;
  options?: { value: string; label: string }[];
  input?: "text" | "date";
};

export type RecoveryDraft = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  createdAt: string;
};

export type TimelineEvent = {
  id: string;
  actor: "agent" | "user" | "system";
  action: string;
  detail: string;
  at: string;
  approvalId?: string;
};

export type FollowUp = {
  draft: RecoveryDraft;
  approvalId: string | null;
  sentAt: string | null;
};

export type RecoveryCase = {
  id: string;
  caseNumber: number;
  opportunityId: string;
  status: CaseStatus;
  questions: CaseQuestion[];
  recipient: string;
  draft: RecoveryDraft | null;
  draftCounted: boolean;
  followUp: FollowUp | null;
  timeline: TimelineEvent[];
  submittedAt: string | null;
  resolvedAt: string | null;
  approvalId: string | null;
  nextActionAt: string | null;
};

export type SavingsType = "verified_recovery" | "pending_recovery" | "projected_savings" | "realized_savings";

export type SavingsEntry = {
  id: string;
  caseId: string | null;
  opportunityId: string | null;
  streamId: string | null;
  amount: number;
  type: SavingsType;
  verificationSource: string;
  verifiedAt: string | null;
  note: string;
};

export type ActionLogEntry = {
  id: string;
  caseId: string | null;
  actor: "agent" | "user" | "system";
  action: string;
  detail: string;
  approvalId: string | null;
  at: string;
  outcome: string;
};

export type FinancialConnection = {
  id: string;
  provider: ConnectionProvider;
  institutionName: string;
  accountMask: string;
  scope: string;
  lastSyncAt: string | null;
  status: ConnectionStatus;
  createdAt: string;
};

export type Profile = {
  name: string;
  email: string;
  createdAt: string;
};

export type RefundPromise = {
  id: string;
  merchantName: string;
  merchantId: string;
  amount: number;
  promisedOn: string;
  note: string;
  transactionId: string | null;
};

export type PriceClaim = {
  id: string;
  transactionId: string;
  receiptTotal: number;
  note: string;
};

export type AppState = {
  phase: Phase;
  profile: Profile | null;
  plan: PlanId;
  draftsUsed: number;
  sampleHousehold: boolean;
  connections: FinancialConnection[];
  transactions: Transaction[];
  streams: RecurringStream[];
  opportunities: Opportunity[];
  cases: RecoveryCase[];
  ledger: SavingsEntry[];
  actions: ActionLogEntry[];
  refundPromises: RefundPromise[];
  priceClaims: PriceClaim[];
  nextCaseNumber: number;
  asOf: string;
};

export function cents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(amount: number): number {
  return amount / 100;
}

export function roundMoney(amount: number): number {
  return fromCents(cents(amount));
}

export function sumMoney(amounts: number[]): number {
  return fromCents(amounts.reduce((total, amount) => total + cents(amount), 0));
}

export function moneyEqual(a: number, b: number, toleranceCents = 0): boolean {
  return Math.abs(cents(a) - cents(b)) <= toleranceCents;
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${dateOnly(isoDate)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string): number {
  const start = new Date(`${dateOnly(earlier)}T00:00:00.000Z`).getTime();
  const end = new Date(`${dateOnly(later)}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function businessDaysBetween(earlier: string, later: string): number {
  let count = 0;
  let cursor = addDays(earlier, 1);
  const end = dateOnly(later);
  while (cursor <= end) {
    const day = new Date(`${cursor}T00:00:00.000Z`).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function minutesBetween(earlier: string, later: string): number {
  return Math.abs(new Date(earlier).getTime() - new Date(later).getTime()) / 60_000;
}

const SMALL_WORDS = new Set(["and", "of", "the"]);

export function normalizeMerchant(name: string): { merchantId: string; merchantName: string } {
  const cleaned = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|ltd|co|com|store)\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const merchantId = cleaned.replace(/\s+/g, "-") || "unknown-merchant";
  const merchantName = cleaned
    .split(" ")
    .filter(Boolean)
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
  return { merchantId, merchantName: merchantName || name.trim() };
}

export function emptyState(): AppState {
  return {
    phase: "welcome",
    profile: null,
    plan: "free",
    draftsUsed: 0,
    sampleHousehold: false,
    connections: [],
    transactions: [],
    streams: [],
    opportunities: [],
    cases: [],
    ledger: [],
    actions: [],
    refundPromises: [],
    priceClaims: [],
    nextCaseNumber: 104,
    asOf: DEMO_AS_OF,
  };
}

export const OPEN_STATUSES: OpportunityStatus[] = ["needs_review", "eligible", "action_required", "in_progress"];

export function isOpenStatus(status: OpportunityStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
