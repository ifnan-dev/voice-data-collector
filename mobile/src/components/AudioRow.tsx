import React, { memo, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BLUE_PRIMARY } from "./StatusStepper";

const BAR_HEIGHTS = [
  8, 16, 24, 14, 22, 10, 18, 26, 12, 20, 16, 24, 10, 18, 22, 14, 20, 12, 24, 16,
  10, 22,
];

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const Waveform = memo(function Waveform({ active }: { active: boolean }) {
  const color = active ? BLUE_PRIMARY : "#9CA3AF";
  return (
    <View style={styles.waveform}>
      {BAR_HEIGHTS.map((h, i) => (
        <View
          key={i}
          style={[styles.waveBar, { height: h, backgroundColor: color }]}
        />
      ))}
    </View>
  );
});

type AudioRowProps = {
  hasRecording: boolean;
  playing: boolean;
  loading: boolean;
  seconds: number;
  onTogglePlay: () => void;
  onDelete: () => void;
};

export const AudioRow = memo(function AudioRow({
  hasRecording,
  playing,
  loading,
  seconds,
  onTogglePlay,
  onDelete,
}: AudioRowProps) {
  const durationLabel = useMemo(() => formatDuration(seconds), [seconds]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.playButton, !hasRecording && styles.disabled]}
        onPress={onTogglePlay}
        disabled={!hasRecording || loading}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Stop playback" : "Play recording"}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
        )}
      </TouchableOpacity>

      {hasRecording ? (
        <Waveform active={playing} />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recording yet</Text>
        </View>
      )}

      <Text style={styles.duration}>{durationLabel}</Text>

      <TouchableOpacity
        style={[styles.deleteButton, !hasRecording && styles.disabled]}
        onPress={onDelete}
        disabled={!hasRecording}
        accessibilityRole="button"
        accessibilityLabel="Delete recording"
      >
        <Ionicons name="close" size={18} color="#DC2626" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 10,
  },
  waveBar: { width: 3, borderRadius: 2 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
  emptyText: { fontSize: 12, color: "#9CA3AF" },
  duration: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 10,
    fontVariant: ["tabular-nums"],
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
});
