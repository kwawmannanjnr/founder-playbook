import type { AppState, Opportunity, RecoveryCase, RecurringStream } from "./model";
import { isOpenStatus, sumMoney } from "./model";
import { frequencyLabel, money, moneyCompact } from "./format";

export type Metrics = {
  potential: number;
  verified: number;
  pending: number;
  projected: number;
  realized: number;
};

export function metricsOf(state: AppState): Metrics {
  const verifiedByOpportunity = new Map<string, number>();
  for (const entry of state.ledger) {
    if (entry.type !== "verified_recovery" || !entry.opportunityId) continue;
    verifiedByOpportunity.set(entry.opportunityId, sumMoney([verifiedByOpportunity.get(entry.opportunityId) ?? 0, entry.amount]));
  }
  const potential = sumMoney(
    state.opportunities.filter((opportunity) => isOpenStatus(opportunity.status)).map((opportunity) => {
      const already = verifiedByOpportunity.get(opportunity.id) ?? 0;
      return Math.max(0, sumMoney([opportunity.amountEstimate, -already]));
    }),
  );
  return {
    potential,
    verified: sumMoney(state.ledger.filter((entry) => entry.type === "verified_recovery").map((entry) => entry.amount)),
    pending: sumMoney(state.ledger.filter((entry) => entry.type === "pending_recovery").map((entry) => entry.amount)),
    projected: sumMoney(state.ledger.filter((entry) => entry.type === "projected_savings").map((entry) => entry.amount)),
    realized: sumMoney(state.ledger.filter((entry) => entry.type === "realized_savings").map((entry) => entry.amount)),
  };
}

export type Attention = {
  id: string;
  title: string;
  detail: string;
  href: "/subscriptions" | `/opportunity/${string}`;
  opportunityId?: string;
};

export function attentionItems(state: AppState): Attention[] {
  const items: Attention[] = [];
  const duplicate = state.opportunities.find((opportunity) => opportunity.type === "duplicate_charge" && opportunity.status === "needs_review");
  if (duplicate) {
    items.push({
      id: duplicate.id,
      title: `Duplicate ${moneyCompact(duplicate.amountEstimate)} charge`,
      detail: "Review",
      href: `/opportunity/${duplicate.id}`,
      opportunityId: duplicate.id,
    });
  }
  const unknown = [...state.streams]
    .filter((stream) => stream.userPreference === "unknown" && stream.frequency !== "irregular")
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (unknown) {
    items.push({
      id: unknown.id,
      title: `Subscription ${moneyCompact(unknown.expectedAmount)}${unknown.frequency === "monthly" ? "/month" : ` ${frequencyLabel(unknown.frequency).toLowerCase()}`}`,
      detail: "Keep or cancel",
      href: "/subscriptions",
    });
  }
  const missing = state.opportunities.find((opportunity) => opportunity.type === "missing_refund" && isOpenStatus(opportunity.status));
  if (missing) {
    items.push({
      id: missing.id,
      title: `Missing ${moneyCompact(missing.amountEstimate)} refund`,
      detail: "Follow up",
      href: `/opportunity/${missing.id}`,
      opportunityId: missing.id,
    });
  }
  return items.slice(0, 3);
}

export type InboxItem = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  opportunityId?: string;
  caseId?: string;
};

export function inboxItems(state: AppState, today = new Date().toISOString().slice(0, 10)): InboxItem[] {
  const items: InboxItem[] = [];
  for (const recoveryCase of state.cases) {
    const opportunity = state.opportunities.find((item) => item.id === recoveryCase.opportunityId);
    if (!opportunity) continue;
    if (recoveryCase.status === "monitoring" && recoveryCase.nextActionAt && recoveryCase.nextActionAt <= today && !recoveryCase.followUp?.sentAt) {
      items.push({
        id: `follow-${recoveryCase.id}`,
        eyebrow: `Case #${recoveryCase.caseNumber}`,
        title: "No merchant reply is on file",
        detail: `A follow-up can be drafted for the ${money(opportunity.amountEstimate)} ${opportunity.merchantName} request. Sending still needs your approval.`,
        caseId: recoveryCase.id,
      });
    }
    if (recoveryCase.status === "evidence_review" || recoveryCase.status === "user_confirmation" || (recoveryCase.status === "awaiting_approval" && !recoveryCase.approvalId)) {
      items.push({
        id: `needs-${recoveryCase.id}`,
        eyebrow: `Case #${recoveryCase.caseNumber}`,
        title: recoveryCase.draft ? "Draft waiting for approval" : "A case needs a fact from you",
        detail: opportunity.merchantName,
        caseId: recoveryCase.id,
      });
    }
  }
  for (const opportunity of state.opportunities) {
    if (opportunity.type === "post_cancellation_charge" && opportunity.status === "eligible") {
      items.push({
        id: `alert-${opportunity.id}`,
        eyebrow: "New activity",
        title: `Your subscription may have charged you again after cancellation. Review this ${money(opportunity.amountEstimate)} payment.`,
        detail: opportunity.merchantName,
        opportunityId: opportunity.id,
      });
    }
  }
  return items;
}

export function sortedOpportunities(state: AppState): Opportunity[] {
  const rank: Record<Opportunity["status"], number> = {
    action_required: 0,
    needs_review: 1,
    eligible: 2,
    in_progress: 3,
    recovered: 4,
    unsuccessful: 5,
    closed: 6,
  };
  return [...state.opportunities].sort((a, b) => rank[a.status] - rank[b.status] || b.amountEstimate - a.amountEstimate);
}

export function workingCases(state: AppState): Array<{ recoveryCase: RecoveryCase; opportunity: Opportunity }> {
  return state.cases
    .filter((recoveryCase) => recoveryCase.status === "monitoring" || recoveryCase.status === "awaiting_approval")
    .map((recoveryCase) => {
      const opportunity = state.opportunities.find((item) => item.id === recoveryCase.opportunityId);
      return opportunity ? { recoveryCase, opportunity } : null;
    })
    .filter((item): item is { recoveryCase: RecoveryCase; opportunity: Opportunity } => Boolean(item));
}

export function caseHeadline(recoveryCase: RecoveryCase, opportunity: Opportunity): string {
  if (recoveryCase.status === "monitoring" && opportunity.type === "price_discrepancy") return "Refund pending verification";
  if (recoveryCase.status === "monitoring") return "Waiting for merchant response";
  if (recoveryCase.status === "verified") return "Refund verified";
  if (recoveryCase.status === "awaiting_approval") return "Draft waiting for your approval";
  return "In progress";
}

export function unknownSubscriptions(streams: RecurringStream[]): RecurringStream[] {
  return streams.filter((stream) => stream.userPreference === "unknown");
}
