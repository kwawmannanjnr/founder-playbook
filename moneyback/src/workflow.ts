import { analyze, matchingCredit } from "./analyze";
import { buildDraft, buildFollowUp, answerClosesCase, questionsFor, requiredAnswersReady } from "./draft";
import type {
  ActionLogEntry,
  AppState,
  FinancialConnection,
  Opportunity,
  PlanId,
  RecoveryCase,
  Transaction,
  UserPreference,
} from "./model";
import { addDays, cents, dateOnly, emptyState, FREE_DRAFT_LIMIT, isOpenStatus, roundMoney } from "./model";

export type Action =
  | { type: "sign_up"; name: string; email: string }
  | { type: "set_plan"; plan: PlanId }
  | { type: "import_transactions"; connection: FinancialConnection; transactions: Transaction[]; sampleHousehold?: boolean }
  | { type: "disconnect"; connectionId: string }
  | { type: "delete_connection"; connectionId: string }
  | { type: "delete_all" }
  | { type: "sync" }
  | { type: "dismiss"; opportunityId: string; reason: string }
  | { type: "set_preference"; streamId: string; preference: UserPreference }
  | { type: "record_cancellation"; streamId: string; effectiveOn: string; confirmation: string }
  | { type: "start_case"; opportunityId: string }
  | { type: "confirm_evidence"; caseId: string }
  | { type: "answer"; caseId: string; questionId: string; answer: string }
  | { type: "set_recipient"; caseId: string; recipient: string }
  | { type: "generate_draft"; caseId: string }
  | { type: "approve_draft"; caseId: string }
  | { type: "mark_sent"; caseId: string }
  | { type: "generate_follow_up"; caseId: string }
  | { type: "approve_follow_up"; caseId: string }
  | { type: "mark_follow_up_sent"; caseId: string }
  | { type: "merchant_declined"; caseId: string }
  | { type: "record_recovery"; caseId: string; amount: number; receivedOn: string; note: string }
  | { type: "confirm_credit"; caseId: string }
  | { type: "reject_credit_match"; opportunityId: string };

export function recipientReady(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function canCreateDraft(state: AppState, caseId: string): boolean {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase || recoveryCase.draft || recoveryCase.draftCounted) return true;
  if (state.plan !== "free") return true;
  return state.draftsUsed < FREE_DRAFT_LIMIT;
}

export function reduce(state: AppState, action: Action, now: string): AppState {
  switch (action.type) {
    case "sign_up": {
      const name = action.name.trim();
      const email = action.email.trim();
      if (name.length < 2 || !email.includes("@")) return state;
      return log(
        { ...state, profile: { name, email, createdAt: state.profile?.createdAt ?? now }, phase: "ready" },
        "user",
        null,
        "Created account",
        "Profile saved on this device. No password was sent to a server.",
        null,
        now,
        "Saved",
      );
    }
    case "set_plan":
      return log(
        { ...state, plan: action.plan },
        "user",
        null,
        "Changed plan",
        action.plan === "free"
          ? "Returned to the free plan. This preview does not charge a card."
          : "Selected a Plus plan in this preview. No card was charged.",
        null,
        now,
        "Updated",
      );
    case "import_transactions": {
      const without = state.connections.filter((connection) => connection.id !== action.connection.id);
      const seen = new Set(state.transactions.map((transaction) => `${transaction.connectionId}:${transaction.externalId}`));
      const transactions = [
        ...state.transactions,
        ...action.transactions.filter((transaction) => {
          const key = `${transaction.connectionId}:${transaction.externalId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ];
      return recompute(
        log(
          {
            ...state,
            connections: [...without, action.connection],
            transactions,
            sampleHousehold: action.sampleHousehold ?? false,
            phase: state.phase === "ready" ? "ready" : "results",
            asOf: now,
          },
          "system",
          null,
          "Imported transactions",
          `${action.transactions.length} rows read from ${action.connection.institutionName}. Duplicate sync keys were skipped.`,
          null,
          now,
          "Imported",
        ),
        now,
      );
    }
    case "disconnect":
      return log(
        {
          ...state,
          connections: state.connections.map((connection) =>
            connection.id === action.connectionId ? { ...connection, status: "disconnected", lastSyncAt: now } : connection,
          ),
        },
        "user",
        null,
        "Disconnected an account",
        "Future collection is stopped. Imported transactions stay until you delete them.",
        null,
        now,
        "Disconnected",
      );
    case "delete_connection":
      return deleteConnection(state, action.connectionId, now);
    case "delete_all":
      return emptyState();
    case "sync": {
      const connections = state.connections.map((connection) =>
        connection.status === "disconnected" ? connection : { ...connection, lastSyncAt: now },
      );
      return recompute(
        log(
          { ...state, connections },
          "system",
          null,
          "Checked for new transactions",
          "No live bank feed is connected in this preview, so the imported records were checked again and no new rows were added.",
          null,
          now,
          "No new transactions",
        ),
        now,
      );
    }
    case "dismiss":
      return closeOpportunity(state, action.opportunityId, action.reason, "closed", now);
    case "set_preference":
      return recompute(
        log(
          {
            ...state,
            streams: state.streams.map((stream) =>
              stream.id === action.streamId ? { ...stream, userPreference: action.preference } : stream,
            ),
          },
          "user",
          null,
          "Updated a subscription preference",
          `Marked a recurring charge ${action.preference}. Recurring does not mean waste.`,
          null,
          now,
          "Saved",
        ),
        now,
      );
    case "record_cancellation": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.effectiveOn)) return state;
      return recompute(
        log(
          {
            ...state,
            streams: state.streams.map((stream) =>
              stream.id === action.streamId
                ? {
                    ...stream,
                    userPreference: stream.userPreference === "unknown" ? "unwanted" : stream.userPreference,
                    cancellation: {
                      effectiveOn: action.effectiveOn,
                      confirmation: action.confirmation.trim() || null,
                      recordedAt: now,
                    },
                  }
                : stream,
            ),
          },
          "user",
          null,
          "Recorded a cancellation",
          "The date is the one you entered. Later matching charges can become a recovery lead.",
          null,
          now,
          "Saved",
        ),
        now,
      );
    }
    case "start_case":
      return startCase(state, action.opportunityId, now);
    case "confirm_evidence":
      return mapCase(state, action.caseId, now, (recoveryCase) => {
        if (recoveryCase.status !== "evidence_review") return recoveryCase;
        return {
          ...recoveryCase,
          status: "user_confirmation",
          timeline: [
            ...recoveryCase.timeline,
            event(state, "user", "Confirmed the evidence", "You said the evidence on the case can be used.", now),
          ],
        };
      });
    case "answer":
      return answerQuestion(state, action.caseId, action.questionId, action.answer, now);
    case "set_recipient":
      return mapCase(state, action.caseId, now, (recoveryCase) => {
        if (recoveryCase.submittedAt) return recoveryCase;
        const recipient = action.recipient;
        return {
          ...recoveryCase,
          recipient,
          draft: recoveryCase.draft ? { ...recoveryCase.draft, recipient } : recoveryCase.draft,
        };
      });
    case "generate_draft":
      return generateDraft(state, action.caseId, now);
    case "approve_draft":
      return approveDraft(state, action.caseId, now);
    case "mark_sent":
      return markSent(state, action.caseId, now);
    case "generate_follow_up":
      return generateFollowUp(state, action.caseId, now);
    case "approve_follow_up":
      return mapCase(state, action.caseId, now, (recoveryCase) => {
        if (!recoveryCase.followUp || recoveryCase.followUp.approvalId || !recipientReady(recoveryCase.followUp.draft.recipient)) {
          return recoveryCase;
        }
        const approvalId = nextId(state, "appr");
        return {
          ...recoveryCase,
          followUp: { ...recoveryCase.followUp, approvalId },
          timeline: [
            ...recoveryCase.timeline,
            event(state, "user", "Approved the follow-up", "You approved the follow-up wording. It has not been sent.", now, approvalId),
          ],
        };
      });
    case "mark_follow_up_sent":
      return mapCase(state, action.caseId, now, (recoveryCase) => {
        if (!recoveryCase.followUp?.approvalId || recoveryCase.followUp.sentAt) return recoveryCase;
        return {
          ...recoveryCase,
          followUp: { ...recoveryCase.followUp, sentAt: now },
          nextActionAt: addDays(now, 5),
          timeline: [
            ...recoveryCase.timeline,
            event(state, "user", "Marked the follow-up sent", "You recorded that you sent the follow-up yourself.", now),
          ],
        };
      });
    case "merchant_declined":
      return merchantDeclined(state, action.caseId, now);
    case "record_recovery":
      return recordRecovery(state, action.caseId, action.amount, action.receivedOn, action.note, now);
    case "confirm_credit":
      return confirmCredit(state, action.caseId, now);
    case "reject_credit_match":
      return rejectCredit(state, action.opportunityId, now);
    default:
      return state;
  }
}

function startCase(state: AppState, opportunityId: string, now: string): AppState {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity || !isOpenStatus(opportunity.status)) return state;
  const existing = state.cases.find((item) => item.opportunityId === opportunityId && item.status !== "closed" && item.status !== "rejected");
  if (existing) return state;
  const recoveryCase: RecoveryCase = {
    id: `case_${state.nextCaseNumber}`,
    caseNumber: state.nextCaseNumber,
    opportunityId,
    status: "evidence_review",
    questions: questionsFor(opportunity, state),
    recipient: "",
    draft: null,
    draftCounted: false,
    followUp: null,
    timeline: [event(state, "user", "Opened a recovery case", "You asked for help recovering this. Nothing will be sent without approval.", now)],
    submittedAt: null,
    resolvedAt: null,
    approvalId: null,
    nextActionAt: null,
  };
  return log(
    {
      ...state,
      nextCaseNumber: state.nextCaseNumber + 1,
      cases: [recoveryCase, ...state.cases],
      opportunities: state.opportunities.map((item) => (item.id === opportunityId ? { ...item, status: "in_progress" } : item)),
    },
    "agent",
    recoveryCase.id,
    "Started evidence review",
    opportunity.detectionReason,
    null,
    now,
    "In progress",
  );
}

function answerQuestion(state: AppState, caseId: string, questionId: string, answer: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase || recoveryCase.approvalId) return state;
  if (answerClosesCase(questionId, answer)) {
    const reason =
      questionId === "authorize_both"
        ? "You confirmed both charges were intentional."
        : questionId === "promise_accurate"
          ? "You withdrew the refund promise."
          : "You decided not to request cancellation.";
    return closeOpportunity(state, recoveryCase.opportunityId, reason, "closed", now);
  }
  return mapCase(state, caseId, now, (current) => ({
    ...current,
    status: current.status === "evidence_review" ? "user_confirmation" : current.status,
    draft: null,
    approvalId: null,
    questions: current.questions.map((question) => (question.id === questionId ? { ...question, answer } : question)),
    timeline: [
      ...current.timeline,
      event(state, "user", "Answered a question", "A fact on the case was updated.", now),
    ],
  }));
}

function generateDraft(state: AppState, caseId: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase || recoveryCase.submittedAt || recoveryCase.approvalId) return state;
  if (!requiredAnswersReady(recoveryCase.questions)) return state;
  if (!canCreateDraft(state, caseId)) return state;
  const draft = buildDraft(state, recoveryCase, now);
  if (!draft) return state;
  const created = !recoveryCase.draftCounted;
  return mapCase(
    { ...state, draftsUsed: created && state.plan === "free" ? state.draftsUsed + 1 : state.draftsUsed },
    caseId,
    now,
    (current) => ({
      ...current,
      status: "awaiting_approval",
      draft,
      draftCounted: true,
      timeline: [...current.timeline, event(state, "agent", "Drafted a request", "The draft uses the confirmed facts and does not promise a refund.", now)],
    }),
  );
}

function approveDraft(state: AppState, caseId: string, now: string): AppState {
  return mapCase(state, caseId, now, (recoveryCase) => {
    if (!recoveryCase.draft || recoveryCase.approvalId || !recipientReady(recoveryCase.recipient || recoveryCase.draft.recipient)) return recoveryCase;
    const approvalId = nextId(state, "appr");
    return {
      ...recoveryCase,
      approvalId,
      draft: { ...recoveryCase.draft, recipient: recoveryCase.recipient || recoveryCase.draft.recipient },
      timeline: [
        ...recoveryCase.timeline,
        event(state, "user", "Approved the draft", "You confirmed the message is accurate. It has not been sent.", now, approvalId),
      ],
    };
  });
}

function markSent(state: AppState, caseId: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase?.approvalId || recoveryCase.submittedAt) return state;
  return mapCase(state, caseId, now, (current) => ({
    ...current,
    status: "monitoring",
    submittedAt: now,
    nextActionAt: addDays(now, 5),
    timeline: [...current.timeline, event(state, "user", "Marked the request sent", "You recorded that you sent the approved message yourself.", now)],
  }));
}

function generateFollowUp(state: AppState, caseId: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase || recoveryCase.status !== "monitoring" || recoveryCase.followUp?.sentAt) return state;
  const draft = buildFollowUp(state, recoveryCase, now);
  if (!draft) return state;
  return mapCase(state, caseId, now, (current) => ({
    ...current,
    followUp: { draft, approvalId: null, sentAt: null },
    timeline: [...current.timeline, event(state, "agent", "Drafted a follow-up", "The follow-up asks for a status update and adds no new claims.", now)],
  }));
}

function merchantDeclined(state: AppState, caseId: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  if (!recoveryCase || recoveryCase.status !== "monitoring") return state;
  const next = mapCase(state, caseId, now, (current) => ({
    ...current,
    status: "rejected",
    resolvedAt: now,
    timeline: [...current.timeline, event(state, "user", "Recorded a merchant decline", "You recorded that the merchant declined the request.", now)],
  }));
  return {
    ...next,
    opportunities: next.opportunities.map((opportunity) =>
      opportunity.id === recoveryCase.opportunityId ? { ...opportunity, status: "unsuccessful", dismissedReason: "Merchant declined." } : opportunity,
    ),
    ledger: next.ledger.filter((entry) => !(entry.opportunityId === recoveryCase.opportunityId && entry.type === "pending_recovery")),
  };
}

function recordRecovery(state: AppState, caseId: string, amount: number, receivedOn: string, note: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase?.opportunityId);
  if (!recoveryCase || !opportunity) return state;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) return state;
  const value = roundMoney(amount);
  if (value <= 0 || cents(value) > cents(opportunity.amountEstimate)) return state;
  if (state.ledger.some((entry) => entry.type === "verified_recovery" && entry.opportunityId === opportunity.id)) return state;
  const full = cents(value) >= cents(opportunity.amountEstimate);
  const withLedger: AppState = {
    ...state,
    ledger: [
      ...state.ledger.filter((entry) => !(entry.opportunityId === opportunity.id && entry.type === "pending_recovery")),
      {
        id: nextId(state, "savings"),
        caseId,
        opportunityId: opportunity.id,
        streamId: null,
        amount: value,
        type: "verified_recovery",
        verificationSource: note.trim() || "Refund you confirmed",
        verifiedAt: receivedOn,
        note: note.trim() || "You confirmed this refund.",
      },
    ],
    opportunities: state.opportunities.map((item) =>
      item.id === opportunity.id ? { ...item, status: full ? "recovered" : "in_progress" } : item,
    ),
  };
  return mapCase(withLedger, caseId, now, (current) => ({
    ...current,
    status: full ? "verified" : "monitoring",
    resolvedAt: full ? now : null,
    timeline: [
      ...current.timeline,
      event(
        state,
        "user",
        full ? "Confirmed a refund" : "Confirmed a partial refund",
        full
          ? `${usd(value)} was recorded once and will not be counted again.`
          : `${usd(value)} of ${usd(opportunity.amountEstimate)} was recorded. The rest stays open.`,
        now,
      ),
    ],
  }));
}

function confirmCredit(state: AppState, caseId: string, now: string): AppState {
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase?.opportunityId);
  if (!recoveryCase || !opportunity) return state;
  const credit = matchingCredit(opportunity, state.transactions);
  if (!credit) return state;
  return recordRecovery(state, caseId, credit.amount > opportunity.amountEstimate ? opportunity.amountEstimate : credit.amount, dateOnly(credit.occurredAt), "Matching posted credit", now);
}

function rejectCredit(state: AppState, opportunityId: string, now: string): AppState {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return state;
  return log(
    {
      ...state,
      opportunities: state.opportunities.map((item) =>
        item.id === opportunityId ? { ...item, status: "needs_review", creditMatchRejected: true } : item,
      ),
      ledger: state.ledger.filter(
        (entry) => !(entry.opportunityId === opportunityId && entry.verificationSource === "Matching posted credit"),
      ),
    },
    "user",
    null,
    "Rejected a credit match",
    "The posted credit will not be counted as a recovery for this finding.",
    null,
    now,
    "Needs review",
  );
}

function closeOpportunity(
  state: AppState,
  opportunityId: string,
  reason: string,
  status: "closed" | "unsuccessful",
  now: string,
): AppState {
  return log(
    {
      ...state,
      opportunities: state.opportunities.map((opportunity) =>
        opportunity.id === opportunityId ? { ...opportunity, status, dismissedReason: reason } : opportunity,
      ),
      cases: state.cases.map((recoveryCase) =>
        recoveryCase.opportunityId === opportunityId && recoveryCase.status !== "verified"
          ? {
              ...recoveryCase,
              status: "closed",
              resolvedAt: now,
              timeline: [...recoveryCase.timeline, event(state, "user", "Closed the case", reason, now)],
            }
          : recoveryCase,
      ),
    },
    "user",
    null,
    "Closed a finding",
    reason,
    null,
    now,
    "Closed",
  );
}

function deleteConnection(state: AppState, connectionId: string, now: string): AppState {
  const removed = new Set(state.transactions.filter((transaction) => transaction.connectionId === connectionId).map((transaction) => transaction.id));
  const transactions = state.transactions.filter((transaction) => transaction.connectionId !== connectionId);
  const opportunities = state.opportunities.filter((opportunity) => opportunity.transactionIds.every((id) => !removed.has(id)));
  const keptIds = new Set(opportunities.map((opportunity) => opportunity.id));
  const next = recompute(
    {
      ...state,
      connections: state.connections.filter((connection) => connection.id !== connectionId),
      transactions,
      opportunities,
      cases: state.cases.filter((recoveryCase) => keptIds.has(recoveryCase.opportunityId)),
      ledger: state.ledger.filter((entry) => !entry.opportunityId || keptIds.has(entry.opportunityId)),
      refundPromises: state.refundPromises.filter((promise) => !promise.transactionId || !removed.has(promise.transactionId)),
      priceClaims: state.priceClaims.filter((claim) => !removed.has(claim.transactionId)),
    },
    now,
  );
  return log(next, "user", null, "Deleted imported records", "Transactions from that connection and findings that depended on them were removed.", null, now, "Deleted");
}

function recompute(state: AppState, now: string): AppState {
  const analysis = analyze({
    transactions: state.transactions,
    refundPromises: state.refundPromises,
    priceClaims: state.priceClaims,
    annotations: state.streams.map((stream) => ({
      merchantId: stream.merchantId,
      preference: stream.userPreference,
      cancellation: stream.cancellation,
    })),
    asOf: state.asOf || now,
    previousStreams: state.streams,
    previousOpportunities: state.opportunities,
    keptLedger: state.ledger,
  });
  const caseStatus = new Map(state.cases.map((recoveryCase) => [recoveryCase.opportunityId, recoveryCase]));
  const opportunities = analysis.opportunities.map((opportunity) => {
    const recoveryCase = caseStatus.get(opportunity.id);
    if (!recoveryCase) return opportunity;
    if (recoveryCase.status === "verified") return { ...opportunity, status: "recovered" as const };
    if (recoveryCase.status === "rejected") return { ...opportunity, status: "unsuccessful" as const };
    if (recoveryCase.status === "closed") return { ...opportunity, status: "closed" as const };
    if (isOpenStatus(opportunity.status) || opportunity.status === "in_progress") return { ...opportunity, status: "in_progress" as const };
    return opportunity;
  });
  return { ...state, streams: analysis.streams, opportunities, ledger: analysis.ledger };
}

function mapCase(state: AppState, caseId: string, now: string, update: (recoveryCase: RecoveryCase) => RecoveryCase): AppState {
  let changed = false;
  const cases = state.cases.map((recoveryCase) => {
    if (recoveryCase.id !== caseId) return recoveryCase;
    const next = update(recoveryCase);
    changed = next !== recoveryCase;
    return next;
  });
  if (!changed) return state;
  const recoveryCase = cases.find((item) => item.id === caseId);
  const latest = recoveryCase?.timeline[recoveryCase.timeline.length - 1];
  const previous = state.cases.find((item) => item.id === caseId)?.timeline.length ?? 0;
  const withCases = { ...state, cases };
  if (!latest || (recoveryCase && recoveryCase.timeline.length === previous)) return withCases;
  return log(withCases, latest.actor, caseId, latest.action, latest.detail, latest.approvalId ?? null, now, "Recorded");
}

function event(state: AppState, actor: ActionLogEntry["actor"], action: string, detail: string, at: string, approvalId?: string) {
  return {
    id: nextId(state, "tl"),
    actor,
    action,
    detail,
    at,
    approvalId,
  };
}

function log(
  state: AppState,
  actor: ActionLogEntry["actor"],
  caseId: string | null,
  action: string,
  detail: string,
  approvalId: string | null,
  at: string,
  outcome: string,
): AppState {
  const entry: ActionLogEntry = {
    id: nextId(state, "act"),
    caseId,
    actor,
    action,
    detail,
    approvalId,
    at,
    outcome,
  };
  return { ...state, actions: [entry, ...state.actions] };
}

function nextId(state: AppState, prefix: string): string {
  return `${prefix}_${state.actions.length + state.cases.length + state.ledger.length + 1}`;
}

function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function openCaseFor(state: AppState, opportunityId: string): RecoveryCase | undefined {
  return state.cases.find((recoveryCase) => recoveryCase.opportunityId === opportunityId && recoveryCase.status !== "closed");
}

export function opportunityById(state: AppState, id: string): Opportunity | undefined {
  return state.opportunities.find((opportunity) => opportunity.id === id);
}
