import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { useRecorder } from "../hooks/useRecorder";
import { pendingStore, type PendingRecording } from "../store/pendingStore";
import { Button } from "../components/Button";
import { TimerDisplay } from "../components/TimerDisplay";
import { AudioPlayer } from "../components/AudioPlayer";
import { LocalRecording } from "../types";

type RecordCollectNavigationProp = StackNavigationProp<RootStackParamList, "RecordCollect">;

export default function RecordCollectScreen() {
  const navigation = useNavigation<RecordCollectNavigationProp>();
  const {
    status, permission, error, isRecording, uri, durationSeconds,
    start, stop, pause, resume, checkPermission,
  } = useRecorder();
  const [recordings, setRecordings] = useState<PendingRecording[]>([]);
  const [localRecording, setLocalRecording] = useState<LocalRecording | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const unsub = pendingStore.subscribe(() => setRecordings(pendingStore.getRecordings()));
    setRecordings(pendingStore.getRecordings());
    return unsub;
  }, []);

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

  const handleSaveRecording = useCallback(() => {
    if (!localRecording) return;
    pendingStore.addRecording({
      uri: localRecording.uri,
      durationSeconds: localRecording.durationSeconds,
      mimeType: localRecording.mimeType,
    });
    setLocalRecording(null);
    setSeconds(0);
    setTranscribeError(null);
  }, [localRecording]);

  const handleReRecord = useCallback(() => {
    setLocalRecording(null);
    setSeconds(0);
    setTranscribeError(null);
  }, []);

  const handleTranscribe = (recording: PendingRecording) => {
    navigation.navigate("TranscribeAudio", { recording });
  };

  const handleDeleteRecording = (id: string) => {
    pendingStore.removeRecording(id);
  };

  const renderItem = ({ item }: { item: PendingRecording }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleTranscribe(item)}
    >
      <View style={styles.itemBody}>
        <View style={styles.itemLeft}>
          <AudioPlayer uri={item.uri} showControls={false} />
          <Text style={styles.itemDuration}>
            {item.durationSeconds.toFixed(1)}s
          </Text>
        </View>
        <View style={styles.itemRight}>
          <Button
            title="Transcribe"
            onPress={() => handleTranscribe(item)}
            variant="outline"
            size="small"
          />
          <Button
            title="Delete"
            onPress={() => handleDeleteRecording(item.id)}
            variant="danger"
            size="small"
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const keyExtractor = (item: PendingRecording) => item.id;

  const listHeader = () => (
    <>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Record Audio</Text>
        <Text style={styles.subtitle}>
          Record as many times as you like. Transcription is optional.
        </Text>
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
              <Button title="Discard" onPress={handleReRecord} variant="outline" />
              <Button title="Save to List" onPress={handleSaveRecording} variant="primary" />
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Recorded Audios ({recordings.length})</Text>
          <Button title="Clear All" onPress={() => pendingStore.clearRecordings()} variant="outline" size="small" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next step</Text>
        <View style={styles.row}>
          <Button title="Transcribe an Audio" onPress={() => {
            if (recordings.length === 0) {
              Alert.alert("No recordings", "Record some audio first.");
              return;
            }
            navigation.navigate("TranscribeAudio", { recording: recordings[0] });
          }} variant="primary" />
          <Button title="Write Text Instead" onPress={() => navigation.navigate("TextCollect")} variant="outline" />
        </View>
      </View>
    </>
  );

  return (
    <FlatList
      data={recordings}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingBottom: 16 }}
      ListEmptyComponent={
        <Text style={styles.empty}>No recordings yet. Record some audio above.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginVertical: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4, textAlign: "center" },
  alert: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 12 },
  alertText: { fontSize: 13, color: "#92400e" },
  alertError: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#dc2626" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 8 },
  controls: { flexDirection: "row", gap: 10, marginTop: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  pendingLocal: { marginTop: 14 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  item: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemBody: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemLeft: { flex: 1, marginRight: 10 },
  itemDuration: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  itemRight: { gap: 6 },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginVertical: 16, paddingHorizontal: 16 },
});
