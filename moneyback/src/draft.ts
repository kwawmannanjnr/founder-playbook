import type { AppState, CaseQuestion, Opportunity, RecoveryCase, RecoveryDraft, Transaction } from "./model";
import { dateOnly } from "./model";
import { longDate, money } from "./format";

export function questionsFor(opportunity: Opportunity, state: AppState): CaseQuestion[] {
  const stream = state.streams.find((item) => item.merchantId === opportunity.merchantId);
  switch (opportunity.type) {
    case "duplicate_charge":
      return [
        {
          id: "authorize_both",
          prompt: "Did you authorize both charges?",
          helper: "A draft is created only if you confirm that one of them was not intended.",
          required: true,
          answer: null,
          options: [
            { value: "only_one", label: "I only authorized one" },
            { value: "both", label: "Both were intentional" },
            { value: "unsure", label: "I am not sure" },
          ],
        },
      ];
    case "post_cancellation_charge":
      return [
        {
          id: "cancellation_date",
          prompt: "What is the effective cancellation date?",
          helper: "This stays blank unless you supply it. MoneyBack will not invent one.",
          required: true,
          answer: stream?.cancellation?.effectiveOn ?? null,
          input: "date",
        },
        {
          id: "cancellation_confirmation",
          prompt: "Cancellation confirmation, if you have one",
          helper: "Leave this blank if you do not have a number. The draft will say that.",
          required: false,
          answer: stream?.cancellation?.confirmation ?? null,
          input: "text",
        },
      ];
    case "missing_refund":
      return [
        {
          id: "promise_accurate",
          prompt: "Is the saved refund promise accurate?",
          helper: opportunity.evidence.find((item) => item.sourceType === "merchant_message")?.summary,
          required: true,
          answer: null,
          options: [
            { value: "yes", label: "Yes, that promise is accurate" },
            { value: "no", label: "No, withdraw this" },
          ],
        },
      ];
    case "price_discrepancy":
      return [
        {
          id: "receipt_scope",
          prompt: "Does the receipt total already include tax and shipping?",
          required: true,
          answer: null,
          options: [
            { value: "includes_all", label: "Yes, tax and shipping are included" },
            { value: "unsure", label: "I am not sure" },
          ],
        },
      ];
    case "unwanted_subscription":
      return [
        {
          id: "stop_subscription",
          prompt: `Do you want a cancellation request for ${opportunity.merchantName}?`,
          helper: "This drafts a message. It does not cancel the service.",
          required: true,
          answer: null,
          options: [
            { value: "yes", label: "Yes, draft a cancellation request" },
            { value: "no", label: "Not now" },
          ],
        },
      ];
  }
}

export function requiredAnswersReady(questions: CaseQuestion[]): boolean {
  return questions.every((question) => !question.required || (question.answer && question.answer.trim().length > 0));
}

export function answerClosesCase(questionId: string, answer: string): boolean {
  return (
    (questionId === "authorize_both" && answer === "both") ||
    (questionId === "promise_accurate" && answer === "no") ||
    (questionId === "stop_subscription" && answer === "no")
  );
}

export function buildDraft(state: AppState, recoveryCase: RecoveryCase, now: string): RecoveryDraft | null {
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase.opportunityId);
  if (!opportunity || !requiredAnswersReady(recoveryCase.questions)) return null;
  if (recoveryCase.questions.some((question) => question.answer && answerClosesCase(question.id, question.answer))) return null;
  const answers = Object.fromEntries(recoveryCase.questions.map((question) => [question.id, question.answer?.trim() ?? ""]));
  const profileName = state.profile?.name || "Account holder";
  const profileEmail = state.profile?.email || "Email not on file";
  const txs = opportunity.transactionIds
    .map((id) => state.transactions.find((transaction) => transaction.id === id))
    .filter((transaction): transaction is Transaction => Boolean(transaction));
  const recipient = recoveryCase.recipient.trim();
  const subject = subjectFor(opportunity);
  const body = bodyFor(opportunity, txs, answers, profileName, profileEmail);
  if (!body) return null;
  return {
    id: `draft_${recoveryCase.id}_${now.slice(0, 10)}`,
    recipient,
    subject,
    body,
    createdAt: now,
  };
}

export function buildFollowUp(state: AppState, recoveryCase: RecoveryCase, now: string): RecoveryDraft | null {
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase.opportunityId);
  if (!opportunity || !recoveryCase.draft || !recoveryCase.submittedAt) return null;
  const name = state.profile?.name || "Account holder";
  const body = [
    "Hello,",
    "",
    `I am following up on a billing review I sent on ${longDate(recoveryCase.submittedAt)}.`,
    `Merchant: ${opportunity.merchantName}`,
    `Amount in question: ${money(opportunity.amountEstimate)}`,
    `Subject of the original note: ${recoveryCase.draft.subject}`,
    "",
    "I have not received a reply that resolves this. I am asking for a status update.",
    "I am not adding new claims in this note.",
    "",
    "Thank you,",
    name,
  ].join("\n");
  return {
    id: `follow_${recoveryCase.id}_${now.slice(0, 10)}`,
    recipient: recoveryCase.draft.recipient,
    subject: `Follow-up: ${recoveryCase.draft.subject}`,
    body,
    createdAt: now,
  };
}

function subjectFor(opportunity: Opportunity): string {
  switch (opportunity.type) {
    case "duplicate_charge":
      return `Review of a repeated charge — ${opportunity.merchantName}`;
    case "post_cancellation_charge":
      return `Charge posted after cancellation — ${opportunity.merchantName}`;
    case "missing_refund":
      return `Status of a promised refund — ${opportunity.merchantName}`;
    case "price_discrepancy":
      return `Review of a receipt and settled charge — ${opportunity.merchantName}`;
    case "unwanted_subscription":
      return `Cancellation request — ${opportunity.merchantName}`;
  }
}

function bodyFor(
  opportunity: Opportunity,
  transactions: Transaction[],
  answers: Record<string, string>,
  name: string,
  email: string,
): string | null {
  const lines = ["Hello,", ""];
  if (opportunity.type === "duplicate_charge") {
    if (answers.authorize_both !== "only_one") return null;
    const [first, second] = [...transactions].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (!first || !second) return null;
    lines.push("I am requesting a review of two posted charges that appear to be the same purchase.");
    lines.push("");
    lines.push(`Merchant: ${opportunity.merchantName}`);
    lines.push(`Amount: ${money(first.amount)} each`);
    lines.push(`Posted: ${longDate(first.occurredAt)} and ${longDate(second.occurredAt)}`);
    if (first.reference) lines.push(`Reference on both charges: ${first.reference}`);
    lines.push("");
    lines.push("I authorized one purchase for this amount. I am asking you to refund the repeated charge if these two posted transactions are duplicates.");
  } else if (opportunity.type === "post_cancellation_charge") {
    const charge = transactions[0];
    const effective = answers.cancellation_date;
    if (!charge || !effective || !/^\d{4}-\d{2}-\d{2}$/.test(effective)) return null;
    if (dateOnly(charge.occurredAt) <= effective) return null;
    const confirmation = answers.cancellation_confirmation;
    lines.push(`I am requesting a review of a ${money(charge.amount)} charge that posted after the cancellation date I have on record.`);
    lines.push("");
    lines.push(`Merchant: ${opportunity.merchantName}`);
    lines.push(`Cancellation effective date I recorded: ${longDate(effective)}`);
    if (confirmation) lines.push(`Confirmation I can provide: ${confirmation}`);
    else lines.push("I do not have a confirmation number on file.");
    lines.push(`Charge posted: ${longDate(charge.occurredAt)} for ${money(charge.amount)}`);
    lines.push("");
    lines.push("I am requesting a refund of that charge if the service was already canceled. I am not disputing other charges.");
  } else if (opportunity.type === "missing_refund") {
    if (answers.promise_accurate !== "yes") return null;
    const message = opportunity.evidence.find((item) => item.sourceType === "merchant_message");
    const charge = transactions[0];
    lines.push(`I am asking for the status of a ${money(opportunity.amountEstimate)} refund I was told would be issued.`);
    lines.push("");
    if (message) lines.push(`What I have saved: ${message.summary}`);
    if (charge) lines.push(`Original posted charge: ${money(charge.amount)} on ${longDate(charge.occurredAt)}.`);
    lines.push("I do not see a matching credit in the transactions I imported.");
    lines.push("");
    lines.push("If the refund was not issued, I am asking for it to be sent. If it was sent, I am asking for the date and reference.");
  } else if (opportunity.type === "price_discrepancy") {
    const charge = transactions[0];
    if (!charge) return null;
    const receipt = charge.amount - opportunity.amountEstimate;
    lines.push("I am asking for a review of the difference between a settled charge and a receipt total I saved.");
    lines.push("");
    lines.push(`Merchant: ${opportunity.merchantName}`);
    lines.push(`Settled charge: ${money(charge.amount)} on ${longDate(charge.occurredAt)}`);
    lines.push(`Receipt total on file: ${money(receipt)}`);
    lines.push(`Difference: ${money(opportunity.amountEstimate)}`);
    lines.push("");
    if (answers.receipt_scope === "includes_all") {
      lines.push("The receipt total I saved already includes tax and shipping. I am asking which other item accounts for the difference, and for a correction if I did not agree to another charge.");
    } else {
      lines.push("I am not sure whether the receipt includes tax or shipping. I am not claiming the difference is an error until those items are explained.");
    }
  } else if (opportunity.type === "unwanted_subscription") {
    if (answers.stop_subscription !== "yes") return null;
    const latest = [...transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    lines.push(`Please cancel ${opportunity.merchantName} and confirm the effective date in writing.`);
    lines.push("");
    lines.push(`The recurring charge I see is ${money(opportunity.amountEstimate)}.`);
    if (latest) lines.push(`The most recent charge posted on ${longDate(latest.occurredAt)}.`);
    lines.push("I am not requesting a refund of earlier charges unless they fall after the cancellation you confirm.");
  }
  lines.push("");
  lines.push("This is a request for review, not a statement that a refund has been approved.");
  lines.push("");
  lines.push("Thank you,");
  lines.push(name);
  lines.push(email);
  return lines.join("\n");
}

export function agentNote(state: AppState, recoveryCase: RecoveryCase): string {
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase.opportunityId);
  if (!opportunity) return "This case no longer has an opportunity attached.";
  if (recoveryCase.status === "evidence_review") {
    return `I am looking at ${opportunity.merchantName}. ${opportunity.detectionReason} Tell me if any of that evidence is wrong before I ask for the missing facts.`;
  }
  if (recoveryCase.status === "user_confirmation") {
    return "I still need a fact from you. I will not fill a gap with a guess, and I will not draft a request that asserts something you have not confirmed.";
  }
  if (recoveryCase.status === "awaiting_approval" && recoveryCase.draft && !recoveryCase.approvalId) {
    return "The draft below uses only the facts on this case. Approving it does not send anything. This preview cannot contact the merchant.";
  }
  if (recoveryCase.approvalId && !recoveryCase.submittedAt) {
    return "You approved the wording. When you have sent it yourself, mark it sent so the case can track the wait for a reply.";
  }
  if (recoveryCase.status === "monitoring" && recoveryCase.followUp?.sentAt) {
    return "The follow-up is marked sent. I will keep the case open until a credit posts or you record the outcome.";
  }
  if (recoveryCase.status === "monitoring" && recoveryCase.followUp?.draft && !recoveryCase.followUp.approvalId) {
    return "I drafted a follow-up that does not add new claims. It stays here until you approve it.";
  }
  if (recoveryCase.status === "monitoring") {
    return "The request is marked sent. A merchant reply is not a recovered refund. Money is counted only after a matching credit or a refund you confirm.";
  }
  if (recoveryCase.status === "verified") {
    return "A refund on this case was recorded once. It will not be counted again.";
  }
  if (recoveryCase.status === "rejected") {
    return "This case is closed without a recovery. The reason is in the timeline.";
  }
  return "This case is closed.";
}
