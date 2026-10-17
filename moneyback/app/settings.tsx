import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { BackButton, Body, Button, Card, Eyebrow, Screen, TextButton, Title } from "@/components/ui";
import { planLabel, shortDate } from "@/src/format";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Settings() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exported, setExported] = useState(false);

  async function exportData() {
    const payload = JSON.stringify(state, null, 2);
    if (Platform.OS === "web") {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "moneyback-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } else {
      await Clipboard.setStringAsync(payload);
    }
    setExported(true);
  }

  return (
    <Screen>
      <BackButton />
      <Eyebrow>Settings</Eyebrow>
      <Title size={32}>Connections, plan, and deletion.</Title>
      <Card>
        <Text style={styles.label}>Profile</Text>
        <Text style={styles.value}>{state.profile?.name ?? "No profile"}</Text>
        <Text style={styles.meta}>{state.profile?.email}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{planLabel(state.plan)}</Text>
        <Text style={styles.meta}>Drafts used on Free: {state.draftsUsed}. This preview does not bill a card.</Text>
        <Button label="Review plans" tone="secondary" onPress={() => router.push("/upgrade")} />
      </Card>
      <Text style={styles.section}>Connections</Text>
      {state.connections.map((connection) => (
        <Card key={connection.id}>
          <Text style={styles.value}>{connection.institutionName}</Text>
          <Text style={styles.meta}>
            {connection.provider === "plaid_preview" ? "Simulated bank link" : connection.provider === "csv" ? "CSV import" : "Sample statement"} · ••{connection.accountMask}
          </Text>
          <Text style={styles.meta}>Scope: {connection.scope}</Text>
          <Text style={styles.meta}>Status: {connection.status}</Text>
          <Text style={styles.meta}>Last sync: {connection.lastSyncAt ? shortDate(connection.lastSyncAt) : "Never"}</Text>
          {connection.status !== "disconnected" ? (
            <Button label="Disconnect" tone="secondary" onPress={() => dispatch({ type: "disconnect", connectionId: connection.id })} />
          ) : (
            <Text style={styles.meta}>Future collection is stopped. Imported rows remain until you delete them.</Text>
          )}
          <Button label="Delete imported records" tone="danger" onPress={() => dispatch({ type: "delete_connection", connectionId: connection.id })} />
        </Card>
      ))}
      {state.connections.length === 0 ? <Body muted>No connection is on file.</Body> : null}
      <Button label="Check imported records again" tone="secondary" onPress={() => dispatch({ type: "sync" })} />
      <Button label="View transactions" tone="secondary" onPress={() => router.push("/transactions")} />
      <Card>
        <Text style={styles.value}>Privacy in this preview</Text>
        <Text style={styles.meta}>Records stay in on-device storage. A production launch still needs legal review of privacy, billing-error deadlines, and consumer communications. Do not put full account numbers into a draft. MoneyBack is not a substitute for a notice your card issuer requires.</Text>
      </Card>
      <Button label={exported ? "Export ready" : "Export my data"} tone="secondary" onPress={exportData} />
      <Button
        label={confirmDelete ? "Delete everything now" : "Delete all account data"}
        tone="danger"
        onPress={() => {
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          dispatch({ type: "delete_all" });
          router.replace("/welcome");
        }}
      />
      <TextButton label="Back to home" onPress={() => router.replace("/(tabs)")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkSoft },
  value: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  section: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
});
