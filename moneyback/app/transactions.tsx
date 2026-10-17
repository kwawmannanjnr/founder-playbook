import { StyleSheet, Text, View } from "react-native";

import { BackButton, Body, Eyebrow, Pill, Screen, Title } from "@/components/ui";
import { money, monthLabel, shortDate } from "@/src/format";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Transactions() {
  const { state } = useApp();
  const ordered = [...state.transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const groups = new Map<string, typeof ordered>();
  for (const transaction of ordered) {
    const key = transaction.occurredAt.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(transaction);
    groups.set(key, list);
  }

  return (
    <Screen>
      <BackButton fallback="/settings" />
      <Eyebrow>Transactions</Eyebrow>
      <Title size={32}>{ordered.length} normalized records.</Title>
      <Body muted>Pending authorizations stay separate from posted charges. A pending hold and the later posted amount are not treated as a duplicate.</Body>
      {[...groups.entries()].map(([key, transactions]) => (
        <View key={key} style={styles.group}>
          <Text style={styles.month}>{monthLabel(transactions[0].occurredAt)}</Text>
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.merchant}>{transaction.merchantName}</Text>
                <Text style={styles.meta}>
                  {shortDate(transaction.occurredAt)}
                  {transaction.reference ? ` · ${transaction.reference}` : ""}
                </Text>
              </View>
              <View style={styles.side}>
                <Text style={[styles.amount, transaction.direction === "credit" ? styles.credit : null]}>
                  {transaction.direction === "credit" ? "+" : "−"}
                  {money(transaction.amount)}
                </Text>
                <Pill tone={transaction.status === "pending" ? "gold" : "neutral"}>{transaction.status}</Pill>
              </View>
            </View>
          ))}
        </View>
      ))}
      {ordered.length === 0 ? <Body>No transactions imported.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  month: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  copy: { flex: 1, gap: 2 },
  merchant: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  side: { alignItems: "flex-end", gap: 4 },
  amount: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  credit: { color: colors.green },
});
