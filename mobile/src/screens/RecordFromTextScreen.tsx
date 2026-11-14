import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { pendingStore, type PendingText } from "../store/pendingStore";
import { apiService } from "../services/api";
import { useRecorder } from "../hooks/useRecorder";
import { Button } from "../components/Button";
import { TimerDisplay } from "../components/TimerDisplay";
import { AudioPlayer } from "../components/AudioPlayer";
import { LocalRecording } from "../types";

type RecordFromTextNavigationProp = StackNavigationProp<RootStackParamList, "RecordFromText">;
type RecordFromTextRouteProp = RouteProp<RootStackParamList, "RecordFromText">;

export default function RecordFromTextScreen() {
  const navigation = useNavigation<RecordFromTextNavigationProp>();
  const route = useRoute<RecordFromTextRouteProp>();
  const { text, textId } = route.params;
  const {
    status, permission, error, isRecording, uri, durationSeconds,
    start, stop, pause, resume, checkPermission,
  } = useRecorder();
  const [localRecording, setLocalRecording] = useState<LocalRecording | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkPermission();
    };
    init();
  }, [checkPermission]);

  const handleRecordPress = useCallback(async () => {
    setSaveError(null);
    if (status === "idle") {
      await start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
    } else if (status === "recording") {
      const result = await stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (result?.uri) {
        setLocalRecording({ uri: result.uri, durationSeconds: result.durationSeconds, mimeType: "audio/m4a" });
        setSeconds(result.durationSeconds);
      }
    } else if (status === "paused") {
      await resume();
      timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
    }
  }, [status, start, stop, resume]);

  const handleSave = useCallback(async () => {
    if (!localRecording || !text) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiService.saveRecording(
        localRecording.uri,
        `recording-${Date.now()}.m4a`,
        localRecording.mimeType,
        text,
        "om",
        localRecording.durationSeconds
      );
      pendingStore.removeText(textId);
      setSaved(true);
      Alert.alert(
        "Saved",
        "Recording saved successfully.",
        [{ text: "OK", onPress: () => navigation.replace("RecordingsList") }]
      );
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save recording");
    } finally {
      setSaving(false);
    }
  }, [localRecording, text, textId, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleDiscard = useCallback(() => {
    setLocalRecording(null);
    setSeconds(0);
    setSaveError(null);
  }, []);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Record Audio for Text</Text>
        <Text style={styles.subtitle}>Record the audio matching the sentence below</Text>
      </View>

      {permission === false && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            Microphone permission denied. Enable it in device settings to record.
          </Text>
        </View>
      )}
      {error && <View style={styles.alertError}><Text style={styles.errorText}>{error}</Text></View>}
      {saveError && <View style={styles.alertError}><Text style={styles.errorText}>{saveError}</Text></View>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sentence</Text>
        <Text style={styles.sentenceText}>{text}</Text>
      </View>

      <View style={styles.card}>
        <TimerDisplay seconds={seconds} />
        <View style={styles.controls}>
          {!isRecording && status === "idle" ? (
            <Button
              title={permission === false ? "Grant Microphone Permission" : "Start Recording"}
              onPress={permission === false ? checkPermission : handleRecordPress}
              variant="primary"
              disabled={permission === false}
            />
          ) : isRecording ? (
            <>
              <Button title="Pause" onPress={pause} variant="outline" />
              <Button title="Stop Recording" onPress={handleRecordPress} variant="danger" />
            </>
          ) : (
            <Button title="Resume" onPress={handleRecordPress} variant="primary" />
          )}
        </View>
        {localRecording && (
          <View style={styles.pendingLocal}>
            <Text style={styles.sectionTitle}>Latest recording (not yet saved)</Text>
            <AudioPlayer uri={localRecording.uri} />
            <View style={styles.row}>
              <Button title="Discard" onPress={handleDiscard} variant="outline" />
              <Button title="Save Recording" onPress={handleSave} variant="primary" loading={saving} disabled={saving} />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.row, { justifyContent: "center" }]}>
        <Button title="Back to Text List" onPress={handleCancel} variant="outline" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  header: { alignItems: "center", marginVertical: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4, textAlign: "center" },
  alert: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 12 },
  alertText: { fontSize: 13, color: "#92400e" },
  alertError: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#dc2626" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 8 },
  sentenceText: { fontSize: 17, color: "#111827", fontWeight: "600", textAlign: "center" },
  controls: { flexDirection: "row", gap: 10, marginTop: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 12, justifyContent: "center" },
  pendingLocal: { marginTop: 14 },
  success: { alignItems: "center", paddingVertical: 40 },
  successText: { fontSize: 18, fontWeight: "700", color: "#15803d", marginBottom: 16 },
});
