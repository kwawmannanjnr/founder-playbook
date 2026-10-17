import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/src/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found", headerShown: false }} />
      <View style={styles.wrap}>
        <Text style={styles.title}>That screen is not in MoneyBack.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to the start</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.bg, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: "center" },
  link: { padding: 12 },
  linkText: { fontFamily: fonts.medium, color: colors.green, fontSize: 16 },
});
