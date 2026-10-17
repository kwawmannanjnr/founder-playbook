import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Body, Button, Card, Eyebrow, Screen, TextButton, Title } from "@/components/ui";
import type { PlanId } from "@/src/model";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const PLANS: Array<{ id: PlanId; name: string; price: string; points: string[] }> = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    points: ["Manual scan", "Opportunity review", "One recovery draft", "Basic dashboard"],
  },
  {
    id: "plus_monthly",
    name: "MoneyBack Plus",
    price: "$12.99/month",
    points: ["Ongoing monitoring in a live build", "Unlimited drafts, fair use", "Case tracking and follow-ups", "Refund verification"],
  },
  {
    id: "plus_annual",
    name: "Annual Plus",
    price: "$99/year",
    points: ["Everything in Plus", "A lower yearly price", "Same approval rules"],
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
      <Title size={32}>Use it free. Upgrade when the tracking is worth it.</Title>
      <Body>No card is charged in this preview. Plus is selected locally so you can see the difference. A production app would use a reviewed billing provider.</Body>
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
