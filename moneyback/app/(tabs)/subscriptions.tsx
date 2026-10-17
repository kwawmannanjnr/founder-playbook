import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Body, Button, Eyebrow, Screen, Title } from "@/components/ui";
import { frequencyLabel, money, shortDate } from "@/src/format";
import type { UserPreference } from "@/src/model";
import { isOpenStatus } from "@/src/model";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

const PREFERENCES: UserPreference[] = ["essential", "wanted", "unwanted", "unknown"];

export default function Subscriptions() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [effectiveOn, setEffectiveOn] = useState("2026-04-01");
  const [confirmation, setConfirmation] = useState("");

  return (
    <Screen>
      <Eyebrow>Subscriptions</Eyebrow>
      <Title size={32}>Repeating charges are not automatically waste.</Title>
      <Body muted>Mark what you want to keep. A cancellation you record can reveal a later charge, or a projected saving if the charge stops.</Body>
      {state.streams.map((stream) => {
        const related = state.opportunities.find(
          (opportunity) =>
            opportunity.merchantId === stream.merchantId &&
            (opportunity.type === "unwanted_subscription" || opportunity.type === "post_cancellation_charge") &&
            isOpenStatus(opportunity.status),
        );
        return (
          <View key={stream.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{stream.merchantName}</Text>
              <Text style={styles.amount}>{money(stream.expectedAmount)}</Text>
            </View>
            <Text style={styles.meta}>
              {frequencyLabel(stream.frequency)} · {Math.round(stream.confidence * 100)}% recurring confidence
            </Text>
            <Text style={styles.meta}>Last charge {shortDate(stream.lastChargeAt)}</Text>
            <Text style={styles.meta}>
              Next window {shortDate(stream.nextWindowStart)} – {shortDate(stream.nextWindowEnd)}
            </Text>
            {stream.cancellation ? (
              <Text style={styles.meta}>
                Cancellation recorded {shortDate(stream.cancellation.effectiveOn)}
                {stream.cancellation.confirmation ? ` · ${stream.cancellation.confirmation}` : " · no confirmation number"}
              </Text>
            ) : null}
            <View style={styles.prefs}>
              {PREFERENCES.map((preference) => (
                <Pressable
                  key={preference}
                  onPress={() => dispatch({ type: "set_preference", streamId: stream.id, preference })}
                  style={[styles.pref, stream.userPreference === preference ? styles.prefOn : null]}
                >
                  <Text style={[styles.prefText, stream.userPreference === preference ? styles.prefTextOn : null]}>{preference}</Text>
                </Pressable>
              ))}
            </View>
            {related ? (
              <Pressable onPress={() => router.push(`/opportunity/${related.id}`)}>
                <Text style={styles.link}>Review the related finding</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setOpenId(openId === stream.id ? null : stream.id)}>
              <Text style={styles.link}>{openId === stream.id ? "Hide cancellation form" : "I canceled this"}</Text>
            </Pressable>
            {openId === stream.id ? (
              <View style={styles.form}>
                <TextInput value={effectiveOn} onChangeText={setEffectiveOn} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkSoft} />
                <TextInput value={confirmation} onChangeText={setConfirmation} style={styles.input} placeholder="Confirmation number, if you have one" placeholderTextColor={colors.inkSoft} />
                <Button
                  label="Save cancellation"
                  onPress={() => {
                    dispatch({ type: "record_cancellation", streamId: stream.id, effectiveOn, confirmation });
                    setOpenId(null);
                    setConfirmation("");
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {state.streams.length === 0 ? <Body>No recurring pattern has enough history yet. Three similar posted charges are required.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, flex: 1 },
  amount: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  meta: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  prefs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pref: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6 },
  prefOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  prefText: { fontFamily: fonts.medium, color: colors.ink, fontSize: 12, textTransform: "capitalize" },
  prefTextOn: { color: colors.white },
  link: { fontFamily: fonts.medium, color: colors.green, fontSize: 14, marginTop: 4 },
  form: { gap: 8, marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontFamily: fonts.body, color: colors.ink, backgroundColor: colors.bg },
});
