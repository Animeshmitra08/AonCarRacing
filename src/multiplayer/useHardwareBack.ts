import { useEffect } from "react";
import { BackHandler } from "react-native";

/** Routes Android's back button through `onBack` instead of popping the screen. */
export function useHardwareBack(onBack: () => void): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
}
