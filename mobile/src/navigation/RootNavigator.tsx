import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaView } from "react-native-safe-area-context";

import RecordCollectScreen from "../screens/RecordCollectScreen";
import TextCollectScreen from "../screens/TextCollectScreen";
import TranscribeAudioScreen from "../screens/TranscribeAudioScreen";
import RecordFromTextScreen from "../screens/RecordFromTextScreen";
import RecordingsListScreen from "../screens/RecordingsListScreen";
import RecordingDetailsScreen from "../screens/RecordingDetailsScreen";
import type { RootStackParamList } from "./types";

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="RecordCollect" component={RecordCollectScreen} />
          <Stack.Screen name="TextCollect" component={TextCollectScreen} />
          <Stack.Screen name="TranscribeAudio" component={TranscribeAudioScreen} />
          <Stack.Screen name="RecordFromText" component={RecordFromTextScreen} />
          <Stack.Screen name="RecordingsList" component={RecordingsListScreen} />
          <Stack.Screen name="RecordingDetails" component={RecordingDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}
