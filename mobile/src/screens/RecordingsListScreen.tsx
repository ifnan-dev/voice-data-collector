import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { apiService } from "../services/api";
import { Recording } from "../types";
import { Button } from "../components/Button";

type ListNavigationProp = StackNavigationProp<RootStackParamList, "RecordingsList">;

export default function RecordingsListScreen({ navigation }: { navigation: ListNavigationProp }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getRecordings();
      setRecordings(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load recordings");
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const formatDuration = (seconds: number | null) => {
    if (seconds == null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const renderItem = ({ item }: { item: Recording }) => {
    const shortId = item.id.length > 8 ? item.id.slice(0, 8) + "…" : item.id;
    return (
      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("RecordingDetails", { recording: item })}>
        <View style={styles.itemBody}>
          <View style={styles.itemLeft}>
            <Text style={styles.itemTranscription}>{item.transcription}</Text>
            <Text style={styles.itemMeta}>{item.language.toUpperCase()} &bull; {formatDuration(item.duration_seconds)} &bull; {formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemId} numberOfLines={1}>{shortId}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const keyExtractor = (item: Recording) => item.id;

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{error}</Text>
          <Button title="Retry" onPress={fetchRecordings} variant="primary" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>My Recordings</Text>
        <Button title="New Recording" onPress={() => navigation.navigate("Record")} variant="outline" />
      </View>
      {recordings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recordings yet.</Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  item: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginHorizontal: 12, marginVertical: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  itemBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemLeft: { flex: 1, marginRight: 10 },
  itemTranscription: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemRight: { alignItems: "flex-end" },
  itemId: { fontSize: 11, fontFamily: "monospace", color: "#2563eb", fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, color: "#6b7280", marginBottom: 12 },
});
