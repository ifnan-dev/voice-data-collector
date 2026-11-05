import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { usePlayback } from "../hooks/usePlayback";

type AudioPlayerProps = {
  uri: string;
  onPlaybackEnd?: () => void;
  showControls?: boolean;
};

export const AudioPlayer = ({ uri, onPlaybackEnd, showControls = true }: AudioPlayerProps) => {
  const { playing, loading, error, play, stop } = usePlayback();

  if (!showControls) return null;

  const handlePress = () => {
    if (playing) {
      stop();
      onPlaybackEnd?.();
    } else {
      play(uri);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.button, playing && styles.stopped]} onPress={handlePress} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{playing ? "Stop" : "Play"}</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Text style={styles.hint}>{uri.split("/").pop()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 8 },
  button: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#e5e7eb" },
  stopped: { backgroundColor: "#fca5a5" },
  buttonText: { fontWeight: "600", marginLeft: 6 },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 4 },
  hint: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
