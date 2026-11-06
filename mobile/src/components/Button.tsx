import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "danger" | "outline";
  size?: "default" | "small";
};

export const Button = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "default",
}: ButtonProps) => {
  const base = [
    styles.container,
    size === "small" && styles.small,
    variant === "danger" && styles.danger,
    variant === "outline" && styles.outline,
    (disabled || loading) && styles.disabled,
  ];
  const paddingVertical = size === "small" ? 8 : 14;
  const minHeight = size === "small" ? 36 : 52;
  const minWidth = size === "small" ? 80 : undefined;
  const fontSize = size === "small" ? 13 : 16;
  return (
    <TouchableOpacity style={[{ ...base, paddingVertical, minHeight }, minWidth && { minWidth }]} onPress={loading || disabled ? undefined : onPress} disabled={disabled || loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
      ) : (
        <Text style={[styles.text, { fontSize }, variant === "outline" ? styles.outlineText : null]}>
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
    borderRadius: 10,
  },
  text: { fontWeight: "600" },
  spinner: { marginRight: 8 },
  small: { paddingHorizontal: 10 },
  primary: { backgroundColor: "#2563eb" },
  danger: { backgroundColor: "#dc2626" },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#2563eb" },
  disabled: { opacity: 0.5 },
  outlineText: { color: "#2563eb" },
});
