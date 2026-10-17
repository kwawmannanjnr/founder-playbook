import { useRouter } from "expo-router";
import { flushSync } from "react-dom";
import { StyleSheet, Text, View } from "react-native";

import { Body, Button, Card, Eyebrow, Screen, TextButton, Title } from "@/components/ui";
import { DEMO_AS_OF } from "@/src/model";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const EXAMPLES = [
  ["$32", "Duplicate charge, same order reference"],
  ["$24.99", "Charge after a recorded cancellation"],
  ["$48", "Promised refund with no credit posted"],
];

export default function Welcome() {
  const router = useRouter();
  const { loadSample } = useApp();

  return (
    <Screen
      footer={
        <>
          <Button label="Find My Money" onPress={() => router.push("/access")} />
          <TextButton
            label="Preview the sample dashboard"
            onPress={() => {
              flushSync(() => {
                loadSample("preview_bank", "ready", {
                  name: "Jordan Lee",
                  email: "jordan.lee@example.com",
                  createdAt: DEMO_AS_OF,
                });
              });
              router.replace("/(tabs)");
            }}
          />
        </>
      }
    >
      <View style={styles.markRow}>
        <View style={styles.mark}>
          <Text style={styles.markText}>M</Text>
        </View>
        <Eyebrow>MoneyBack AI</Eyebrow>
      </View>
      <Title>Check if companies owe you money.</Title>
      <Body>MoneyBack AI is a financial protection agent. It finds billing mistakes, forgotten subscriptions, and potential refunds, then keeps watching so the next one does not slip past.</Body>
      <Card>
        <Text style={styles.cardLabel}>From a sample household, not a promise</Text>
        {EXAMPLES.map(([amount, label]) => (
          <View key={label} style={styles.example}>
            <Text style={styles.exampleAmount}>{amount}</Text>
            <Text style={styles.exampleLabel}>{label}</Text>
          </View>
        ))}
      </Card>
      <View style={styles.rules}>
        <Text style={styles.rule}>Evidence is attached to every finding.</Text>
        <Text style={styles.rule}>You approve every recovery request.</Text>
        <Text style={styles.rule}>Nothing counts as recovered until it is verified.</Text>
        <Text style={styles.rule}>A subscription is for ongoing protection, not a single refund.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  markRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  mark: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.greenDeep, alignItems: "center", justifyContent: "center" },
  markText: { color: colors.white, fontFamily: fonts.display, fontSize: 22 },
  cardLabel: { fontFamily: fonts.medium, color: colors.inkSoft, fontSize: 13 },
  example: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  exampleAmount: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, width: 78 },
  exampleLabel: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 19 },
  rules: { gap: 8, marginTop: 4 },
  rule: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
});
