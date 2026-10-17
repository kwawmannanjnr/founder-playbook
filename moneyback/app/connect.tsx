import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { flushSync } from "react-dom";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BackButton, Body, Button, Card, Eyebrow, Screen, Title } from "@/components/ui";
import { parseTransactionCsv } from "@/src/csv";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const BANKS = ["First Harbor Bank", "Northline Credit Union", "Harbor Card"];

export default function Connect() {
  const router = useRouter();
  const { dispatch, loadSample } = useApp();
  const [bankOpen, setBankOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState("date,merchant,amount,status,category,reference\n2026-04-02,Nordstrom,32.00,posted,shopping,ORD-18421\n2026-04-02,Nordstrom,32.00,posted,shopping,ORD-18421\n");
  const [error, setError] = useState<string | null>(null);

  function startSample(mode: "preview_bank" | "sample_file") {
    flushSync(() => loadSample(mode, "results", null));
    router.push("/scan");
  }

  function importCsv(text: string) {
    const parsed = parseTransactionCsv(text, "conn_csv");
    if (parsed.errors.length > 0 || parsed.transactions.length === 0) {
      setError(parsed.errors[0] ?? "No transactions were found.");
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    flushSync(() => {
      dispatch({
        type: "import_transactions",
        connection: {
          id: "conn_csv",
          provider: "csv",
          institutionName: "Uploaded CSV",
          accountMask: "file",
          scope: "One-time file import",
          lastSyncAt: now,
          status: "healthy",
          createdAt: now,
        },
        transactions: parsed.transactions,
      });
    });
    router.push("/scan");
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    const response = await fetch(file.uri);
    const text = await response.text();
    setCsv(text);
    importCsv(text);
  }

  return (
    <Screen>
      <BackButton fallback="/access" />
      <Eyebrow>Import</Eyebrow>
      <Title size={32}>Connect a bank, or bring a statement.</Title>
      <Body>This preview does not collect real bank passwords. A bank connection imports the Jordan Lee sample account so you can try the product.</Body>

      <Card>
        <Text style={styles.choice}>Connect a supported bank</Text>
        <Text style={styles.detail}>Read-only transaction access. You can disconnect it later.</Text>
        <Button label={bankOpen ? "Hide banks" : "Choose a bank"} onPress={() => setBankOpen((open) => !open)} tone="secondary" />
        {bankOpen ? (
          <View style={styles.stack}>
            {BANKS.map((bank) => {
              const available = bank === "First Harbor Bank";
              return (
                <Pressable key={bank} disabled={!available} onPress={() => startSample("preview_bank")} style={[styles.bank, !available ? styles.bankOff : null]}>
                  <Text style={styles.bankName}>{bank}</Text>
                  <Text style={styles.detail}>{available ? "Preview authorization · sample checking ••4821" : "Not connected in this preview"}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.choice}>Upload a transaction CSV</Text>
        <Text style={styles.detail}>One-time scan. Positive amounts are charges. Negative amounts, parentheses, or a CR suffix are credits.</Text>
        <Button label={csvOpen ? "Hide CSV tools" : "Upload or paste a CSV"} onPress={() => setCsvOpen((open) => !open)} tone="secondary" />
        {csvOpen ? (
          <View style={styles.stack}>
            <Button label="Choose a file" onPress={pickFile} tone="secondary" />
            <TextInput multiline value={csv} onChangeText={setCsv} style={styles.input} autoCapitalize="none" autoCorrect={false} />
            <Button label="Scan this CSV" onPress={() => importCsv(csv)} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}
      </Card>

      <Button label="Use the sample statement" onPress={() => startSample("sample_file")} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choice: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  detail: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  stack: { gap: 10, marginTop: 4 },
  bank: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, gap: 2 },
  bankOff: { opacity: 0.55 },
  bankName: { fontFamily: fonts.medium, color: colors.ink, fontSize: 15 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    fontFamily: fonts.body,
    color: colors.ink,
    backgroundColor: colors.bg,
    textAlignVertical: "top",
  },
  error: { fontFamily: fonts.medium, color: colors.clay, fontSize: 14 },
});
