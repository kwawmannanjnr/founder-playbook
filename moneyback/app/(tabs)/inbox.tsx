import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Body, Eyebrow, Screen, Title } from "@/components/ui";
import { inboxItems } from "@/src/selectors";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Inbox() {
  const router = useRouter();
  const { state } = useApp();
  const items = inboxItems(state);

  return (
    <Screen>
      <Eyebrow>Agent inbox</Eyebrow>
      <Title size={32}>Questions and approvals land here.</Title>
      <Body muted>MoneyBack prepares the next step. It does not take an irreversible action from this list.</Body>
      {items.length === 0 ? <Body>The inbox is clear.</Body> : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => {
            if (item.caseId) router.push(`/case/${item.caseId}`);
            else if (item.opportunityId) router.push(`/opportunity/${item.opportunityId}`);
          }}
        >
          <Text style={styles.eyebrow}>{item.eyebrow}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 6 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.gold },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  detail: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
});
