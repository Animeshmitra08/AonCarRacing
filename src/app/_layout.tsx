import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AccountProvider, useAccount } from "@/account/AccountContext";
import { LoadingScreen } from "@/loading/LoadingScreen";
import type { PlayerData } from "@/loading/loadPlayerData";
import { MultiplayerProvider } from "@/multiplayer/MultiplayerContext";
import { ScoresProvider } from "@/scores/ScoresContext";
import { GameSettingsProvider } from "@/settings/GameSettings";

// Keep the native splash up until the loading screen has painted (it hides it).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Saved data must be read before the app mounts, so the first screen is the right one.
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      {playerData && (
        <AccountProvider initial={playerData.profile}>
          <GameSettingsProvider initial={playerData.settings}>
            <ScoresProvider initial={playerData.scores}>
              <MultiplayerProvider>
                <AppStack />
              </MultiplayerProvider>
            </ScoresProvider>
          </GameSettingsProvider>
        </AccountProvider>
      )}
      {/* Overlays the app (mounted underneath once data is ready) until assets are loaded. */}
      {loading && <LoadingScreen onLoaded={setPlayerData} onFinished={() => setLoading(false)} />}
    </GestureHandlerRootView>
  );
}

/** Signed out: only the login screen exists. Signed in: the game. Switching re-routes automatically. */
function AppStack() {
  const { profile } = useAccount();
  const signedIn = profile !== null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        {/* No swipe-back mid-race: steering gestures start near the screen edge. */}
        <Stack.Screen name="race" options={{ gestureEnabled: false }} />
        <Stack.Screen name="multiplayer/index" />
        {/* Room screens must be left via their buttons so the room is closed properly. */}
        <Stack.Screen name="multiplayer/lobby" options={{ gestureEnabled: false }} />
        <Stack.Screen name="multiplayer/race" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
