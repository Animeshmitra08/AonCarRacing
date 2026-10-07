import { Accelerometer } from "expo-sensors";
import { useEffect, useEffectEvent, useState } from "react";

import { steeringFromGravity, TILT, TILT_FULL_LOCK, type TiltSensitivity } from "./tiltSteering";

export type TiltStatus = "off" | "starting" | "active" | "unavailable";

/**
 * Streams tilt steering (-1..1) to `onSteer` while `enabled`. Runs on the JS thread
 * at ~60 Hz and never touches React state per sample.
 */
export function useTiltSteering(
  enabled: boolean,
  sensitivity: TiltSensitivity,
  onSteer: (steering: number) => void,
): TiltStatus {
  const [availability, setAvailability] = useState<Exclude<TiltStatus, "off">>("starting");
  const steer = useEffectEvent(onSteer);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    const fullLock = TILT_FULL_LOCK[sensitivity];
    const gravity = { x: 0, y: 0, ready: false, lastTimestamp: 0 };

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        if (!available) {
          setAvailability("unavailable");
          return;
        }
        Accelerometer.setUpdateInterval(TILT.updateIntervalMs);
        subscription = Accelerometer.addListener(({ x, y, timestamp }) => {
          // Low-pass filter: keeps gravity, drops bumps and hand jitter.
          const dt = gravity.ready ? Math.max(0, timestamp - gravity.lastTimestamp) : 0;
          const blend = gravity.ready ? 1 - Math.exp(-TILT.smoothingRate * dt) : 1;
          gravity.x += (x - gravity.x) * blend;
          gravity.y += (y - gravity.y) * blend;
          gravity.ready = true;
          gravity.lastTimestamp = timestamp;
          steer(steeringFromGravity(gravity.x, gravity.y, fullLock));
        });
        setAvailability("active");
      })
      .catch(() => {
        if (!cancelled) setAvailability("unavailable");
      });

    return () => {
      cancelled = true;
      subscription?.remove();
      steer(0);
    };
  }, [enabled, sensitivity]);

  return enabled ? availability : "off";
}
