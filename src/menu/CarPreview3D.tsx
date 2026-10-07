import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Suspense, use, useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { CarLook } from "@/rendering/carStyle";
import { loadCarAsset } from "@/rendering/three/loadCarAsset";
import { TurntableScene } from "@/rendering/three/TurntableScene";

import { MENU_COLORS } from "./MenuTheme";

/** Spinning 3D car. Mount only while visible: it renders every frame. */
export function CarPreview3D({ look }: { look: CarLook }) {
  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={MENU_COLORS.textMuted} />
        </View>
      }
    >
      <Turntable look={look} />
    </Suspense>
  );
}

function Turntable({ look }: { look: CarLook }) {
  const asset = use(loadCarAsset());
  const scene = useRef<TurntableScene | null>(null);

  useEffect(() => {
    scene.current?.setLook(look);
  }, [look]);

  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
    },
    [],
  );

  const handleContextCreate = (gl: ExpoWebGLRenderingContext) => {
    scene.current?.dispose();
    scene.current = new TurntableScene(gl, look, asset);
  };

  return <GLView style={styles.view} onContextCreate={handleContextCreate} />;
}

const styles = StyleSheet.create({
  view: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
