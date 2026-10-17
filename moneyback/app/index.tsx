import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  const { hydrated, state } = useApp();

  useEffect(() => {
    if (!hydrated) return;
    if (state.phase === "ready") router.replace("/(tabs)");
    else if (state.phase === "results") router.replace("/results");
    else router.replace("/welcome");
  }, [hydrated, router, state.phase]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>M</Text>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.bg },
  mark: { fontFamily: fonts.display, fontSize: 42, color: colors.greenDeep },
});
