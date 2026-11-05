import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaView } from "react-native-safe-area-context";

import RecordScreen from "../screens/RecordScreen";
import ReviewScreen from "../screens/ReviewScreen";
import RecordingsListScreen from "../screens/RecordingsListScreen";
import RecordingDetailsScreen from "../screens/RecordingDetailsScreen";
import type { RootStackParamList } from "./types";

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Record" component={RecordScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} />
          <Stack.Screen name="RecordingsList" component={RecordingsListScreen} />
          <Stack.Screen name="RecordingDetails" component={RecordingDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}
