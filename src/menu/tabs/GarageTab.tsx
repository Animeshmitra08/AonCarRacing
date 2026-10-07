import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CarPreview3D } from "@/menu/CarPreview3D";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { ColorSwatches, SettingRow } from "@/menu/SettingControls";
import {
  ACCENT_OPTIONS,
  CALIPER_OPTIONS,
  RIM_OPTIONS,
  resolveCarLook,
  type CarStyle,
  type StyleOption,
} from "@/rendering/carStyle";
import { CAR_COLORS } from "@/rendering/RenderConstants";
import { useGameSettings } from "@/settings/GameSettings";

interface GarageTabProps {
  /** False while another screen (e.g. a race) is on top, so the preview stops rendering. */
  visible: boolean;
}

export function GarageTab({ visible }: GarageTabProps) {
  const { settings, updateSettings } = useGameSettings();
  const { carColorIndex, carStyle } = settings;
  const look = useMemo(() => resolveCarLook(carColorIndex, carStyle), [carColorIndex, carStyle]);
  const paint = look.paint;
  const setStyle = (patch: Partial<CarStyle>) => updateSettings({ carStyle: { ...carStyle, ...patch } });

  return (
    <View style={styles.root}>
      <View style={styles.preview}>{visible && <CarPreview3D look={look} />}</View>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>YOUR CAR</Text>
        <SettingRow label="PAINT">
          <ColorSwatches
            colors={CAR_COLORS}
            selectedIndex={carColorIndex}
            onChange={(index) => updateSettings({ carColorIndex: index })}
          />
        </SettingRow>
        <StyleRow
          label="ACCENT"
          options={ACCENT_OPTIONS}
          paint={paint}
          selected={carStyle.accent}
          onChange={(accent) => setStyle({ accent })}
        />
        <StyleRow
          label="RIMS"
          options={RIM_OPTIONS}
          paint={paint}
          selected={carStyle.rims}
          onChange={(rims) => setStyle({ rims })}
        />
        <StyleRow
          label="BRAKE CALIPERS"
          options={CALIPER_OPTIONS}
          paint={paint}
          selected={carStyle.calipers}
          onChange={(calipers) => setStyle({ calipers })}
        />
        <Text style={styles.hint}>Other players see your car exactly like this in multiplayer.</Text>
      </ScrollView>
    </View>
  );
}

interface StyleRowProps {
  label: string;
  options: readonly StyleOption[];
  paint: string;
  selected: number;
  onChange: (index: number) => void;
}

function StyleRow({ label, options, paint, selected, onChange }: StyleRowProps) {
  return (
    <SettingRow label={`${label} · ${options[selected].label.toUpperCase()}`}>
      <ColorSwatches colors={options.map((o) => o.color ?? paint)} selectedIndex={selected} onChange={onChange} />
    </SettingRow>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", gap: 16 },
  preview: { flex: 1.6, borderRadius: 16, overflow: "hidden", backgroundColor: MENU_COLORS.panel },
  panel: { flex: 1, maxWidth: 320, borderRadius: 16, backgroundColor: MENU_COLORS.panel },
  panelContent: { padding: 16, gap: 14 },
  title: { color: MENU_COLORS.text, fontSize: 18, fontWeight: "900", fontStyle: "italic" },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
});
