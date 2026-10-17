import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Body, Button, Card, Eyebrow, Screen, TextButton, Title } from "@/components/ui";
import type { PlanId } from "@/src/model";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const PLANS: Array<{ id: PlanId; name: string; price: string; points: string[] }> = [
  {
    id: "free",
    name: "Free scan",
    price: "$0",
    points: ["One-time money scan", "Opportunity review", "One recovery draft", "Basic dashboard"],
  },
  {
    id: "pro",
    name: "MoneyBack Pro",
    price: "$14.99/month",
    points: ["Ongoing protection after the first recovery", "Unlimited drafts, fair use", "Case tracking, follow-ups, and refund verification", "Price-change and recurring-bill monitoring in a live build"],
  },
  {
    id: "family",
    name: "MoneyBack Family",
    price: "$24.99/month",
    points: ["Household subscriptions and shared protection", "Everything in Pro", "Same approval rules for every request", "Shared member logins are not in this preview"],
  },
];

export default function Upgrade() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { state, dispatch } = useApp();
  const next = typeof params.next === "string" ? params.next : "/(tabs)";

  function choose(plan: PlanId) {
    dispatch({ type: "set_plan", plan });
    router.replace(next as never);
  }

  return (
    <Screen>
      <Eyebrow>Plans</Eyebrow>
      <Title size={32}>Pay for protection, not for a single refund.</Title>
      <Body>The free scan shows whether anything looks recoverable. Pro and Family are the ongoing agent. Prices match the $14.99 and $24.99 plan mix. No card is charged in this preview, and an annual discount is not offered here because it would lower realized monthly revenue.</Body>
      {PLANS.map((plan) => {
        const selected = state.plan === plan.id;
        return (
          <Pressable key={plan.id} onPress={() => choose(plan.id)}>
            <Card style={selected ? styles.selected : undefined}>
              <View style={styles.row}>
                <Text style={styles.name}>{plan.name}</Text>
                <Text style={styles.price}>{plan.price}</Text>
              </View>
              {plan.points.map((point) => (
                <Text key={point} style={styles.point}>
                  {point}
                </Text>
              ))}
              <Text style={styles.action}>{selected ? "Current plan" : plan.id === "free" ? "Continue on Free" : "Select in this preview"}</Text>
            </Card>
          </Pressable>
        );
      })}
      <Button label="Continue" onPress={() => router.replace(next as never)} />
      <TextButton label="Stay on Free" onPress={() => choose("free")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selected: { borderColor: colors.green },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  price: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  point: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14 },
  action: { fontFamily: fonts.medium, color: colors.green, marginTop: 4 },
});
