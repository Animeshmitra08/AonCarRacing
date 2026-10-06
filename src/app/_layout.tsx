import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GameSettingsProvider } from "@/settings/GameSettings";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <GameSettingsProvider>
        <StatusBar hidden />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          {/* No swipe-back mid-race: steering gestures start near the screen edge. */}
          <Stack.Screen name="race" options={{ gestureEnabled: false }} />
        </Stack>
      </GameSettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
