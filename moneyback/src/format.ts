import type { ConfidenceLabel, Frequency, OpportunityStatus, OpportunityType, PlanId } from "./model";
import { roundMoney } from "./model";

export function money(amount: number): string {
  return roundMoney(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function moneyCompact(amount: number): string {
  const rounded = roundMoney(amount);
  if (Number.isInteger(rounded)) return `$${rounded.toLocaleString("en-US")}`;
  return money(rounded);
}

export function shortDate(iso: string): string {
  return formatDate(iso, "short");
}

export function longDate(iso: string): string {
  return formatDate(iso, "long");
}

function formatDate(iso: string, month: "short" | "long"): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month,
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabel(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function frequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "Irregular";
  }
}

export function typeLabel(type: OpportunityType): string {
  switch (type) {
    case "duplicate_charge":
      return "Duplicate charge";
    case "unwanted_subscription":
      return "Unwanted subscription";
    case "post_cancellation_charge":
      return "Post-cancellation charge";
    case "missing_refund":
      return "Missing refund";
    case "price_discrepancy":
      return "Price discrepancy";
  }
}

export function statusLabel(status: OpportunityStatus): string {
  switch (status) {
    case "needs_review":
      return "Needs review";
    case "eligible":
      return "Eligible to pursue";
    case "action_required":
      return "Action required";
    case "in_progress":
      return "In progress";
    case "recovered":
      return "Recovered";
    case "unsuccessful":
      return "Unsuccessful";
    case "closed":
      return "Closed";
  }
}

export function confidenceLabel(confidence: ConfidenceLabel): string {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

export function planLabel(plan: PlanId): string {
  switch (plan) {
    case "free":
      return "Free";
    case "plus_monthly":
      return "Plus monthly";
    case "plus_annual":
      return "Plus annual";
  }
}

export function annualized(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return roundMoney(amount * 52);
    case "monthly":
      return roundMoney(amount * 12);
    case "yearly":
      return roundMoney(amount);
    default:
      return 0;
  }
}
