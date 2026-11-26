import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { useRecorder } from "../hooks/useRecorder";
import { usePlayback } from "../hooks/usePlayback";
import { apiService, recordingFileName, recordingMimeType } from "../services/api";
import { WAV_EXTENSION, WAV_MIME_TYPE } from "../hooks/useRecorder";
import { AudioRow } from "../components/AudioRow";
import { StatusStepper, BLUE_PRIMARY } from "../components/StatusStepper";

type RecordCollectNavigationProp = StackNavigationProp<
  RootStackParamList,
  "RecordCollect"
>;

const MIN_DURATION_SECONDS = 3;
const ORANGE_SOFT = "#FDBA74";
const TICK_MS = 250;

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordCollectScreen() {
  const navigation = useNavigation<RecordCollectNavigationProp>();
  const { status, permission, error, start, stop, checkPermission, clearError } =
    useRecorder();
  const { playing, loading, play, stop: stopPlayback } = usePlayback();

  const [transcription, setTranscription] = useState("");
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [savedExtension, setSavedExtension] = useState(WAV_EXTENSION);
  const [savedMimeType, setSavedMimeType] = useState(WAV_MIME_TYPE);
  const [savedDuration, setSavedDuration] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef(0);
  const holdingRef = useRef(false);
  const busyRef = useRef(false);

  const isRecording = status === "recording";
  const hasRecording = savedUri !== null;
  const isTranscribed = transcription.trim().length > 0;
  const canUpload = hasRecording && isTranscribed && !uploading;

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    return () => {
      stopTicker();
    };
  }, [stopTicker]);

  const startTicker = useCallback(() => {
    stopTicker();
    recordStartRef.current = Date.now();
    setRecordingSeconds(0);
    // Derive elapsed time from the clock instead of accumulating +0.1 per
    // tick: accumulation drifts, and 10 setStates/second re-render the screen.
    tickRef.current = setInterval(() => {
      setRecordingSeconds((Date.now() - recordStartRef.current) / 1000);
    }, TICK_MS);
  }, [stopTicker]);

  const handleStartRecording = useCallback(async () => {
    if (holdingRef.current || busyRef.current || permission === false) return;
    holdingRef.current = true;
    busyRef.current = true;
    try {
      stopPlayback();
      clearError();
      setUploadError(null);
      setSubmitted(false);
      setSavedUri(null);
      setSavedDuration(0);
      const started = await start();
      if (!started) {
        holdingRef.current = false;
        return;
      }
      startTicker();
    } finally {
      busyRef.current = false;
    }
  }, [permission, start, startTicker, stopPlayback, clearError]);

  const handleStopRecording = useCallback(async () => {
    if (!holdingRef.current || busyRef.current) return;
    const heldSeconds = (Date.now() - recordStartRef.current) / 1000;
    holdingRef.current = false;
    busyRef.current = true;
    stopTicker();
    try {
      const result = await stop();
      if (!result?.uri) {
        setRecordingSeconds(0);
        return;
      }
      // Trust the longest of the measurements: some devices report a short or
      // zero native duration right after stop(), which discarded valid takes.
      const finalSeconds = Math.max(result.durationSeconds, heldSeconds);
      if (finalSeconds < MIN_DURATION_SECONDS) {
        setRecordingSeconds(0);
        Alert.alert(
          "Recording discarded",
          `Recordings under ${MIN_DURATION_SECONDS} seconds are automatically discarded.`,
        );
        return;
      }
      setSavedUri(result.uri);
      setSavedExtension(result.extension);
      setSavedMimeType(result.mimeType);
      setSavedDuration(finalSeconds);
      setRecordingSeconds(finalSeconds);
    } finally {
      busyRef.current = false;
    }
  }, [stop, stopTicker]);

  const handleDeleteRecording = useCallback(() => {
    stopPlayback();
    setSavedUri(null);
    setSavedDuration(0);
    setRecordingSeconds(0);
    setSubmitted(false);
    setUploadError(null);
  }, [stopPlayback]);

  const handleTogglePlay = useCallback(() => {
    if (!savedUri) return;
    if (playing) {
      stopPlayback();
      return;
    }
    play(savedUri);
  }, [savedUri, playing, play, stopPlayback]);

  const resetForm = useCallback(() => {
    setTranscription("");
    setSavedUri(null);
    setSavedDuration(0);
    setRecordingSeconds(0);
    setSubmitted(false);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!savedUri || !hasRecording) {
      Alert.alert("No recording", "Record audio first.");
      return;
    }
    if (!isTranscribed) {
      Alert.alert(
        "Transcription required",
        "Write the Afaan Oromo transcription before uploading.",
      );
      return;
    }
    stopPlayback();
    setUploading(true);
    setUploadError(null);
    try {
      await apiService.saveRecording(
        savedUri,
        recordingFileName(savedExtension),
        recordingMimeType(savedExtension, savedMimeType),
        transcription.trim(),
        "om",
        savedDuration,
      );
      setSubmitted(true);
      Alert.alert("Uploaded", "Recording uploaded successfully.", [
        { text: "OK", onPress: resetForm },
      ]);
    } catch (e: any) {
      setUploadError(e?.message ?? "Failed to upload recording");
    } finally {
      setUploading(false);
    }
  }, [
    savedUri,
    hasRecording,
    isTranscribed,
    transcription,
    savedDuration,
    savedExtension,
    savedMimeType,
    stopPlayback,
    resetForm,
  ]);

  const displayedSeconds = hasRecording ? savedDuration : recordingSeconds;
  const recordHint = isRecording
    ? formatClock(recordingSeconds)
    : hasRecording
      ? "Hold again to re-record"
      : "Hold the microphone for recording";
  const headerError = error ?? uploadError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Sound Recording</Text>

        {permission === false && (
          <View style={styles.alertWarning}>
            <Text style={styles.alertWarningText}>
              Microphone permission denied. Enable it in device settings to
              record.
            </Text>
          </View>
        )}
        {headerError && (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>{headerError}</Text>
          </View>
        )}

        {/* Transcription input */}
        <Text style={styles.label}>Transcription</Text>
        <TextInput
          style={styles.input}
          value={transcription}
          onChangeText={setTranscription}
          placeholder="Write the Afaan Oromo transcription here..."
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          editable={!uploading}
        />
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>
            Please seera qubee afaan oromoo eeggachuun barreessuu hin dagatinaa
          </Text>
        </View>

        <StatusStepper
          voiceRecorded={hasRecording}
          transcribed={isTranscribed}
          submitted={submitted}
        />

        <AudioRow
          hasRecording={hasRecording}
          playing={playing}
          loading={loading}
          seconds={displayedSeconds}
          onTogglePlay={handleTogglePlay}
          onDelete={handleDeleteRecording}
        />

        <View style={styles.recordArea}>
          <Text
            style={[styles.recordHint, isRecording && styles.recordHintActive]}
          >
            {recordHint}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              permission === false && styles.disabled,
            ]}
            onPressIn={handleStartRecording}
            onPressOut={handleStopRecording}
            disabled={permission === false}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Stop recording" : "Hold to record"
            }
          >
            <Ionicons
              name="mic"
              size={40}
              color={isRecording ? "#DC2626" : "#4B5563"}
            />
          </TouchableOpacity>

          <Text style={styles.warningText}>
            Recordings under {MIN_DURATION_SECONDS} seconds are discarded
            automatically.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadButton, !canUpload && styles.disabled]}
          onPress={handleUpload}
          disabled={!canUpload}
          accessibilityRole="button"
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryLink}
          onPress={() => navigation.navigate("TextCollect")}
        >
          <Text style={styles.secondaryLinkText}>Write text instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20, paddingBottom: 40 },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },

  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    minHeight: 96,
  },
  infoNote: {
    backgroundColor: "#FFF7ED",
    borderLeftWidth: 4,
    borderLeftColor: ORANGE_SOFT,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  infoNoteText: { fontSize: 12, color: "#9A3412" },

  recordArea: { alignItems: "center" },
  recordHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  recordHintActive: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  recordButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  warningText: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 10,
    marginBottom: 24,
  },

  uploadButton: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: BLUE_PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  uploadButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryLink: { alignItems: "center", marginTop: 16 },
  secondaryLinkText: { color: BLUE_PRIMARY, fontSize: 13, fontWeight: "600" },

  disabled: { opacity: 0.45 },

  alertWarning: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  alertWarningText: { fontSize: 13, color: "#92400E" },
  alertError: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  alertErrorText: { fontSize: 13, color: "#DC2626" },
});
