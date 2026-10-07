import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LoadingScreen } from "@/loading/LoadingScreen";
import { MultiplayerProvider } from "@/multiplayer/MultiplayerContext";
import { GameSettingsProvider } from "@/settings/GameSettings";

// Keep the native splash up until the loading screen has painted (it hides it).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  return (
    <GestureHandlerRootView style={styles.root}>
      <GameSettingsProvider>
        <MultiplayerProvider>
          <StatusBar hidden />
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            {/* No swipe-back mid-race: steering gestures start near the screen edge. */}
            <Stack.Screen name="race" options={{ gestureEnabled: false }} />
            {/* Room screens must be left via their buttons so the room is closed properly. */}
            <Stack.Screen name="multiplayer/lobby" options={{ gestureEnabled: false }} />
            <Stack.Screen name="multiplayer/race" options={{ gestureEnabled: false }} />
          </Stack>
          {/* Overlays the app (which mounts underneath) until assets are loaded. */}
          {loading && <LoadingScreen onFinished={() => setLoading(false)} />}
        </MultiplayerProvider>
      </GameSettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
