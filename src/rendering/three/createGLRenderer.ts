import type { ExpoWebGLRenderingContext } from "expo-gl";
import { WebGLRenderer } from "three";

/**
 * Creates a three.js renderer on an expo-gl context.
 *
 * The context is handed over through a fake canvas's `getContext()` rather than
 * the `context` option: expo-gl's WebGL2 context passes `instanceof
 * WebGLRenderingContext`, which three (r163+) rejects as WebGL 1.
 */
export function createGLRenderer(gl: ExpoWebGLRenderingContext): WebGLRenderer {
  silenceUnsupportedPixelStore(gl);

  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const canvas = {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;

  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  // The drawing buffer is already in physical pixels.
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  return renderer;
}

/** expo-gl only implements these two; anything else logs a warning on every call. */
function silenceUnsupportedPixelStore(gl: ExpoWebGLRenderingContext): void {
  const pixelStorei = gl.pixelStorei.bind(gl);
  gl.pixelStorei = (pname: number, param: number | boolean) => {
    if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) pixelStorei(pname, param);
  };
}
