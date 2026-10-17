import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OpportunityCard } from "@/components/OpportunityCard";
import { Body, Eyebrow, Screen, Title } from "@/components/ui";
import type { OpportunityStatus } from "@/src/model";
import { isOpenStatus } from "@/src/model";
import { sortedOpportunities } from "@/src/selectors";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const FILTERS = ["Open", "In progress", "Done", "All"] as const;

export default function Opportunities() {
  const router = useRouter();
  const { state } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Open");
  const items = sortedOpportunities(state).filter((opportunity) => matches(opportunity.status, filter));

  return (
    <Screen>
      <Eyebrow>Opportunities</Eyebrow>
      <Title size={32}>Worth a look, with the evidence attached.</Title>
      <Body muted>Dismiss anything that is not a real problem. A closed finding stays out of potential recovery.</Body>
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item ? styles.filterOn : null]}>
            <Text style={[styles.filterText, filter === item ? styles.filterTextOn : null]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {items.length === 0 ? <Body>Nothing in this view.</Body> : null}
      {items.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} onPress={() => router.push(`/opportunity/${opportunity.id}`)} />
      ))}
    </Screen>
  );
}

function matches(status: OpportunityStatus, filter: (typeof FILTERS)[number]): boolean {
  if (filter === "All") return true;
  if (filter === "Open") return isOpenStatus(status);
  if (filter === "In progress") return status === "in_progress";
  return status === "recovered" || status === "unsuccessful" || status === "closed";
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.card },
  filterOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  filterText: { fontFamily: fonts.medium, color: colors.ink, fontSize: 13 },
  filterTextOn: { color: colors.white },
});
