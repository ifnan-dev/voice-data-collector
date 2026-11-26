import React from "react";
import { View } from "react-native";

/**
 * Local stand-in for `react-native-gesture-handler`.
 *
 * The installed dev client was built with an older native gesture-handler than
 * the JS package (2.33.1), so the native `RNGestureHandlerModule.install()`
 * method is missing and any `GestureHandlerRootView` render crashes the app.
 * `@react-navigation/stack` renders `GestureHandlerRootView` internally, so we
 * alias the whole module to this shim (see metro.config.js) to keep navigation
 * working without the native module.
 *
 * Trade-off: swipe-back / pinch / pan gestures are disabled. Buttons and normal
 * navigation still work. To restore real gestures, rebuild the dev client with a
 * matching gesture-handler (`npx expo install react-native-gesture-handler`,
 * then a fresh `development` build) and delete metro.config.js + this shim.
 */

type AnyProps = Record<string, unknown>;

export const GestureHandlerRootView = React.forwardRef<View, AnyProps>(
  ({ children, style }, ref) => (
    <View ref={ref} style={[{ flex: 1 }, style as never]}>
      {children}
    </View>
  ),
);

export const PanGestureHandler = React.forwardRef<View, AnyProps>(
  ({ children, style }, ref) => (
    <View ref={ref} style={[{ flex: 1 }, style as never]}>
      {children}
    </View>
  ),
);

// Minimal no-op exports so any transitive named import still resolves.
export const GestureDetector = ({ children }: { children?: React.ReactNode }) =>
  <>{children}</>;
export const NativeViewGestureHandler = React.forwardRef<View, AnyProps>(
  ({ children, style }, ref) => (
    <View ref={ref} style={[{ flex: 1 }, style as never]}>
      {children}
    </View>
  ),
);

export const Directions = { UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4 };
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};
export const PointerType = { TOUCH: 0, STYLUS: 1, MOUSE: 2, KEY: 3, OTHER: 4 };
export const MouseButton = { LEFT: 0, RIGHT: 1, MIDDLE: 2, BUTTON_4: 3, BUTTON_5: 4, ALL: 5 };

export function gestureHandlerRootHOC<T>(Component: React.ComponentType<T>) {
  return Component;
}

export function createNativeWrapper<P = object>(
  Component: React.ComponentType<P>,
  _config: unknown = {},
) {
  return Component;
}

export function enableExperimentalWebImplementation() {}
export function enableLegacyWebImplementation() {}

export default {};