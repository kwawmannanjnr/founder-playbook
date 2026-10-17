import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Eyebrow, Icon, Screen } from "@/components/ui";
import { money, planLabel } from "@/src/format";
import { attentionItems, caseHeadline, metricsOf, workingCases } from "@/src/selectors";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Dashboard() {
  const router = useRouter();
  const { state } = useApp();
  const metrics = metricsOf(state);
  const attention = attentionItems(state);
  const working = workingCases(state);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = state.profile?.name.split(" ")[0] ?? "there";

  return (
    <Screen>
      <View style={styles.top}>
        <View>
          <Eyebrow>MoneyBack AI</Eyebrow>
          <Text style={styles.hello}>
            {hello}, {name}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={styles.iconButton}>
          <Icon name="settings" size={18} />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push("/upgrade")} style={styles.plan}>
        <Text style={styles.planText}>{planLabel(state.plan)}</Text>
      </Pressable>

      <Card>
        <LedgerRow label="Potential recovery" amount={money(metrics.potential)} note="Open leads only. This is not money in hand." />
        <LedgerRow label="Verified recovered" amount={money(metrics.verified)} note="A posted credit or a refund you confirmed. Counted once." />
        <LedgerRow
          label="Projected annual savings"
          amount={money(metrics.projected)}
          note={metrics.realized > 0 ? `If recorded cancellations hold. ${money(metrics.realized)} has already been observed from a skipped charge.` : "If recorded cancellations hold. This is not a refund."}
        />
        {metrics.pending > 0 ? <Text style={styles.pending}>{money(metrics.pending)} is a merchant reply still waiting on a credit. It is inside potential, and it is not verified.</Text> : null}
      </Card>

      {state.sampleHousehold ? <Text style={styles.sample}>Sample household through April 16, 2026. These are not your accounts, and the bank link is simulated.</Text> : null}

      <Text style={styles.section}>Needs your attention</Text>
      {attention.length === 0 ? <Text style={styles.empty}>Nothing is waiting on you.</Text> : null}
      {attention.map((item) => (
        <Pressable key={item.id} onPress={() => router.push(item.href as never)} style={styles.rowButton}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowDetail}>{item.detail}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Your agent is working on</Text>
      {working.length === 0 ? <Text style={styles.empty}>Nothing is in motion. Open a finding when you want a request drafted.</Text> : null}
      {working.map(({ recoveryCase, opportunity }) => (
        <Pressable key={recoveryCase.id} onPress={() => router.push(`/case/${recoveryCase.id}`)} style={styles.rowButton}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>
              Case #{recoveryCase.caseNumber} — {caseHeadline(recoveryCase, opportunity)}
            </Text>
            <Text style={styles.rowDetail}>
              {opportunity.merchantName} · {money(opportunity.amountEstimate)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

function LedgerRow({ label, amount, note }: { label: string; amount: string; note: string }) {
  return (
    <View style={styles.ledger}>
      <View style={styles.ledgerTop}>
        <Text style={styles.ledgerLabel}>{label}</Text>
        <Text style={styles.ledgerAmount}>{amount}</Text>
      </View>
      <Text style={styles.ledgerNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hello: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  plan: { alignSelf: "flex-start", backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  planText: { fontFamily: fonts.semibold, color: colors.greenDeep, fontSize: 12 },
  ledger: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  ledgerTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  ledgerLabel: { fontFamily: fonts.medium, color: colors.ink, fontSize: 14, flex: 1 },
  ledgerAmount: { fontFamily: fonts.display, color: colors.ink, fontSize: 22 },
  ledgerNote: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  pending: { fontFamily: fonts.body, color: colors.gold, fontSize: 13, lineHeight: 18 },
  sample: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  section: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginTop: 8 },
  empty: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15, lineHeight: 21 },
  rowButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 15 },
  rowDetail: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  chevron: { fontFamily: fonts.display, fontSize: 24, color: colors.inkSoft },
});
