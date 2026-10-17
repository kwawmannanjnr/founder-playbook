import { analyze } from "./analyze";
import { buildDraft, questionsFor } from "./draft";
import type { AppState, FinancialConnection, Profile, RecoveryCase, Transaction, TransactionCategory } from "./model";
import { DEMO_AS_OF, emptyState, normalizeMerchant } from "./model";

type SampleMode = "preview_bank" | "sample_file";

const CONNECTION_ID = "conn_sample";

export function buildSampleState(mode: SampleMode, phase: AppState["phase"], profile: Profile | null = null): AppState {
  const connection = connectionFor(mode);
  const transactions = sampleTransactions();
  const refundPromises = [
    {
      id: "promise_aero",
      merchantName: "AeroSupply",
      merchantId: normalizeMerchant("AeroSupply").merchantId,
      amount: 48,
      promisedOn: "2026-03-05",
      note: "Chat with Priya on March 5: a $48 refund would be issued in 5–7 business days.",
      transactionId: "tx_aero",
    },
  ];
  const priceClaims = [
    {
      id: "claim_bright",
      transactionId: "tx_bright",
      receiptTotal: 128.99,
      note: "Receipt total $128.99 saved from the BrightHome order email. Tax and shipping still need to be confirmed.",
    },
  ];
  const analysis = analyze({
    transactions,
    refundPromises,
    priceClaims,
    annotations: [
      { merchantId: idOf("Peak Fitness"), preference: "unwanted", cancellation: cancel("2026-03-01", "PF-44192") },
      { merchantId: idOf("Lumen"), preference: "unwanted", cancellation: cancel("2026-02-28", "LM-2291") },
      { merchantId: idOf("Harbor Radio"), preference: "unwanted", cancellation: cancel("2026-04-01", "HR-88") },
      { merchantId: idOf("FitLoop"), preference: "unknown" },
      { merchantId: idOf("Reelhouse"), preference: "wanted" },
      { merchantId: idOf("Northline Internet"), preference: "essential" },
      { merchantId: idOf("Oak Rentals"), preference: "essential" },
      { merchantId: idOf("City Power"), preference: "essential" },
    ],
    asOf: DEMO_AS_OF,
  });

  const peak = analysis.opportunities.find((item) => item.fingerprint.startsWith("post_cancellation_charge:peak-fitness"));
  const bright = analysis.opportunities.find((item) => item.type === "price_discrepancy");
  const opportunities = analysis.opportunities.map((opportunity) => {
    if (opportunity.id === peak?.id || opportunity.id === bright?.id) return { ...opportunity, status: "in_progress" as const };
    return opportunity;
  });

  const draftingState: AppState = {
    ...emptyState(),
    profile: profile ?? { name: "Jordan Lee", email: "jordan.lee@example.com", createdAt: DEMO_AS_OF },
    connections: [connection],
    transactions,
    refundPromises,
    priceClaims,
    streams: analysis.streams,
    opportunities,
    ledger: analysis.ledger,
    asOf: DEMO_AS_OF,
  };

  const cases: RecoveryCase[] = [];
  if (peak) cases.push(seedCase(draftingState, peak.id, 104, "billing@peakfitness.example", "2026-04-08T15:00:00.000Z", "2026-04-14"));
  if (bright) cases.push(seedCase(draftingState, bright.id, 105, "support@brighthome.example", "2026-04-10T15:00:00.000Z", "2026-04-20"));

  const brightCase = cases.find((item) => item.caseNumber === 105);
  const ledger = [...analysis.ledger];
  if (bright && brightCase) {
    ledger.push({
      id: "savings_pending_bright",
      caseId: brightCase.id,
      opportunityId: bright.id,
      streamId: null,
      amount: bright.amountEstimate,
      type: "pending_recovery",
      verificationSource: "Merchant confirmation, credit not yet posted",
      verifiedAt: null,
      note: "You recorded that BrightHome said a refund was approved. It is not verified until the credit posts or you confirm the money arrived.",
    });
    brightCase.timeline.push({
      id: "tl_105_merchant",
      actor: "user",
      action: "Recorded a merchant reply",
      detail: "You noted a BrightHome reply that the refund was approved. No matching credit is on the statement, so this stays pending.",
      at: "2026-04-12T15:00:00.000Z",
    });
  }

  return {
    ...draftingState,
    profile,
    phase,
    sampleHousehold: true,
    opportunities,
    cases,
    ledger,
    nextCaseNumber: 106,
    actions: [
      {
        id: "act_import",
        caseId: null,
        actor: "system",
        action: "Imported transactions",
        detail: `${transactions.length} transactions imported from ${connection.institutionName}. Pending and posted charges were kept distinct.`,
        approvalId: null,
        at: DEMO_AS_OF,
        outcome: "Imported",
      },
      {
        id: "act_scan",
        caseId: null,
        actor: "system",
        action: "Completed scan",
        detail: "Recurring charges, duplicate candidates, and refund leads were saved with their evidence.",
        approvalId: null,
        at: DEMO_AS_OF,
        outcome: "Scan complete",
      },
    ],
  };
}

function seedCase(
  state: AppState,
  opportunityId: string,
  caseNumber: number,
  recipient: string,
  submittedAt: string,
  nextActionAt: string,
): RecoveryCase {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw new Error(`Missing sample opportunity ${opportunityId}`);
  const recoveryCase: RecoveryCase = {
    id: `case_${caseNumber}`,
    caseNumber,
    opportunityId,
    status: "monitoring",
    questions: questionsFor(opportunity, state).map((question) => ({
      ...question,
      answer:
        question.id === "cancellation_date"
          ? "2026-03-01"
          : question.id === "cancellation_confirmation"
            ? "PF-44192"
            : question.id === "receipt_scope"
              ? "includes_all"
              : question.answer,
    })),
    recipient,
    draft: null,
    draftCounted: true,
    followUp: null,
    timeline: [
      {
        id: `tl_${caseNumber}_open`,
        actor: "user",
        action: "Opened a recovery case",
        detail: "You asked MoneyBack to prepare a request from the evidence on file.",
        at: submittedAt,
      },
      {
        id: `tl_${caseNumber}_approve`,
        actor: "user",
        action: "Approved the draft",
        detail: "You confirmed the wording matched the facts. Approval does not send the message.",
        at: submittedAt,
        approvalId: `appr_${caseNumber}`,
      },
      {
        id: `tl_${caseNumber}_sent`,
        actor: "user",
        action: "Marked the request sent",
        detail: "You recorded that you sent the approved message yourself.",
        at: submittedAt,
      },
    ],
    submittedAt,
    resolvedAt: null,
    approvalId: `appr_${caseNumber}`,
    nextActionAt,
  };
  return { ...recoveryCase, draft: buildDraft(state, recoveryCase, submittedAt) };
}

function connectionFor(mode: SampleMode): FinancialConnection {
  if (mode === "preview_bank") {
    return {
      id: CONNECTION_ID,
      provider: "plaid_preview",
      institutionName: "First Harbor Bank",
      accountMask: "4821",
      scope: "Transactions, read only",
      lastSyncAt: DEMO_AS_OF,
      status: "healthy",
      createdAt: DEMO_AS_OF,
    };
  }
  return {
    id: CONNECTION_ID,
    provider: "sample",
    institutionName: "Sample statement",
    accountMask: "4821",
    scope: "One-time file import",
    lastSyncAt: DEMO_AS_OF,
    status: "healthy",
    createdAt: DEMO_AS_OF,
  };
}

function cancel(effectiveOn: string, confirmation: string) {
  return { effectiveOn, confirmation, recordedAt: DEMO_AS_OF };
}

function idOf(name: string): string {
  return normalizeMerchant(name).merchantId;
}

function sampleTransactions(): Transaction[] {
  const rows: Transaction[] = [
    ...monthly("tx_peak", "Peak Fitness", 49, "fitness", ["2025-11-18", "2025-12-18", "2026-01-18", "2026-02-18", "2026-03-18"]),
    charge({ id: "tx_nord_auth", merchant: "Nordstrom", amount: 32, category: "shopping", on: "2026-04-02T14:01:00.000Z", status: "pending", reference: "ORD-18421" }),
    charge({ id: "tx_nord_a", merchant: "Nordstrom", amount: 32, category: "shopping", on: "2026-04-02T14:02:00.000Z", reference: "ORD-18421", settlesAuthorizationId: "tx_nord_auth" }),
    charge({ id: "tx_nord_b", merchant: "Nordstrom", amount: 32, category: "shopping", on: "2026-04-02T14:06:00.000Z", reference: "ORD-18421" }),
    ...monthly("tx_lumen", "Lumen", 24.99, "subscription", ["2025-12-20", "2026-01-20", "2026-02-20", "2026-03-20"]),
    charge({ id: "tx_aero", merchant: "AeroSupply", amount: 48, category: "shopping", on: "2026-03-01", reference: "AE-3390" }),
    charge({ id: "tx_bright", merchant: "BrightHome", amount: 162.42, category: "electronics", on: "2026-04-01", reference: "BH-552" }),
    charge({ id: "tx_cloud_a", merchant: "Cloudbox", amount: 35, category: "shopping", on: "2026-01-09T16:00:00.000Z", reference: "CB-1008" }),
    charge({ id: "tx_cloud_b", merchant: "Cloudbox", amount: 35, category: "shopping", on: "2026-01-09T16:04:00.000Z", reference: "CB-1008" }),
    credit({ id: "tx_cloud_credit", merchant: "Cloudbox", amount: 35, category: "shopping", on: "2026-01-21", reference: "CB-1008-R" }),
    ...monthly("tx_harbor", "Harbor Radio", 12, "subscription", ["2025-12-12", "2026-01-12", "2026-02-12", "2026-03-12"]),
    ...monthly("tx_fit", "FitLoop", 12, "subscription", ["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05"]),
    ...monthly("tx_reel", "Reelhouse", 15.99, "subscription", ["2025-12-08", "2026-01-08", "2026-02-08", "2026-03-08", "2026-04-08"]),
    ...monthly("tx_net", "Northline Internet", 79.99, "utilities", ["2025-12-02", "2026-01-02", "2026-02-02", "2026-03-02", "2026-04-02"]),
    ...monthly("tx_rent", "Oak Rentals", 1850, "housing", ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]),
    charge({ id: "tx_power_1", merchant: "City Power", amount: 61.2, category: "utilities", on: "2026-01-14" }),
    charge({ id: "tx_power_2", merchant: "City Power", amount: 74.1, category: "utilities", on: "2026-02-14" }),
    charge({ id: "tx_power_3", merchant: "City Power", amount: 58.4, category: "utilities", on: "2026-03-14" }),
    charge({ id: "tx_power_4", merchant: "City Power", amount: 69.55, category: "utilities", on: "2026-04-14" }),
    charge({ id: "tx_hearth_auth", merchant: "Hearth Restaurant", amount: 42, category: "restaurant", on: "2026-04-10T18:00:00.000Z", status: "pending", reference: "AUTH-9" }),
    charge({ id: "tx_hearth", merchant: "Hearth Restaurant", amount: 51.8, category: "restaurant", on: "2026-04-10T18:40:00.000Z", reference: "TICKET-9", settlesAuthorizationId: "tx_hearth_auth" }),
    charge({ id: "tx_bb_1", merchant: "Blue Bottle", amount: 6.5, category: "restaurant", on: "2026-04-08T15:00:00.000Z", reference: "BB-1" }),
    charge({ id: "tx_bb_2", merchant: "Blue Bottle", amount: 6.5, category: "restaurant", on: "2026-04-08T15:10:00.000Z", reference: "BB-2" }),
    charge({ id: "tx_gro_1", merchant: "Green Grocer", amount: 54.12, category: "groceries", on: "2026-04-03", reference: "GG-1" }),
    charge({ id: "tx_gro_2", merchant: "Green Grocer", amount: 54.12, category: "groceries", on: "2026-04-04", reference: "GG-2" }),
    charge({ id: "tx_parcel_1", merchant: "Parcel & Co", amount: 80, category: "shopping", on: "2026-04-05", reference: "SHP-1" }),
    charge({ id: "tx_parcel_2", merchant: "Parcel & Co", amount: 45, category: "shopping", on: "2026-04-05", reference: "SHP-2" }),
    charge({ id: "tx_field_1", merchant: "Field Goods", amount: 22, category: "shopping", on: "2026-04-11T13:00:00.000Z", reference: "FG-1" }),
    charge({ id: "tx_field_2", merchant: "Field Goods", amount: 22, category: "shopping", on: "2026-04-11T13:05:00.000Z", reference: "FG-2" }),
  ];
  return rows;
}

function monthly(prefix: string, merchant: string, amount: number, category: TransactionCategory, dates: string[]): Transaction[] {
  return dates.map((on, index) => charge({ id: `${prefix}_${index + 1}`, merchant, amount, category, on }));
}

function charge(input: {
  id: string;
  merchant: string;
  amount: number;
  category: TransactionCategory;
  on: string;
  status?: "pending" | "posted";
  reference?: string;
  settlesAuthorizationId?: string;
}): Transaction {
  return tx({ ...input, direction: "debit" });
}

function credit(input: {
  id: string;
  merchant: string;
  amount: number;
  category: TransactionCategory;
  on: string;
  reference?: string;
}): Transaction {
  return tx({ ...input, direction: "credit", status: "posted" });
}

function tx(input: {
  id: string;
  merchant: string;
  amount: number;
  category: TransactionCategory;
  on: string;
  direction: "debit" | "credit";
  status?: "pending" | "posted";
  reference?: string;
  settlesAuthorizationId?: string;
}): Transaction {
  const merchant = normalizeMerchant(input.merchant);
  const occurredAt = input.on.length === 10 ? `${input.on}T12:00:00.000Z` : input.on;
  const status = input.status ?? "posted";
  return {
    id: input.id,
    connectionId: CONNECTION_ID,
    externalId: input.id,
    merchantName: input.merchant,
    merchantId: merchant.merchantId,
    amount: input.amount,
    direction: input.direction,
    currency: "USD",
    occurredAt,
    postedAt: status === "posted" ? occurredAt : null,
    status,
    category: input.category,
    reference: input.reference ?? null,
    settlesAuthorizationId: input.settlesAuthorizationId ?? null,
    source: "sample",
  };
}
