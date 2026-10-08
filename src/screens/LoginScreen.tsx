import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccount } from "@/account/AccountContext";
import { googleDisplayName, signInWithGoogle } from "@/account/googleAuth";
import { cleanName, randomGuestName } from "@/account/profile";
import { LoginBackground } from "@/login/LoginBackground";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { MAX_NAME_LENGTH } from "@/network/constants";

const SCREEN_PADDING = 20;
const GOOGLE_BLUE = "#4285F4";

/**
 * First screen for a new player. Guest sign-in stores only a display name on the
 * device; Google sign-in uses the Google account's first name (see `@/account/googleAuth`).
 */
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAccount();
  const [name, setName] = useState("");
  const [placeholder] = useState(randomGuestName);
  const [googleBusy, setGoogleBusy] = useState(false);

  const playAsGuest = () => signIn(name.trim() || placeholder);

  const playWithGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (result.type === "success") signIn(googleDisplayName(result.response.data.user), result.response);
    else if (result.type === "error") Alert.alert("Google sign-in failed", result.message);
  };

  return (
    <View style={styles.root}>
      <LoginBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_PADDING,
            paddingBottom: insets.bottom + SCREEN_PADDING,
            paddingLeft: insets.left + SCREEN_PADDING * 2,
            paddingRight: insets.right + SCREEN_PADDING * 2,
          },
        ]}
      >
        <Animated.View entering={FadeInLeft.duration(500)} style={styles.brand}>
          <Text style={styles.title}>
            CAR{"\n"}
            <Text style={styles.titleAccent}>RACING</Text>
          </Text>
          <Text style={styles.tagline}>Street racing with friends, on any Wi-Fi.</Text>
        </Animated.View>

        <Animated.View entering={FadeInRight.duration(500).delay(150)} style={styles.panel}>
          <Text style={styles.panelTitle}>WHO&apos;S DRIVING?</Text>
          <TextInput
            value={name}
            onChangeText={(text) => setName(cleanName(text))}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.4)"
            maxLength={MAX_NAME_LENGTH}
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={playAsGuest}
            style={styles.input}
          />

          <Pressable onPress={playAsGuest} style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}>
            <Ionicons name="play" size={18} color={MENU_COLORS.onHighlight} />
            <Text style={styles.guestText}>PLAY AS GUEST</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={playWithGoogle}
            disabled={googleBusy}
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          >
            {googleBusy ? (
              <ActivityIndicator size="small" color={GOOGLE_BLUE} />
            ) : (
              <Ionicons name="logo-google" size={18} color={GOOGLE_BLUE} />
            )}
            <Text style={styles.googleText}>Sign in with Google</Text>
          </Pressable>

          <View style={styles.noteRow}>
            <Ionicons name="lock-closed" size={12} color={MENU_COLORS.textMuted} />
            <Text style={styles.note}>Your name, settings and scores are stored securely on this device only.</Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05061a" },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24 },
  brand: { flex: 1, gap: 8 },
  title: {
    color: MENU_COLORS.text,
    fontSize: 64,
    lineHeight: 66,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 2,
    textShadowColor: "rgba(255,61,139,0.85)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  titleAccent: { color: "#ffd166" },
  tagline: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
  panel: {
    width: 330,
    padding: 20,
    gap: 12,
    borderRadius: 22,
    backgroundColor: "rgba(8,9,26,0.78)",
    borderWidth: 1,
    borderColor: "rgba(62,240,255,0.35)",
  },
  panelTitle: { color: MENU_COLORS.text, fontSize: 18, fontWeight: "900", fontStyle: "italic", letterSpacing: 1.5 },
  input: {
    color: MENU_COLORS.text,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: "800",
  },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: MENU_COLORS.highlight,
  },
  guestText: { color: MENU_COLORS.onHighlight, fontSize: 17, fontWeight: "900", letterSpacing: 1.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  dividerText: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  googleText: { color: "#1f1f1f", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  note: { flex: 1, color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "600" },
});
