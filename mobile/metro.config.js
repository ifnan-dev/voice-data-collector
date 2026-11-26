const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The installed dev client's native gesture-handler is older than the JS
// package, so the native RNGestureHandlerModule.install() is missing and any
// GestureHandlerRootView render crashes. @react-navigation/stack renders that
// view internally, so alias the module to a local no-op shim. This keeps
// navigation working on the current build without a native rebuild (swipe-back
// gestures are disabled). Delete this file and shims/ after rebuilding the dev
// client with a matching react-native-gesture-handler.
const gestureHandlerShim = path.resolve(
  __dirname,
  "shims/react-native-gesture-handler.tsx",
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-gesture-handler") {
    return { type: "sourceFile", filePath: gestureHandlerShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;