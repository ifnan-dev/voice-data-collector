import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const BLUE_PRIMARY = "#1D4ED8";

type StepProps = { done: boolean; label: string };

const Step = memo(function Step({ done, label }: StepProps) {
  return (
    <View style={styles.item}>
      <View style={[styles.dot, done && styles.dotDone]}>
        {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
      <Text style={[styles.label, done && styles.labelDone]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

type StatusStepperProps = {
  voiceRecorded: boolean;
  transcribed: boolean;
  submitted: boolean;
};

export const StatusStepper = memo(function StatusStepper({
  voiceRecorded,
  transcribed,
  submitted,
}: StatusStepperProps) {
  return (
    <View style={styles.row}>
      <Step done={voiceRecorded} label="Voice Recorded" />
      <View style={[styles.connector, voiceRecorded && styles.connectorDone]} />
      <Step done={transcribed} label="Transcribed" />
      <View style={[styles.connector, submitted && styles.connectorDone]} />
      <Step done={submitted} label="Submitted" />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: 22,
    marginBottom: 18,
  },
  item: { width: 92, alignItems: "center" },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  label: { fontSize: 11, color: "#6B7280", marginTop: 6, textAlign: "center" },
  labelDone: { color: "#111827", fontWeight: "600" },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginTop: 15,
  },
  connectorDone: { backgroundColor: "#16A34A" },
});
