import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BackButton, Body, Button, Card, Eyebrow, Pill, Screen, TextButton, Title } from "@/components/ui";
import { matchingCredit } from "@/src/analyze";
import { agentNote, requiredAnswersReady } from "@/src/draft";
import { money, shortDate, statusLabel } from "@/src/format";
import { canCreateDraft, recipientReady } from "@/src/workflow";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const caseId = typeof id === "string" ? id : "";
  const recoveryCase = state.cases.find((item) => item.id === caseId);
  const opportunity = state.opportunities.find((item) => item.id === recoveryCase?.opportunityId);
  const [accurate, setAccurate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState(opportunity ? String(opportunity.amountEstimate) : "");
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);

  if (!recoveryCase || !opportunity) {
    return (
      <Screen>
        <BackButton />
        <Title size={28}>This case is not on file.</Title>
      </Screen>
    );
  }

  const credit = matchingCredit(opportunity, state.transactions);
  const draftAllowed = canCreateDraft(state, recoveryCase.id);
  const factsReady = requiredAnswersReady(recoveryCase.questions) && !recoveryCase.questions.some((question) => question.answer === "unsure" && question.id === "authorize_both");

  async function copyDraft(body: string) {
    await Clipboard.setStringAsync(body);
    setCopied(true);
  }

  return (
    <Screen>
      <BackButton fallback="/(tabs)" />
      <View style={styles.row}>
        <Eyebrow>Case #{recoveryCase.caseNumber}</Eyebrow>
        <Pill tone={recoveryCase.status === "verified" ? "green" : "gold"}>{labelFor(recoveryCase.status)}</Pill>
      </View>
      <Title size={30}>{opportunity.merchantName}</Title>
      <Text style={styles.amount}>{money(opportunity.amountEstimate)} potential</Text>
      <Card style={styles.noteCard}>
        <Text style={styles.note}>{agentNote(state, recoveryCase)}</Text>
      </Card>

      <Text style={styles.section}>Evidence in use</Text>
      {opportunity.evidence.map((item) => (
        <Text key={item.id} style={styles.evidence}>
          {item.summary}
        </Text>
      ))}

      {recoveryCase.status === "evidence_review" ? (
        <Button label="These facts are mine" onPress={() => dispatch({ type: "confirm_evidence", caseId: recoveryCase.id })} />
      ) : null}

      {recoveryCase.questions.length > 0 && !recoveryCase.approvalId ? (
        <View style={styles.block}>
          <Text style={styles.section}>Facts still needed</Text>
          {recoveryCase.questions.map((question) => (
            <View key={question.id} style={styles.block}>
              <Text style={styles.question}>{question.prompt}</Text>
              {question.helper ? <Body muted>{question.helper}</Body> : null}
              {question.options ? (
                <View style={styles.options}>
                  {question.options.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => dispatch({ type: "answer", caseId: recoveryCase.id, questionId: question.id, answer: option.value })}
                      style={[styles.option, question.answer === option.value ? styles.optionOn : null]}
                    >
                      <Text style={[styles.optionText, question.answer === option.value ? styles.optionTextOn : null]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <TextAnswer
                  value={question.answer ?? ""}
                  placeholder={question.input === "date" ? "YYYY-MM-DD" : "Optional"}
                  onCommit={(value) => dispatch({ type: "answer", caseId: recoveryCase.id, questionId: question.id, answer: value })}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}

      {!recoveryCase.draft && recoveryCase.status !== "rejected" && recoveryCase.status !== "closed" && recoveryCase.status !== "monitoring" && recoveryCase.status !== "verified" ? (
        draftAllowed ? (
          <Button
            label="Draft the request"
            disabled={!factsReady || recoveryCase.status === "evidence_review"}
            onPress={() => dispatch({ type: "generate_draft", caseId: recoveryCase.id })}
          />
        ) : (
          <Button label="Upgrade to draft another" onPress={() => router.push("/upgrade")} />
        )
      ) : null}

      {recoveryCase.draft ? (
        <View style={styles.block}>
          <Text style={styles.section}>The message</Text>
          <Text style={styles.label}>Recipient</Text>
          <TextInput
            value={recoveryCase.recipient}
            editable={!recoveryCase.submittedAt}
            onChangeText={(recipient) => dispatch({ type: "set_recipient", caseId: recoveryCase.id, recipient })}
            placeholder="billing@merchant.example"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            style={styles.input}
          />
          <Card>
            <Text style={styles.subject}>{recoveryCase.draft.subject}</Text>
            <Text style={styles.letter}>{recoveryCase.draft.body}</Text>
          </Card>
          {!recoveryCase.approvalId ? (
            <>
              <Pressable onPress={() => setAccurate((value) => !value)} style={styles.checkRow}>
                <View style={[styles.box, accurate ? styles.boxOn : null]}>{accurate ? <Text style={styles.check}>✓</Text> : null}</View>
                <Text style={styles.checkText}>I confirm this message is accurate and I approve it as my request.</Text>
              </Pressable>
              <Button
                label="Approve wording"
                disabled={!accurate || !recipientReady(recoveryCase.recipient)}
                onPress={() => dispatch({ type: "approve_draft", caseId: recoveryCase.id })}
              />
              {!recipientReady(recoveryCase.recipient) ? <Body muted>Add a real support address before approval. MoneyBack will not invent one.</Body> : null}
            </>
          ) : null}
          {recoveryCase.approvalId && !recoveryCase.submittedAt ? (
            <>
              <Body>Approved {recoveryCase.approvalId}. Nothing has been sent. Copy the message and send it yourself, then record that here.</Body>
              <Button label={copied ? "Copied" : "Copy message"} tone="secondary" onPress={() => copyDraft(recoveryCase.draft!.body)} />
              <Button label="I sent this myself" onPress={() => dispatch({ type: "mark_sent", caseId: recoveryCase.id })} />
            </>
          ) : null}
        </View>
      ) : null}

      {recoveryCase.status === "monitoring" ? (
        <View style={styles.block}>
          <Text style={styles.section}>While you wait</Text>
          {credit ? (
            <Card>
              <Text style={styles.question}>A {money(credit.amount)} credit posted on {shortDate(credit.occurredAt)}.</Text>
              <Button label="Count this credit" onPress={() => dispatch({ type: "confirm_credit", caseId: recoveryCase.id })} />
            </Card>
          ) : (
            <Body muted>No matching credit has posted yet.</Body>
          )}
          {!recoveryCase.followUp ? (
            <Button label="Draft a follow-up" tone="secondary" onPress={() => dispatch({ type: "generate_follow_up", caseId: recoveryCase.id })} />
          ) : (
            <Card>
              <Text style={styles.subject}>{recoveryCase.followUp.draft.subject}</Text>
              <Text style={styles.letter}>{recoveryCase.followUp.draft.body}</Text>
              {!recoveryCase.followUp.approvalId ? (
                <Button label="Approve follow-up" onPress={() => dispatch({ type: "approve_follow_up", caseId: recoveryCase.id })} />
              ) : null}
              {recoveryCase.followUp.approvalId && !recoveryCase.followUp.sentAt ? (
                <Button label="I sent the follow-up" onPress={() => dispatch({ type: "mark_follow_up_sent", caseId: recoveryCase.id })} />
              ) : null}
            </Card>
          )}
          <Text style={styles.label}>Record a refund you received</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
          <TextInput value={receivedOn} onChangeText={setReceivedOn} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkSoft} />
          <TextInput value={note} onChangeText={setNote} style={styles.input} placeholder="Where you saw the refund" placeholderTextColor={colors.inkSoft} />
          <Button
            label="Record verified refund"
            onPress={() =>
              dispatch({
                type: "record_recovery",
                caseId: recoveryCase.id,
                amount: Number(amount),
                receivedOn,
                note,
              })
            }
          />
          <Button
            label={confirmDecline ? "Confirm the decline" : "Merchant declined"}
            tone="danger"
            onPress={() => {
              if (!confirmDecline) {
                setConfirmDecline(true);
                return;
              }
              dispatch({ type: "merchant_declined", caseId: recoveryCase.id });
            }}
          />
        </View>
      ) : null}

      <Text style={styles.section}>Timeline</Text>
      {recoveryCase.timeline.map((event) => (
        <View key={event.id} style={styles.timeline}>
          <Text style={styles.question}>{event.action}</Text>
          <Text style={styles.evidence}>{event.detail}</Text>
          <Text style={styles.meta}>
            {event.actor} · {shortDate(event.at)}
            {event.approvalId ? ` · ${event.approvalId}` : ""}
          </Text>
        </View>
      ))}
      <Body muted>Opportunity status: {statusLabel(opportunity.status)}. Outbound messages in this preview are sent by you, not by MoneyBack.</Body>
    </Screen>
  );
}

function TextAnswer({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onEndEditing={() => {
        if (draft !== value) onCommit(draft);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.inkSoft}
      style={styles.input}
    />
  );
}

function labelFor(status: string): string {
  return status.replaceAll("_", " ");
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  noteCard: { backgroundColor: colors.greenSoft, borderColor: "#C9E4D4" },
  note: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  section: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginTop: 8 },
  evidence: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  block: { gap: 10 },
  question: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: colors.card },
  optionOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  optionText: { fontFamily: fonts.medium, color: colors.ink, fontSize: 14 },
  optionTextOn: { color: colors.white },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.card, minHeight: 48, paddingHorizontal: 12, fontFamily: fonts.body, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.inkSoft },
  subject: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  letter: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  checkRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  check: { color: colors.white, fontSize: 14 },
  checkText: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 20 },
  timeline: { gap: 3, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, textTransform: "capitalize" },
});
