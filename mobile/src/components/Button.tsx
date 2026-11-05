import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "danger" | "outline";
};

export const Button = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: ButtonProps) => {
  const base = [
    styles.container,
    variant === "danger" && styles.danger,
    variant === "outline" && styles.outline,
    (disabled || loading) && styles.disabled,
  ];
  return (
    <TouchableOpacity style={base} onPress={loading || disabled ? undefined : onPress} disabled={disabled || loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
      ) : (
        <Text style={[styles.text, variant === "outline" ? styles.outlineText : null]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 52,
  },
  text: { fontSize: 16, fontWeight: "600" },
  spinner: { marginRight: 8 },
  primary: { backgroundColor: "#2563eb" },
  danger: { backgroundColor: "#dc2626" },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#2563eb" },
  disabled: { opacity: 0.5 },
  outlineText: { color: "#2563eb" },
});
