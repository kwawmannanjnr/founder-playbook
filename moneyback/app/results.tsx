import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { OpportunityCard } from "@/components/OpportunityCard";
import { Body, Button, Card, Eyebrow, Screen, Title } from "@/components/ui";
import { money } from "@/src/format";
import { isOpenStatus } from "@/src/model";
import { metricsOf } from "@/src/selectors";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Results() {
  const router = useRouter();
  const { state } = useApp();
  const open = state.opportunities.filter((opportunity) => isOpenStatus(opportunity.status));
  const metrics = metricsOf(state);
  const noun = open.length === 1 ? "opportunity" : "opportunities";

  return (
    <Screen
      footer={
        <Button
          label={state.profile ? "Go to the dashboard" : "Create my free account"}
          onPress={() => router.push(state.profile ? "/(tabs)" : "/signup")}
        />
      }
    >
      <Eyebrow>Results</Eyebrow>
      <Title size={32}>{open.length > 0 ? `We found ${open.length} ${noun} worth reviewing.` : "No evidence-backed opportunity turned up."}</Title>
      <Body>
        Estimated value is shown only where the import supports it. Potential recovery is {money(metrics.potential)}. That is not money you have recovered.
      </Body>
      {metrics.verified > 0 ? (
        <Card>
          <Text style={styles.note}>
            {money(metrics.verified)} is already verified from a matching posted credit. It is counted once, and it is not included in the potential figure.
          </Text>
        </Card>
      ) : null}
      {open.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} onPress={() => router.push(`/opportunity/${opportunity.id}`)} />
      ))}
      {open.length === 0 ? <Body muted>You can still review recurring payments after you create an account. A repeat charge is not treated as waste by itself.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, color: colors.ink, fontSize: 15, lineHeight: 21 },
});
