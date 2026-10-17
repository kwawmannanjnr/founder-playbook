import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { flushSync } from "react-dom";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BackButton, Body, Button, Eyebrow, FieldLabel, Screen, Title } from "@/components/ui";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Signup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { state, dispatch } = useApp();
  const [name, setName] = useState(state.sampleHousehold ? "Jordan Lee" : "");
  const [email, setEmail] = useState(state.sampleHousehold ? "jordan.lee@example.com" : "");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = typeof params.next === "string" ? params.next : undefined;

  function submit() {
    if (name.trim().length < 2 || !email.includes("@")) {
      setError("Enter your name and a real email address.");
      return;
    }
    if (!accepted) {
      setError("Accept the preview terms to continue.");
      return;
    }
    flushSync(() => dispatch({ type: "sign_up", name, email }));
    router.replace(next ? (`/upgrade?next=${encodeURIComponent(next)}` as never) : "/upgrade");
  }

  return (
    <Screen footer={<Button label="Create account" onPress={submit} />}>
      <BackButton fallback="/results" />
      <Eyebrow>Account</Eyebrow>
      <Title size={32}>Save this scan on your device.</Title>
      <Body>The free plan includes the dashboard, opportunity review, and one recovery draft. Payment comes after you have seen a result. This preview stores the profile locally and does not create a server account.</Body>
      <View>
        <FieldLabel>Name</FieldLabel>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" placeholderTextColor={colors.inkSoft} />
      </View>
      <View>
        <FieldLabel>Email</FieldLabel>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com" placeholderTextColor={colors.inkSoft} />
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)} style={styles.checkRow}>
        <View style={[styles.box, accepted ? styles.boxOn : null]}>{accepted ? <Text style={styles.check}>✓</Text> : null}</View>
        <Text style={styles.checkText}>I understand findings are leads, refunds are not guaranteed, and I must approve any request before it is treated as sent.</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, minHeight: 52, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  check: { color: colors.white, fontSize: 14 },
  checkText: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 20 },
  error: { fontFamily: fonts.medium, color: colors.clay },
});
