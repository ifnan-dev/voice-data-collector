import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";

type TranscriptionEditorProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export const TranscriptionEditor = ({
  value,
  onChangeText,
  placeholder = "Transcription...",
}: TranscriptionEditorProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Transcription</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={5}
        spellCheck={false}
        autoCapitalize="sentences"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    minHeight: 120,
    textAlignVertical: "top",
  },
});
