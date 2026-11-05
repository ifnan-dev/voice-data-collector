import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { apiService } from "../services/api";
import { usePlayback } from "../hooks/usePlayback";
import { AudioPlayer } from "../components/AudioPlayer";
import { Button } from "../components/Button";
import { Recording } from "../types";

type DetailsNavigationProp = StackNavigationProp<RootStackParamList, "RecordingDetails">;
type DetailsRouteProp = RouteProp<RootStackParamList, "RecordingDetails">;

export default function RecordingDetailsScreen() {
  const navigation = useNavigation<DetailsNavigationProp>();
  const route = useRoute<DetailsRouteProp>();
  const { recording } = route.params;
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { play, stop } = usePlayback();

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const fetchAudioUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { audioUrl } = await apiService.getRecordingAudio(recording.id);
      setAudioUrl(audioUrl);
    } catch (e: any) {
      setError(e?.message ?? "Unable to load audio URL");
    } finally {
      setLoading(false);
    }
  }, [recording.id]);

  useEffect(() => {
    fetchAudioUrl();
  }, [fetchAudioUrl]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Button title="Back" onPress={() => navigation.goBack()} variant="outline" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Recording Details</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Recording ID</Text>
          <Text style={styles.value}>{recording.id}</Text>

          <Text style={styles.label}>Transcription</Text>
          <Text style={styles.value}>{recording.transcription}</Text>

          <Text style={styles.label}>Language</Text>
          <Text style={styles.value}>{recording.language.toUpperCase()}</Text>

          <Text style={styles.label}>Duration</Text>
          <Text style={styles.value}>{recording.duration_seconds == null ? "--" : recording.duration_seconds.toFixed(2)} seconds</Text>

          <Text style={styles.label}>Audio Path (R2)</Text>
          <Text style={styles.value}>{recording.audio_path}</Text>

          <Text style={styles.label}>Created At</Text>
          <Text style={styles.value}>{new Date(recording.created_at).toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Audio Playback</Text>
          {loading ? (
            <Text style={styles.hint}>Loading audio URL...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : audioUrl ? (
            <AudioPlayer uri={audioUrl} onPlaybackEnd={() => {}} />
          ) : (
            <Button title="Load Audio" onPress={fetchAudioUrl} variant="primary" />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  value: { fontSize: 16, color: "#111827", marginBottom: 10 },
  hint: { fontSize: 14, color: "#6b7280" },
  errorText: { fontSize: 14, color: "#dc2626" },
});
