import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MENU_COLORS } from "./MenuTheme";

const SWATCH_SIZE = 28;

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ value, min, max, onChange }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <StepButton label="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text style={styles.stepperValue}>{value}</Text>
      <StepButton label="+" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.stepButton, disabled && styles.disabled]}>
      <Text style={styles.stepButtonText}>{label}</Text>
    </Pressable>
  );
}

interface ColorSwatchesProps {
  colors: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function ColorSwatches({ colors, selectedIndex, onChange }: ColorSwatchesProps) {
  return (
    <View style={styles.swatches}>
      {colors.map((color, index) => (
        <Pressable
          key={color}
          onPress={() => onChange(index)}
          style={[styles.swatch, { backgroundColor: color }, index === selectedIndex && styles.swatchSelected]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  segmented: {
    flexDirection: "row",
    backgroundColor: MENU_COLORS.panelRaised,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  segmentActive: { backgroundColor: MENU_COLORS.accent },
  segmentText: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: MENU_COLORS.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepButton: {
    width: 36,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MENU_COLORS.panelRaised,
  },
  stepButtonText: { color: MENU_COLORS.text, fontSize: 20, fontWeight: "900" },
  stepperValue: { color: MENU_COLORS.text, fontSize: 20, fontWeight: "900", minWidth: 20, textAlign: "center" },
  disabled: { opacity: 0.35 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: 3,
    borderColor: "transparent",
  },
  swatchSelected: { borderColor: MENU_COLORS.text },
});
