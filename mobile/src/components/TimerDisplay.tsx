import React from "react";
import { View, Text, StyleSheet } from "react-native";

type TimerProps = { seconds: number };

export const TimerDisplay = ({ seconds }: TimerProps) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  return (
    <Text style={styles.text}>
      {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}.{ms}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: { fontSize: 32, fontWeight: "700", fontFamily: "monospace", color: "#111827" },
});
