import { SymbolView, type SFSymbol } from "expo-symbols";
import { router } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, shadow, text } from "@/src/theme";

const icons = {
  home: { ios: "house.fill", android: "home", web: "home" },
  finds: { ios: "doc.text.magnifyingglass", android: "find_in_page", web: "find_in_page" },
  inbox: { ios: "tray", android: "inbox", web: "inbox" },
  plans: { ios: "repeat", android: "autorenew", web: "autorenew" },
  activity: { ios: "clock", android: "schedule", web: "schedule" },
  settings: { ios: "gearshape", android: "settings", web: "settings" },
  back: { ios: "chevron.left", android: "arrow_back", web: "arrow_back" },
  shield: { ios: "checkmark.shield", android: "verified_user", web: "verified_user" },
} as const;

export function Icon({ name, color = colors.ink, size = 22 }: { name: keyof typeof icons; color?: string; size?: number }) {
  return (
    <SymbolView
      name={icons[name] as unknown as SFSymbol}
      tintColor={color}
      size={size}
      fallback={<Text style={{ color, fontSize: size * 0.7, fontFamily: fonts.semibold }}>•</Text>}
    />
  );
}

export function Screen({
  children,
  footer,
  scroll = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={text.label}>{children}</Text>;
}

export function Title({ children, size = 36 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.12) }]}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={muted ? text.soft : text.body}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" ? styles.primary : tone === "danger" ? styles.danger : styles.secondary,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.buttonText, tone === "primary" || tone === "danger" ? styles.buttonTextLight : styles.buttonTextDark]}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "gold" | "clay" }) {
  return (
    <View style={[styles.pill, tone === "green" ? styles.pillGreen : tone === "gold" ? styles.pillGold : tone === "clay" ? styles.pillClay : styles.pillNeutral]}>
      <Text style={[styles.pillText, tone === "green" ? styles.pillTextGreen : tone === "gold" ? styles.pillTextGold : tone === "clay" ? styles.pillTextClay : styles.pillTextNeutral]}>
        {children}
      </Text>
    </View>
  );
}

export function BackButton({ fallback = "/(tabs)" }: { fallback?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={styles.back}
    >
      <Icon name="back" size={20} />
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, gap: 14 },
  fill: { flex: 1, paddingHorizontal: 22, paddingTop: 12 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  title: { ...text.display, letterSpacing: -0.6 },
  button: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primary: { backgroundColor: colors.greenDeep, ...shadow },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.clay },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.86 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  buttonTextLight: { color: colors.white },
  buttonTextDark: { color: colors.ink },
  textButton: { alignItems: "center", paddingVertical: 8 },
  textButtonLabel: { fontFamily: fonts.medium, color: colors.green, fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillNeutral: { backgroundColor: colors.bgDeep },
  pillGreen: { backgroundColor: colors.greenSoft },
  pillGold: { backgroundColor: colors.goldSoft },
  pillClay: { backgroundColor: colors.claySoft },
  pillText: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.3 },
  pillTextNeutral: { color: colors.inkSoft },
  pillTextGreen: { color: colors.greenDeep },
  pillTextGold: { color: colors.gold },
  pillTextClay: { color: colors.clay },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fieldLabel: { ...text.label, marginBottom: 6 },
});
