import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";

import { Icon } from "@/components/ui";
import { useApp } from "@/src/store";
import { colors, fonts } from "@/src/theme";

function tint(color: unknown): string {
  return typeof color === "string" ? color : colors.inkSoft;
}

export default function TabLayout() {
  const router = useRouter();
  const { hydrated, state } = useApp();

  useEffect(() => {
    if (!hydrated) return;
    if (state.phase !== "ready") router.replace("/");
  }, [hydrated, router, state.phase]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenDeep,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home",         tabBarIcon: ({ color }) => <Icon name="home" color={tint(color)} size={20} /> }} />
      <Tabs.Screen name="opportunities" options={{ title: "Finds", tabBarIcon: ({ color }) => <Icon name="finds" color={tint(color)} size={20} /> }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarIcon: ({ color }) => <Icon name="inbox" color={tint(color)} size={20} /> }} />
      <Tabs.Screen name="subscriptions" options={{ title: "Plans", tabBarIcon: ({ color }) => <Icon name="plans" color={tint(color)} size={20} /> }} />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: ({ color }) => <Icon name="activity" color={tint(color)} size={20} /> }} />
    </Tabs>
  );
}
