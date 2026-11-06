import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { useRecorder } from "../hooks/useRecorder";
import { apiService } from "../services/api";
import { Button } from "../components/Button";
import { TimerDisplay } from "../components/TimerDisplay";
import { AudioPlayer } from "../components/AudioPlayer";
import { LocalRecording } from "../types";

type RecordNavigationProp = StackNavigationProp<RootStackParamList, "Record">;

export default function RecordScreen() {
  const navigation = useNavigation<RecordNavigationProp>();
  const {
    status, permission, error, isRecording, uri, durationSeconds,
    start, stop, pause, resume, checkPermission,
  } = useRecorder();
  const [localRecording, setLocalRecording] = useState<LocalRecording | null>(null);
  const [presetText, setPresetText] = useState("");
  const [savingTranscribe, setSavingTranscribe] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
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
    setTranscribeError(null);
    if (status === "idle") {
      await start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
    } else if (status === "recording") {
      await stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (uri) {
        setLocalRecording({ uri, durationSeconds: durationSeconds ?? 0, mimeType: "audio/m4a" });
        setSeconds(durationSeconds ?? 0);
      }
    } else if (status === "paused") {
      await resume();
      timerRef.current = setInterval(() => setSeconds((s) => s + 0.1), 100);
    }
  }, [status, start, stop, resume, uri, durationSeconds]);

  const handleReview = useCallback(() => {
    if (!localRecording) return;
    navigation.navigate("Review", {
      recording: localRecording,
      transcription: presetText,
    });
  }, [localRecording, presetText, navigation]);

  const handleReRecord = useCallback(() => {
    setLocalRecording(null);
    setSeconds(0);
    setTranscribeError(null);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Record</Text>
        <Text style={styles.subtitle}>Afaan Oromo Speech Collection</Text>
      </View>

      {permission === false && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            Microphone permission denied. Enable it in device settings to record.
          </Text>
        </View>
      )}
      {error && <View style={styles.alertError}><Text style={styles.errorText}>{error}</Text></View>}
      {transcribeError && <View style={styles.alertError}><Text style={styles.errorText}>{transcribeError}</Text></View>}

      {/* Optional preset text: record audio for existing text (text -> audio flow) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Optional: transcription text (record audio for this text)</Text>
        <TextInput
          style={styles.textInput}
          value={presetText}
          onChangeText={setPresetText}
          placeholder="Type the Afaan Oromo text to record audio for..."
          multiline
          numberOfLines={3}
          spellCheck={false}
          autoCapitalize="sentences"
        />
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
      </View>

      {localRecording && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recorded Audio</Text>
          <AudioPlayer uri={localRecording.uri} />
          <View style={styles.row}>
            <Button title="Re-record" onPress={handleReRecord} variant="outline" />
            <Button title="Continue to Transcription" onPress={handleReview} variant="primary" loading={savingTranscribe} disabled={savingTranscribe} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  header: { alignItems: "center", marginVertical: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  alert: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 12 },
  alertText: { fontSize: 13, color: "#92400e" },
  alertError: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#dc2626" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 8 },
  textInput: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  controls: { flexDirection: "row", gap: 10, marginTop: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
});
