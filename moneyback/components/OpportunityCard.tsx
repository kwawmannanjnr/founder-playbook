import { Pressable, StyleSheet, Text, View } from "react-native";

import { Pill } from "@/components/ui";
import { confidenceLabel, money, shortDate, statusLabel, typeLabel } from "@/src/format";
import type { Opportunity } from "@/src/model";
import { colors, fonts } from "@/src/theme";

export function OpportunityCard({ opportunity, onPress }: { opportunity: Opportunity; onPress: () => void }) {
  const tone = opportunity.status === "recovered" ? "green" : opportunity.confidence === "high" ? "green" : opportunity.confidence === "medium" ? "gold" : "neutral";
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={[styles.rule, opportunity.status === "recovered" ? styles.ruleGreen : styles.ruleGold]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.merchant}>{opportunity.merchantName}</Text>
          <Pill tone={tone}>{opportunity.status === "recovered" ? "Verified" : confidenceLabel(opportunity.confidence).replace(" confidence", "")}</Pill>
        </View>
        <Text style={styles.type}>{typeLabel(opportunity.type)}</Text>
        <Text style={styles.amount}>
          {money(opportunity.amountEstimate)}
          <Text style={styles.amountNote}>{opportunity.status === "recovered" ? " verified" : " potential"}</Text>
        </Text>
        <Text style={styles.reason} numberOfLines={3}>
          {opportunity.detectionReason}
        </Text>
        <View style={styles.row}>
          <Text style={styles.meta}>{statusLabel(opportunity.status)}</Text>
          {opportunity.deadline ? <Text style={styles.meta}>Review by {shortDate(opportunity.deadline)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  pressed: { opacity: 0.9 },
  rule: { width: 5 },
  ruleGold: { backgroundColor: colors.gold },
  ruleGreen: { backgroundColor: colors.green },
  body: { flex: 1, padding: 14, gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  merchant: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 16, flex: 1 },
  type: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14 },
  amount: { fontFamily: fonts.display, color: colors.ink, fontSize: 26, marginTop: 4 },
  amountNote: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  reason: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  meta: { fontFamily: fonts.medium, color: colors.inkSoft, fontSize: 12, marginTop: 6 },
});
