import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  desk: "#E4D9C8",
  bg: "#F7F3EC",
  bgDeep: "#EFE6D8",
  card: "#FFFCF8",
  ink: "#1B2822",
  inkSoft: "#5E6C64",
  line: "#E5DACB",
  green: "#1F6B45",
  greenDeep: "#143D2A",
  greenSoft: "#E6F3EB",
  gold: "#8C682C",
  goldSoft: "#F8EED8",
  clay: "#8E4632",
  claySoft: "#F8E7E1",
  white: "#FFFFFF",
};

export const fonts = {
  display: "Fraunces_600SemiBold",
  serif: "Fraunces_500Medium",
  body: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
};

export const text = {
  display: { fontFamily: fonts.display, color: colors.ink } satisfies TextStyle,
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 16, lineHeight: 23 } satisfies TextStyle,
  soft: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15, lineHeight: 22 } satisfies TextStyle,
  medium: { fontFamily: fonts.medium, color: colors.ink } satisfies TextStyle,
  label: {
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  } satisfies TextStyle,
};

export const cardStyle: ViewStyle = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 18,
  padding: 16,
};

export const shadow: ViewStyle =
  Platform.OS === "web"
    ? { boxShadow: "0 18px 50px rgba(48, 36, 18, 0.12)" }
    : {
        shadowColor: "#302412",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
      };
