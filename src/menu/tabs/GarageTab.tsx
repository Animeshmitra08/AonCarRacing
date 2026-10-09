import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { CarPreview3D } from "@/menu/CarPreview3D";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { ColorSwatches, SettingRow } from "@/menu/SettingControls";
import { CAR_MODELS, carModelAt } from "@/rendering/carCatalog";
import {
  ACCENT_OPTIONS,
  CALIPER_OPTIONS,
  GLASS_OPTIONS,
  LIGHT_OPTIONS,
  resolveCarLook,
  RIM_OPTIONS,
  TRIM_OPTIONS,
  type CarStyle,
  type StyleOption,
} from "@/rendering/carStyle";
import { CAR_COLORS } from "@/rendering/RenderConstants";
import { useGameSettings } from "@/settings/GameSettings";

interface GarageTabProps {
  /** False while another screen (e.g. a race) is on top, so the preview stops rendering. */
  visible: boolean;
}

type StylePart = Exclude<keyof CarStyle, "model">;

/** With a single car there's nothing to cycle through. */
const CAN_PICK_MODEL = CAR_MODELS.length > 1;

/** Every recolourable detail, in the order shown. */
const PARTS: readonly { key: StylePart; label: string; options: readonly StyleOption[] }[] = [
  { key: "accent", label: "ACCENT · ROOF, SILLS, WING", options: ACCENT_OPTIONS },
  { key: "trim", label: "TRIM · GRILLE & LOWER BODY", options: TRIM_OPTIONS },
  { key: "rims", label: "RIMS", options: RIM_OPTIONS },
  { key: "calipers", label: "BRAKE CALIPERS", options: CALIPER_OPTIONS },
  { key: "glass", label: "WINDOW TINT", options: GLASS_OPTIONS },
  { key: "lights", label: "HEADLIGHTS", options: LIGHT_OPTIONS },
];

export function GarageTab({ visible }: GarageTabProps) {
  const { settings, updateSettings } = useGameSettings();
  const { carColorIndex, carStyle } = settings;
  const look = useMemo(() => resolveCarLook(carColorIndex, carStyle), [carColorIndex, carStyle]);
  const car = carModelAt(carStyle.model);
  const setStyle = (patch: Partial<CarStyle>) => updateSettings({ carStyle: { ...carStyle, ...patch } });
  const cycleModel = (step: number) =>
    setStyle({ model: (carStyle.model + step + CAR_MODELS.length) % CAR_MODELS.length });

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        {visible && <CarPreview3D look={look} />}
        <View style={styles.modelBar}>
          {CAN_PICK_MODEL && <ArrowButton icon="chevron-back" onPress={() => cycleModel(-1)} />}
          <Animated.View key={car.id} entering={FadeIn.duration(200)} style={styles.modelInfo}>
            <Text style={styles.modelName}>{car.name.toUpperCase()}</Text>
            <Text style={styles.modelTagline}>
              {car.tagline}
              {CAN_PICK_MODEL && ` · ${carStyle.model + 1}/${CAR_MODELS.length}`}
            </Text>
          </Animated.View>
          {CAN_PICK_MODEL && <ArrowButton icon="chevron-forward" onPress={() => cycleModel(1)} />}
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <SettingRow label="PAINT">
          <ColorSwatches
            colors={CAR_COLORS}
            selectedIndex={carColorIndex}
            onChange={(index) => updateSettings({ carColorIndex: index })}
          />
        </SettingRow>
        {PARTS.map((part) => (
          <SettingRow key={part.key} label={`${part.label} · ${part.options[carStyle[part.key]].label.toUpperCase()}`}>
            <ColorSwatches
              colors={part.options.map((o) => o.color ?? look.paint)}
              selectedIndex={carStyle[part.key]}
              onChange={(index) => setStyle({ [part.key]: index })}
            />
          </SettingRow>
        ))}
        <Text style={styles.hint}>Other players see your car exactly like this in multiplayer.</Text>
      </ScrollView>
    </View>
  );
}

function ArrowButton({ icon, onPress }: { icon: "chevron-back" | "chevron-forward"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={MENU_COLORS.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", gap: 16 },
  preview: { flex: 1.6, borderRadius: 16, overflow: "hidden", backgroundColor: MENU_COLORS.panel },
  modelBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    pointerEvents: "box-none",
  },
  modelInfo: { flex: 1, alignItems: "center", pointerEvents: "none" },
  modelName: { color: MENU_COLORS.text, fontSize: 20, fontWeight: "900", fontStyle: "italic", letterSpacing: 1.5 },
  modelTagline: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pressed: { opacity: 0.6 },
  panel: { flex: 1, maxWidth: 330, borderRadius: 16, backgroundColor: MENU_COLORS.panel },
  panelContent: { padding: 16, gap: 14 },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
});
