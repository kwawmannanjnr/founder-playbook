import { annualized } from "./format";
import type {
  Evidence,
  Frequency,
  Opportunity,
  OpportunityStatus,
  PriceClaim,
  RecurringStream,
  RefundPromise,
  SavingsEntry,
  Transaction,
  UserPreference,
} from "./model";
import {
  addDays,
  businessDaysBetween,
  cents,
  dateOnly,
  daysBetween,
  fromCents,
  minutesBetween,
  moneyEqual,
  roundMoney,
  sumMoney,
} from "./model";

const REPEAT_PURCHASE_CATEGORIES = new Set<Transaction["category"]>(["restaurant", "groceries", "transit"]);

export type StreamAnnotation = {
  merchantId: string;
  preference?: UserPreference;
  cancellation?: RecurringStream["cancellation"];
};

type AnalyzeInput = {
  transactions: Transaction[];
  refundPromises: RefundPromise[];
  priceClaims: PriceClaim[];
  annotations: StreamAnnotation[];
  asOf: string;
  previousStreams?: RecurringStream[];
  previousOpportunities?: Opportunity[];
  keptLedger?: SavingsEntry[];
};

export type Analysis = {
  streams: RecurringStream[];
  opportunities: Opportunity[];
  ledger: SavingsEntry[];
};

export function analyze(input: AnalyzeInput): Analysis {
  const streams = detectStreams(input.transactions, input.asOf, input.annotations, input.previousStreams ?? []);
  const detected = [
    ...detectDuplicates(input.transactions, input.asOf),
    ...detectPostCancellation(streams, input.transactions, input.asOf),
    ...detectMissingRefunds(input.refundPromises, input.transactions, input.asOf),
    ...detectPriceGaps(input.priceClaims, input.transactions, input.asOf),
    ...detectUnwanted(streams, input.asOf),
  ];
  const opportunities = mergeOpportunities(input.previousOpportunities ?? [], detected);
  applyHistoricalCredits(opportunities, input.transactions, input.asOf);
  const ledger = rebuildLedger(input.keptLedger ?? [], streams, opportunities, input.transactions, input.asOf);
  return { streams, opportunities, ledger };
}

function detectStreams(
  transactions: Transaction[],
  asOf: string,
  annotations: StreamAnnotation[],
  previous: RecurringStream[],
): RecurringStream[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.direction !== "debit" || transaction.status !== "posted") continue;
    const list = groups.get(transaction.merchantId) ?? [];
    list.push(transaction);
    groups.set(transaction.merchantId, list);
  }

  const streams: RecurringStream[] = [];
  for (const [merchantId, charges] of groups) {
    const ordered = [...charges].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (ordered.length < 3) continue;
    const intervals: number[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      intervals.push(daysBetween(ordered[index - 1].occurredAt, ordered[index].occurredAt));
    }
    const medianInterval = median(intervals);
    const frequency = frequencyFor(medianInterval);
    if (frequency === "irregular" && medianInterval > 45 && medianInterval < 300) continue;
    const amounts = ordered.map((charge) => charge.amount);
    const mean = sumMoney(amounts) / amounts.length;
    const variance = amounts.reduce((total, amount) => total + (amount - mean) ** 2, 0) / amounts.length;
    const cv = mean === 0 ? 1 : Math.sqrt(variance) / mean;
    let confidence = 0.42;
    if (frequency !== "irregular" && cv < 0.08) confidence = 0.94;
    else if (frequency !== "irregular" && cv < 0.2) confidence = 0.74;
    else if (frequency !== "irregular") confidence = 0.56;
    const expectedAmount = roundMoney(median(amounts));
    const last = ordered[ordered.length - 1];
    const span = spanFor(frequency);
    const previousStream = previous.find((stream) => stream.merchantId === merchantId);
    const annotation = annotations.find((item) => item.merchantId === merchantId);
    const next = addDays(last.occurredAt, span);
    streams.push({
      id: `stream_${merchantId}`,
      merchantId,
      merchantName: last.merchantName,
      frequency,
      expectedAmount,
      confidence,
      lastChargeAt: last.occurredAt,
      nextWindowStart: addDays(next, -3),
      nextWindowEnd: addDays(next, 3),
      userPreference: annotation?.preference ?? previousStream?.userPreference ?? "unknown",
      transactionIds: ordered.map((charge) => charge.id),
      cancellation: annotation?.cancellation ?? previousStream?.cancellation ?? null,
    });
  }
  return streams.sort((a, b) => a.merchantName.localeCompare(b.merchantName));
}

function frequencyFor(medianInterval: number): Frequency {
  if (medianInterval >= 6 && medianInterval <= 8) return "weekly";
  if (medianInterval >= 26 && medianInterval <= 35) return "monthly";
  if (medianInterval >= 350 && medianInterval <= 380) return "yearly";
  return "irregular";
}

function spanFor(frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return 7;
    case "yearly":
      return 365;
    default:
      return 30;
  }
}

function detectDuplicates(transactions: Transaction[], asOf: string): Opportunity[] {
  const posted = transactions
    .filter((transaction) => transaction.direction === "debit" && transaction.status === "posted")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const used = new Set<string>();
  const opportunities: Opportunity[] = [];
  for (let leftIndex = 0; leftIndex < posted.length; leftIndex += 1) {
    const left = posted[leftIndex];
    if (used.has(left.id) || REPEAT_PURCHASE_CATEGORIES.has(left.category)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < posted.length; rightIndex += 1) {
      const right = posted[rightIndex];
      if (used.has(right.id) || right.merchantId !== left.merchantId) continue;
      if (!moneyEqual(left.amount, right.amount)) continue;
      if (minutesBetween(left.occurredAt, right.occurredAt) > 36 * 60) continue;
      if (!left.reference || !right.reference || left.reference !== right.reference) continue;
      used.add(left.id);
      used.add(right.id);
      const minutes = Math.round(minutesBetween(left.occurredAt, right.occurredAt));
      const fingerprint = `duplicate_charge:${left.merchantId}:${[left.id, right.id].sort().join("+")}`;
      opportunities.push(
        makeOpportunity({
          type: "duplicate_charge",
          merchantId: left.merchantId,
          merchantName: left.merchantName,
          amountEstimate: left.amount,
          confidence: "high",
          status: "needs_review",
          fingerprint,
          asOf,
          deadline: addDays(right.occurredAt, 60),
          transactionIds: [left.id, right.id],
          detectionReason: `Two posted charges for ${usd(left.amount)} at ${left.merchantName} share reference ${left.reference} and are ${minutes} minutes apart. Authorizations, tips, and separate order numbers are not treated as duplicates.`,
          evidence: [
            transactionEvidence(left, asOf),
            transactionEvidence(right, asOf),
            {
              id: `${fingerprint}-ref`,
              sourceType: "transaction",
              summary: `Both posted charges use reference ${left.reference}.`,
              recordedAt: asOf,
            },
          ],
        }),
      );
      break;
    }
  }
  return opportunities;
}

function detectPostCancellation(streams: RecurringStream[], transactions: Transaction[], asOf: string): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const stream of streams) {
    if (!stream.cancellation) continue;
    const charges = transactions.filter((transaction) => {
      if (transaction.merchantId !== stream.merchantId || transaction.direction !== "debit" || transaction.status !== "posted") {
        return false;
      }
      if (dateOnly(transaction.occurredAt) <= stream.cancellation!.effectiveOn) return false;
      const delta = Math.abs(cents(transaction.amount) - cents(stream.expectedAmount));
      return delta <= Math.max(100, Math.round(cents(stream.expectedAmount) * 0.2));
    });
    for (const charge of charges) {
      const confirmation = stream.cancellation.confirmation;
      const fingerprint = `post_cancellation_charge:${stream.merchantId}:${charge.id}`;
      opportunities.push(
        makeOpportunity({
          type: "post_cancellation_charge",
          merchantId: stream.merchantId,
          merchantName: stream.merchantName,
          amountEstimate: charge.amount,
          confidence: confirmation ? "high" : "medium",
          status: "eligible",
          fingerprint,
          asOf,
          deadline: addDays(charge.occurredAt, 60),
          transactionIds: [charge.id],
          detectionReason: confirmation
            ? `You recorded a cancellation effective ${pretty(stream.cancellation.effectiveOn)} (confirmation ${confirmation}). A ${usd(charge.amount)} charge posted on ${pretty(charge.occurredAt)}, after that date.`
            : `You recorded a cancellation effective ${pretty(stream.cancellation.effectiveOn)}, without a confirmation number. A ${usd(charge.amount)} charge posted on ${pretty(charge.occurredAt)}, after that date.`,
          evidence: [
            {
              id: `${fingerprint}-cancel`,
              sourceType: "user_statement",
              summary: confirmation
                ? `Cancellation effective ${pretty(stream.cancellation.effectiveOn)}. Confirmation ${confirmation}.`
                : `Cancellation effective ${pretty(stream.cancellation.effectiveOn)}. No confirmation number was recorded.`,
              recordedAt: stream.cancellation.recordedAt,
            },
            transactionEvidence(charge, asOf),
          ],
        }),
      );
    }
  }
  return opportunities;
}

function detectMissingRefunds(promises: RefundPromise[], transactions: Transaction[], asOf: string): Opportunity[] {
  return promises.flatMap((promise) => {
    const credit = transactions.find(
      (transaction) =>
        transaction.merchantId === promise.merchantId &&
        transaction.direction === "credit" &&
        transaction.status === "posted" &&
        dateOnly(transaction.occurredAt) >= promise.promisedOn &&
        moneyEqual(transaction.amount, promise.amount, 50),
    );
    if (credit) return [];
    if (businessDaysBetween(promise.promisedOn, asOf) < 10) return [];
    const charge = transactions.find((transaction) => transaction.id === promise.transactionId) ?? null;
    const fingerprint = `missing_refund:${promise.merchantId}:${promise.id}`;
    return [
      makeOpportunity({
        type: "missing_refund",
        merchantId: promise.merchantId,
        merchantName: promise.merchantName,
        amountEstimate: promise.amount,
        confidence: "high",
        status: "action_required",
        fingerprint,
        asOf,
        deadline: null,
        transactionIds: charge ? [charge.id] : [],
        detectionReason: `You saved a merchant message promising a ${usd(promise.amount)} refund on ${pretty(promise.promisedOn)}. No matching credit has posted, and the expected processing window has passed. The promise is only as strong as the message you saved.`,
        evidence: [
          {
            id: `${fingerprint}-msg`,
            sourceType: "merchant_message",
            summary: promise.note,
            recordedAt: promise.promisedOn,
          },
          ...(charge ? [transactionEvidence(charge, asOf)] : []),
        ],
      }),
    ];
  });
}

function detectPriceGaps(claims: PriceClaim[], transactions: Transaction[], asOf: string): Opportunity[] {
  return claims.flatMap((claim) => {
    const transaction = transactions.find((item) => item.id === claim.transactionId);
    if (!transaction || transaction.status !== "posted" || transaction.direction !== "debit") return [];
    const gap = fromCents(cents(transaction.amount) - cents(claim.receiptTotal));
    if (gap < 1) return [];
    const fingerprint = `price_discrepancy:${transaction.merchantId}:${claim.id}`;
    return [
      makeOpportunity({
        type: "price_discrepancy",
        merchantId: transaction.merchantId,
        merchantName: transaction.merchantName,
        amountEstimate: gap,
        confidence: "medium",
        status: "needs_review",
        fingerprint,
        asOf,
        deadline: addDays(transaction.occurredAt, 45),
        transactionIds: [transaction.id],
        detectionReason: `The settled charge is ${usd(transaction.amount)} and the receipt total on file is ${usd(claim.receiptTotal)}. The ${usd(gap)} gap is unverified until tax, shipping, and extra items are ruled out.`,
        evidence: [
          transactionEvidence(transaction, asOf),
          {
            id: `${fingerprint}-receipt`,
            sourceType: "receipt",
            summary: claim.note || `Receipt total recorded as ${usd(claim.receiptTotal)}.`,
            recordedAt: asOf,
          },
        ],
      }),
    ];
  });
}

function detectUnwanted(streams: RecurringStream[], asOf: string): Opportunity[] {
  return streams.flatMap((stream) => {
    if (stream.userPreference !== "unwanted" || stream.cancellation || stream.frequency === "irregular") return [];
    const fingerprint = `unwanted_subscription:${stream.merchantId}:${stream.id}`;
    return [
      makeOpportunity({
        type: "unwanted_subscription",
        merchantId: stream.merchantId,
        merchantName: stream.merchantName,
        amountEstimate: stream.expectedAmount,
        confidence: stream.confidence >= 0.8 ? "high" : "medium",
        status: "needs_review",
        fingerprint,
        asOf,
        deadline: stream.nextWindowEnd,
        transactionIds: stream.transactionIds.slice(-3),
        detectionReason: `You marked this ${stream.frequency} ${usd(stream.expectedAmount)} charge as unwanted. That is a cancellation lead, not a refund, and it is not counted as recovered money.`,
        evidence: [
          {
            id: `${fingerprint}-pref`,
            sourceType: "user_statement",
            summary: `Marked unwanted. Last charge ${pretty(stream.lastChargeAt)}. Next window ${pretty(stream.nextWindowStart)}–${pretty(stream.nextWindowEnd)}.`,
            recordedAt: asOf,
          },
        ],
      }),
    ];
  });
}

function applyHistoricalCredits(opportunities: Opportunity[], transactions: Transaction[], asOf: string): void {
  for (const opportunity of opportunities) {
    if (opportunity.type !== "duplicate_charge" || opportunity.creditMatchRejected) continue;
    if (opportunity.status !== "needs_review" && opportunity.status !== "recovered") continue;
    const credit = matchingCredit(opportunity, transactions);
    if (!credit) continue;
    opportunity.status = "recovered";
    opportunity.evidence = dedupeEvidence([
      ...opportunity.evidence,
      {
        id: `${opportunity.fingerprint}-credit`,
        sourceType: "account_credit",
        summary: `A ${usd(credit.amount)} credit posted on ${pretty(credit.occurredAt)}.`,
        transactionId: credit.id,
        recordedAt: asOf,
      },
    ]);
  }
}

export function matchingCredit(opportunity: Opportunity, transactions: Transaction[]): Transaction | null {
  const debits = transactions.filter((transaction) => opportunity.transactionIds.includes(transaction.id));
  const latest = debits.map((transaction) => transaction.occurredAt).sort().at(-1);
  if (!latest) return null;
  return (
    transactions.find(
      (transaction) =>
        transaction.direction === "credit" &&
        transaction.status === "posted" &&
        transaction.merchantId === opportunity.merchantId &&
        transaction.occurredAt > latest &&
        moneyEqual(transaction.amount, opportunity.amountEstimate, 50),
    ) ?? null
  );
}

function rebuildLedger(
  kept: SavingsEntry[],
  streams: RecurringStream[],
  opportunities: Opportunity[],
  transactions: Transaction[],
  asOf: string,
): SavingsEntry[] {
  const preserved = kept.filter((entry) => entry.type === "verified_recovery" || entry.type === "pending_recovery");
  const generated: SavingsEntry[] = [];
  for (const stream of streams) {
    if (!stream.cancellation || stream.frequency === "irregular") continue;
    const chargedAfter = transactions.some(
      (transaction) =>
        transaction.merchantId === stream.merchantId &&
        transaction.direction === "debit" &&
        transaction.status === "posted" &&
        dateOnly(transaction.occurredAt) > stream.cancellation!.effectiveOn &&
        Math.abs(cents(transaction.amount) - cents(stream.expectedAmount)) <= Math.max(100, Math.round(cents(stream.expectedAmount) * 0.2)),
    );
    if (!chargedAfter) {
      const projected = annualized(stream.expectedAmount, stream.frequency);
      if (projected > 0) {
        generated.push({
          id: `savings_projected_${stream.id}`,
          caseId: null,
          opportunityId: null,
          streamId: stream.id,
          amount: projected,
          type: "projected_savings",
          verificationSource: "Recorded cancellation, with no later matching charge",
          verifiedAt: null,
          note: `${stream.merchantName} projected annual savings if the cancellation holds.`,
        });
      }
      const realized = realizedSavings(stream, transactions, asOf);
      if (realized > 0) {
        generated.push({
          id: `savings_realized_${stream.id}`,
          caseId: null,
          opportunityId: null,
          streamId: stream.id,
          amount: realized,
          type: "realized_savings",
          verificationSource: "Expected charge did not post after cancellation",
          verifiedAt: asOf,
          note: `${stream.merchantName} skipped ${usd(realized)} that had been recurring.`,
        });
      }
    }
  }
  for (const opportunity of opportunities) {
    if (opportunity.status !== "recovered") continue;
    if (preserved.some((entry) => entry.type === "verified_recovery" && entry.opportunityId === opportunity.id)) continue;
    const credit = matchingCredit(opportunity, transactions);
    if (!credit) continue;
    preserved.push({
      id: `savings_verified_${opportunity.id}`,
      caseId: null,
      opportunityId: opportunity.id,
      streamId: null,
      amount: opportunity.amountEstimate,
      type: "verified_recovery",
      verificationSource: "Matching posted credit",
      verifiedAt: credit.postedAt ?? credit.occurredAt,
      note: `${opportunity.merchantName} credit matched the disputed amount.`,
    });
  }
  return [...preserved, ...generated];
}

function realizedSavings(stream: RecurringStream, transactions: Transaction[], asOf: string): number {
  if (!stream.cancellation) return 0;
  const span = spanFor(stream.frequency);
  let expected = addDays(stream.lastChargeAt, span);
  let missed = 0;
  while (expected <= dateOnly(asOf) && missed < 12) {
    if (expected > stream.cancellation.effectiveOn) {
      const hit = transactions.some(
        (transaction) =>
          transaction.merchantId === stream.merchantId &&
          transaction.direction === "debit" &&
          transaction.status === "posted" &&
          Math.abs(daysBetween(expected, transaction.occurredAt)) <= 4,
      );
      if (!hit) missed += 1;
    }
    expected = addDays(expected, span);
  }
  return roundMoney(stream.expectedAmount * missed);
}

function mergeOpportunities(previous: Opportunity[], detected: Opportunity[]): Opportunity[] {
  const prior = new Map(previous.map((opportunity) => [opportunity.fingerprint, opportunity]));
  const merged = detected.map((opportunity) => {
    const old = prior.get(opportunity.fingerprint);
    if (!old) return opportunity;
    return {
      ...opportunity,
      id: old.id,
      status: old.status,
      createdAt: old.createdAt,
      dismissedReason: old.dismissedReason,
      creditMatchRejected: old.creditMatchRejected,
      evidence: opportunity.evidence,
    };
  });
  const fingerprints = new Set(merged.map((opportunity) => opportunity.fingerprint));
  for (const opportunity of previous) {
    if (fingerprints.has(opportunity.fingerprint)) continue;
    if (opportunity.status === "closed" || opportunity.status === "recovered" || opportunity.status === "unsuccessful" || opportunity.status === "in_progress") {
      merged.push(opportunity);
    }
  }
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.merchantName.localeCompare(b.merchantName));
}

function makeOpportunity(input: {
  type: Opportunity["type"];
  merchantId: string;
  merchantName: string;
  amountEstimate: number;
  confidence: Opportunity["confidence"];
  status: OpportunityStatus;
  fingerprint: string;
  asOf: string;
  deadline: string | null;
  transactionIds: string[];
  detectionReason: string;
  evidence: Evidence[];
}): Opportunity {
  return {
    id: stableId("opp", input.fingerprint),
    type: input.type,
    merchantId: input.merchantId,
    merchantName: input.merchantName,
    amountEstimate: roundMoney(input.amountEstimate),
    confidence: input.confidence,
    detectionReason: input.detectionReason,
    status: input.status,
    deadline: input.deadline,
    evidence: input.evidence,
    transactionIds: input.transactionIds,
    fingerprint: input.fingerprint,
    createdAt: input.asOf,
  };
}

function transactionEvidence(transaction: Transaction, asOf: string): Evidence {
  const when = transaction.postedAt ?? transaction.occurredAt;
  return {
    id: `ev_${transaction.id}`,
    sourceType: "transaction",
    summary: `${transaction.status === "pending" ? "Pending" : "Posted"} ${transaction.direction} of ${usd(transaction.amount)} on ${pretty(when)}${transaction.reference ? `, reference ${transaction.reference}` : ""}.`,
    transactionId: transaction.id,
    recordedAt: asOf,
  };
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function dedupeEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function pretty(iso: string): string {
  return new Date(`${dateOnly(iso)}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function usd(amount: number): string {
  return roundMoney(amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
