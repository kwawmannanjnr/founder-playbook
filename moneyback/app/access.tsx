import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BackButton, Body, Button, Card, Eyebrow, Screen, Title } from "@/components/ui";
import { colors, fonts } from "@/src/theme";

const POINTS = [
  ["What is read", "Dates, merchants, amounts, and whether a transaction is pending or posted. Plus notes you add, such as a cancellation date or a refund promise."],
  ["What MoneyBack does", "It looks for recurring charges, possible duplicates, and refund leads. It drafts a request only after you confirm the facts."],
  ["What it will not do", "It does not move money, file a bank dispute, or contact a merchant without a separate approval. This preview never contacts a merchant at all."],
  ["How you stop it", "Disconnect a source to stop future collection. Delete imported records, or delete everything, from Settings."],
];

export default function Access() {
  const router = useRouter();
  return (
    <Screen footer={<Button label="Choose how to import" onPress={() => router.push("/connect")} />}>
      <BackButton fallback="/welcome" />
      <Eyebrow>Data access</Eyebrow>
      <Title size={32}>Only the records you choose to share.</Title>
      <Body>A finding is a lead to review. It is not a guaranteed refund, and this app is not a substitute for a deadline your card issuer requires you to meet.</Body>
      {POINTS.map(([title, body]) => (
        <Card key={title}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardBody}>{body}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 16 },
  cardBody: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15, lineHeight: 21 },
});
