import { StyleSheet, Text, View } from "react-native";

import { Body, Eyebrow, Screen, Title } from "@/components/ui";
import { shortDate } from "@/src/format";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Activity() {
  const { state } = useApp();

  return (
    <Screen>
      <Eyebrow>Activity</Eyebrow>
      <Title size={32}>What happened, and who did it.</Title>
      <Body muted>Approvals, imports, dismissals, and verified refunds stay in this history.</Body>
      {state.actions.length === 0 ? <Body>No activity yet.</Body> : null}
      {state.actions.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.marker} />
          <View style={styles.copy}>
            <Text style={styles.action}>{entry.action}</Text>
            <Text style={styles.detail}>{entry.detail}</Text>
            <Text style={styles.meta}>
              {entry.actor} · {shortDate(entry.at)}
              {entry.approvalId ? ` · approval ${entry.approvalId}` : ""}
            </Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  marker: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 6 },
  copy: { flex: 1, gap: 3, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  action: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 15 },
  detail: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: fonts.medium, color: colors.inkSoft, fontSize: 12, textTransform: "capitalize" },
});
