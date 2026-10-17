import { Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AppProvider } from "@/src/store";
import { colors, shadow } from "@/src/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AppProvider>
      <View style={styles.desk}>
        <View style={styles.column}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </View>
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  desk: { flex: 1, backgroundColor: colors.desk, alignItems: "center" },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.bg,
    ...(Platform.OS === "web" ? shadow : null),
  },
});
