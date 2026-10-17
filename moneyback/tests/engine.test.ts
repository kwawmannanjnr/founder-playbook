import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildSampleState } from "../src/demo";
import { parseTransactionCsv } from "../src/csv";
import { metricsOf } from "../src/selectors";
import { DEMO_AS_OF, emptyState } from "../src/model";
import { canCreateDraft, reduce } from "../src/workflow";

const NOW = "2026-04-16T18:00:00.000Z";

describe("sample household", () => {
  const state = buildSampleState("preview_bank", "ready", {
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    createdAt: DEMO_AS_OF,
  });

  it("reports potential, verified, and projected savings from evidence", () => {
    const metrics = metricsOf(state);
    assert.equal(metrics.potential, 187.42);
    assert.equal(metrics.verified, 35);
    assert.equal(metrics.projected, 144);
    assert.equal(metrics.realized, 12);
    assert.equal(metrics.pending, 33.43);
  });

  it("does not treat tips, split shipments, groceries, or separate orders as duplicates", () => {
    const names = state.opportunities.map((opportunity) => opportunity.merchantName);
    assert.equal(names.filter((name) => name === "Nordstrom").length, 1);
    assert.equal(names.includes("Hearth Restaurant"), false);
    assert.equal(names.includes("Blue Bottle"), false);
    assert.equal(names.includes("Green Grocer"), false);
    assert.equal(names.includes("Parcel & Co"), false);
    assert.equal(names.includes("Field Goods"), false);
  });

  it("keeps a recovered credit out of potential and distinguishes pending", () => {
    const cloudbox = state.opportunities.find((opportunity) => opportunity.merchantName === "Cloudbox");
    assert.equal(cloudbox?.status, "recovered");
    assert.equal(state.ledger.filter((entry) => entry.opportunityId === cloudbox?.id && entry.type === "verified_recovery").length, 1);
    const bright = state.opportunities.find((opportunity) => opportunity.merchantName === "BrightHome");
    assert.equal(bright?.status, "in_progress");
    assert.equal(bright?.confidence, "medium");
  });

  it("drafts only confirmed facts", () => {
    const peak = state.cases.find((recoveryCase) => recoveryCase.caseNumber === 104);
    assert.ok(peak?.draft);
    assert.match(peak!.draft!.body, /PF-44192/);
    assert.match(peak!.draft!.body, /March 1, 2026/);
    assert.doesNotMatch(peak!.draft!.body, /guaranteed|will be refunded|you will receive/i);
    assert.equal(peak?.approvalId, "appr_104");
    assert.ok(peak?.submittedAt);
  });

  it("does not flag an essential or wanted subscription as waste", () => {
    const types = state.opportunities.map((opportunity) => `${opportunity.merchantName}:${opportunity.type}`);
    assert.equal(types.some((type) => type.startsWith("Northline Internet")), false);
    assert.equal(types.some((type) => type.startsWith("Reelhouse")), false);
    assert.equal(types.some((type) => type.startsWith("Oak Rentals")), false);
    assert.equal(types.some((type) => type.startsWith("FitLoop:unwanted")), false);
  });
});

describe("csv import", () => {
  it("parses charges, credits, and pending rows without duplicating a second import", () => {
    const csv = [
      "date,merchant,amount,status,category,reference",
      "2026-04-02,Nordstrom,32.00,posted,shopping,ORD-1",
      "2026-04-02,Nordstrom,32.00,posted,shopping,ORD-1",
      "04/03/2026,Cafe,(6.50),posted,restaurant,",
      "2026-04-04,Gym,20.00,pending,fitness,G-1",
    ].join("\n");
    const first = parseTransactionCsv(csv, "conn_csv");
    assert.equal(first.errors.length, 0);
    assert.equal(first.transactions.length, 4);
    assert.equal(first.transactions[2].direction, "credit");
    assert.equal(first.transactions[3].status, "pending");
    assert.equal(first.transactions[3].postedAt, null);

    let state = reduce(
      emptyState(),
      {
        type: "import_transactions",
        connection: {
          id: "conn_csv",
          provider: "csv",
          institutionName: "CSV",
          accountMask: "0000",
          scope: "One-time file import",
          lastSyncAt: NOW,
          status: "healthy",
          createdAt: NOW,
        },
        transactions: first.transactions,
      },
      NOW,
    );
    state = reduce(
      state,
      {
        type: "import_transactions",
        connection: state.connections[0],
        transactions: first.transactions,
      },
      NOW,
    );
    assert.equal(state.transactions.length, 4);
    const nordstrom = state.opportunities.filter((opportunity) => opportunity.merchantName === "Nordstrom");
    assert.equal(nordstrom.length, 1);
    assert.equal(nordstrom[0].confidence, "high");
  });
});

describe("recovery workflow", () => {
  const base = buildSampleState("sample_file", "ready", {
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    createdAt: DEMO_AS_OF,
  });

  it("requires a confirmed fact, approval, and a single verified recovery", () => {
    const nordstrom = base.opportunities.find((opportunity) => opportunity.merchantName === "Nordstrom" && opportunity.status === "needs_review");
    assert.ok(nordstrom);
    let state = reduce(base, { type: "start_case", opportunityId: nordstrom!.id }, NOW);
    const caseId = state.cases.find((recoveryCase) => recoveryCase.opportunityId === nordstrom!.id)!.id;
    state = reduce(state, { type: "generate_draft", caseId }, NOW);
    assert.equal(state.cases.find((recoveryCase) => recoveryCase.id === caseId)?.draft, null);

    state = reduce(state, { type: "answer", caseId, questionId: "authorize_both", answer: "only_one" }, NOW);
    state = reduce(state, { type: "generate_draft", caseId }, NOW);
    const draft = state.cases.find((recoveryCase) => recoveryCase.id === caseId)?.draft;
    assert.ok(draft);
    assert.match(draft!.body, /ORD-18421/);
    assert.doesNotMatch(draft!.body, /PF-\d+/);
    assert.equal(state.draftsUsed, 1);

    state = reduce(state, { type: "mark_sent", caseId }, NOW);
    assert.equal(state.cases.find((recoveryCase) => recoveryCase.id === caseId)?.submittedAt, null);

    state = reduce(state, { type: "set_recipient", caseId, recipient: "billing@nordstrom.example" }, NOW);
    state = reduce(state, { type: "approve_draft", caseId }, NOW);
    assert.ok(state.cases.find((recoveryCase) => recoveryCase.id === caseId)?.approvalId);
    state = reduce(state, { type: "mark_sent", caseId }, NOW);
    assert.equal(state.cases.find((recoveryCase) => recoveryCase.id === caseId)?.status, "monitoring");

    state = reduce(state, { type: "record_recovery", caseId, amount: 32, receivedOn: "2026-04-20", note: "Credit posted" }, NOW);
    state = reduce(state, { type: "record_recovery", caseId, amount: 32, receivedOn: "2026-04-21", note: "Again" }, NOW);
    const verified = state.ledger.filter((entry) => entry.type === "verified_recovery" && entry.caseId === caseId);
    assert.equal(verified.length, 1);
    assert.equal(metricsOf(state).verified, 67);
    assert.equal(state.opportunities.find((opportunity) => opportunity.id === nordstrom!.id)?.status, "recovered");
  });

  it("stops a second free draft", () => {
    const lumen = base.opportunities.find((opportunity) => opportunity.merchantName === "Lumen");
    const aero = base.opportunities.find((opportunity) => opportunity.merchantName === "AeroSupply");
    let state = reduce(base, { type: "start_case", opportunityId: lumen!.id }, NOW);
    const first = state.cases.find((recoveryCase) => recoveryCase.opportunityId === lumen!.id)!;
    state = reduce(state, { type: "confirm_evidence", caseId: first.id }, NOW);
    state = reduce(state, { type: "generate_draft", caseId: first.id }, NOW);
    assert.equal(state.draftsUsed, 1);
    state = reduce(state, { type: "start_case", opportunityId: aero!.id }, NOW);
    const second = state.cases.find((recoveryCase) => recoveryCase.opportunityId === aero!.id)!;
    state = reduce(state, { type: "answer", caseId: second.id, questionId: "promise_accurate", answer: "yes" }, NOW);
    assert.equal(canCreateDraft(state, second.id), false);
    const blocked = reduce(state, { type: "generate_draft", caseId: second.id }, NOW);
    assert.equal(blocked.cases.find((recoveryCase) => recoveryCase.id === second.id)?.draft, null);
  });

  it("does not invent a cancellation number", () => {
    let state = reduce(emptyState(), { type: "sign_up", name: "Ava Cole", email: "ava@example.com" }, NOW);
    const csv = ["date,merchant,amount,status,category", "2026-01-01,Peak Fitness,49,posted,fitness", "2026-02-01,Peak Fitness,49,posted,fitness", "2026-03-01,Peak Fitness,49,posted,fitness", "2026-04-01,Peak Fitness,49,posted,fitness"].join("\n");
    const parsed = parseTransactionCsv(csv, "conn_user");
    state = reduce(
      state,
      {
        type: "import_transactions",
        connection: {
          id: "conn_user",
          provider: "csv",
          institutionName: "CSV",
          accountMask: "1111",
          scope: "One-time file import",
          lastSyncAt: NOW,
          status: "healthy",
          createdAt: NOW,
        },
        transactions: parsed.transactions,
      },
      NOW,
    );
    const stream = state.streams.find((item) => item.merchantName === "Peak Fitness");
    assert.ok(stream);
    state = reduce(state, { type: "record_cancellation", streamId: stream!.id, effectiveOn: "2026-03-15", confirmation: "" }, NOW);
    const opportunity = state.opportunities.find((item) => item.type === "post_cancellation_charge");
    assert.ok(opportunity);
    assert.match(opportunity!.detectionReason, /without a confirmation number/);
    state = reduce(state, { type: "start_case", opportunityId: opportunity!.id }, NOW);
    const recoveryCase = state.cases.find((item) => item.opportunityId === opportunity!.id)!;
    state = reduce(state, { type: "answer", caseId: recoveryCase.id, questionId: "cancellation_confirmation", answer: "" }, NOW);
    state = reduce(state, { type: "generate_draft", caseId: recoveryCase.id }, NOW);
    const body = state.cases.find((item) => item.id === recoveryCase.id)?.draft?.body ?? "";
    assert.match(body, /I do not have a confirmation number/);
    assert.doesNotMatch(body, /PF-\d+|LM-\d+|confirmation [A-Z]{2}-\d+/);
  });

  it("disconnects without deleting, then deletion removes dependent findings", () => {
    let state = reduce(base, { type: "disconnect", connectionId: "conn_sample" }, NOW);
    assert.equal(state.connections[0].status, "disconnected");
    assert.ok(state.transactions.length > 0);
    state = reduce(state, { type: "delete_connection", connectionId: "conn_sample" }, NOW);
    assert.equal(state.transactions.length, 0);
    assert.equal(state.opportunities.length, 0);
    assert.equal(metricsOf(state).verified, 0);
  });
});
