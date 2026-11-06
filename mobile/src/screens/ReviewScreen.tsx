import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Alert, StatusBar, KeyboardAvoidingView, ScrollView, Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { usePlayback } from "../hooks/usePlayback";
import { apiService } from "../services/api";
import { Button } from "../components/Button";
import { TranscriptionEditor } from "../components/TranscriptionEditor";
import { AudioPlayer } from "../components/AudioPlayer";
import { LocalRecording } from "../types";

type ReviewNavigationProp = StackNavigationProp<RootStackParamList, "Review">;
type ReviewRouteProp = RouteProp<RootStackParamList, "Review">;

export default function ReviewScreen() {
  const navigation = useNavigation<ReviewNavigationProp>();
  const route = useRoute<ReviewRouteProp>();
  const { recording, transcription: initialTranscription = "" } = route.params;
  const [transcription, setTranscription] = useState(initialTranscription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { play, stop } = usePlayback();

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const handleSave = useCallback(async () => {
    if (!recording) return;
    setSaving(true);
    setError(null);
    stop();
    try {
      await apiService.saveRecording(
        recording.uri,
        `recording-${Date.now()}.m4a`,
        recording.mimeType,
        transcription,
        "om",
        recording.durationSeconds
      );
      setSaved(true);
      Alert.alert(
        "Saved",
        "Recording saved successfully.",
        [{ text: "OK", onPress: () => navigation.replace("RecordingsList") }]
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to save recording");
    } finally {
      setSaving(false);
    }
  }, [recording, transcription, navigation, stop]);

  const handleCancel = useCallback(() => {
    stop();
    navigation.goBack();
  }, [navigation, stop]);

  if (saved) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.success}>
          <Text style={styles.successText}>Recording saved successfully</Text>
        </View>
        <Button title="View My Recordings" onPress={() => navigation.replace("RecordingsList")} variant="primary" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Review Transcription</Text>
          <Text style={styles.subtitle}>Enter the Afaan Oromo transcription manually</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Audio</Text>
          <AudioPlayer uri={recording.uri} onPlaybackEnd={() => {}} />
        </View>

        <TranscriptionEditor value={transcription} onChangeText={setTranscription} />

        {error && <View style={styles.alertError}><Text style={styles.errorText}>{error}</Text></View>}

        <View style={styles.row}>
          <Button title="Cancel" onPress={handleCancel} variant="outline" />
          <Button title="Save Recording" onPress={handleSave} variant="primary" loading={saving} disabled={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  alertError: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#dc2626" },
  success: { alignItems: "center", paddingVertical: 40 },
  successText: { fontSize: 18, fontWeight: "700", color: "#15803d", marginBottom: 16 },
});
