import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Eyebrow, Screen, Title } from "@/components/ui";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const STAGES = [
  ["Importing transactions", "Reading posted and pending activity."],
  ["Identifying recurring payments", "Looking for a merchant, amount, and schedule that repeat."],
  ["Checking potential duplicates", "Skipping authorizations, tips, and separate order numbers."],
  ["Reviewing refund opportunities", "Comparing cancellations, promises, and credits you can support."],
  ["Building recovery recommendations", "Keeping the reason and the evidence on every finding."],
];

export default function Scan() {
  const router = useRouter();
  const { state } = useApp();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (state.transactions.length === 0) {
      const timer = setTimeout(() => router.replace("/connect"), 600);
      return () => clearTimeout(timer);
    }
    if (step >= STAGES.length) {
      const timer = setTimeout(() => router.replace("/results"), 400);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setStep((current) => current + 1), 700);
    return () => clearTimeout(timer);
  }, [router, state.transactions.length, step]);

  const progress = Math.min(step, STAGES.length) / STAGES.length;

  return (
    <Screen>
      <Eyebrow>Financial scan</Eyebrow>
      <Title size={32}>Looking through {state.transactions.length} transactions.</Title>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      {STAGES.map(([title, detail], index) => {
        const done = index < step;
        const active = index === step;
        return (
          <Card key={title} style={active ? styles.active : undefined}>
            <Text style={[styles.stage, done || active ? styles.stageOn : null]}>{done ? "Done" : active ? "Now" : "Next"}</Text>
            <Text style={styles.stageTitle}>{title}</Text>
            <Text style={styles.stageDetail}>{detail}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 99, backgroundColor: colors.bgDeep, overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.green },
  active: { borderColor: colors.green },
  stage: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkSoft },
  stageOn: { color: colors.green },
  stageTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  stageDetail: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
});
