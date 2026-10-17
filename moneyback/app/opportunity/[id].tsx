import { useLocalSearchParams, useRouter } from "expo-router";
import { flushSync } from "react-dom";
import { StyleSheet, Text, View } from "react-native";

import { BackButton, Body, Button, Card, Eyebrow, Pill, Screen, TextButton, Title } from "@/components/ui";
import { confidenceLabel, money, shortDate, statusLabel, typeLabel } from "@/src/format";
import { openCaseFor } from "@/src/workflow";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function OpportunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const opportunityId = typeof id === "string" ? id : "";
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  const existing = opportunity ? openCaseFor(state, opportunity.id) : undefined;

  if (!opportunity) {
    return (
      <Screen>
        <BackButton />
        <Title size={28}>This finding is no longer available.</Title>
      </Screen>
    );
  }

  const open = opportunity.status !== "closed" && opportunity.status !== "recovered" && opportunity.status !== "unsuccessful";

  function recover() {
    if (!state.profile) {
      router.push(`/signup?next=${encodeURIComponent(`/opportunity/${opportunity!.id}`)}`);
      return;
    }
    if (existing) {
      router.push(`/case/${existing.id}`);
      return;
    }
    const created = `case_${state.nextCaseNumber}`;
    flushSync(() => dispatch({ type: "start_case", opportunityId: opportunity!.id }));
    router.push(`/case/${created}`);
  }

  return (
    <Screen
      footer={
        open ? (
          <>
            <Button label={existing ? "Open the case" : "Help Me Recover This"} onPress={recover} />
            <TextButton label="Not an issue" onPress={() => {
              dispatch({ type: "dismiss", opportunityId: opportunity.id, reason: "You marked this finding as not an issue." });
              router.back();
            }} />
          </>
        ) : undefined
      }
    >
      <BackButton fallback={state.phase === "ready" ? "/(tabs)/opportunities" : "/results"} />
      <Eyebrow>{typeLabel(opportunity.type)}</Eyebrow>
      <Title size={32}>{opportunity.merchantName}</Title>
      <Text style={styles.amount}>{money(opportunity.amountEstimate)}</Text>
      <Body>{opportunity.status === "recovered" ? "Verified recovery. This amount is not also listed as potential." : "Potential value. This is not money you have received."}</Body>
      <View style={styles.pills}>
        <Pill tone={opportunity.confidence === "high" ? "green" : "gold"}>{confidenceLabel(opportunity.confidence)}</Pill>
        <Pill>{statusLabel(opportunity.status)}</Pill>
        {opportunity.deadline ? <Pill tone="clay">Review by {shortDate(opportunity.deadline)}</Pill> : null}
      </View>
      <Card>
        <Text style={styles.heading}>Why it was detected</Text>
        <Text style={styles.copy}>{opportunity.detectionReason}</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Evidence</Text>
        {opportunity.evidence.map((item) => (
          <View key={item.id} style={styles.evidence}>
            <Text style={styles.evidenceType}>{item.sourceType.split("_").join(" ")}</Text>
            <Text style={styles.copy}>{item.summary}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.heading}>Suggested next step</Text>
        <Text style={styles.copy}>{suggestion(opportunity.type)}</Text>
      </Card>
      {opportunity.dismissedReason ? <Body muted>{opportunity.dismissedReason}</Body> : null}
      {opportunity.status === "recovered" ? (
        <TextButton
          label="This credit match is wrong"
          onPress={() => dispatch({ type: "reject_credit_match", opportunityId: opportunity.id })}
        />
      ) : null}
    </Screen>
  );
}

function suggestion(type: string): string {
  switch (type) {
    case "duplicate_charge":
      return "Confirm whether you authorized both posted charges. If only one was intentional, MoneyBack can draft a review request.";
    case "post_cancellation_charge":
      return "Check the cancellation date and any confirmation you have. The draft will say if a confirmation number is missing.";
    case "missing_refund":
      return "Confirm the saved promise, then ask the merchant for the status. A promise is not a verified refund.";
    case "price_discrepancy":
      return "Check whether tax or shipping explains the gap before calling it an error.";
    default:
      return "This drafts a cancellation request. It does not cancel the service or refund past charges.";
  }
}

const styles = StyleSheet.create({
  amount: { fontFamily: fonts.display, fontSize: 42, color: colors.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  copy: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  evidence: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  evidenceType: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: colors.inkSoft },
});
