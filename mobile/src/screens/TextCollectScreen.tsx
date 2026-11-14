import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { pendingStore, type PendingText } from "../store/pendingStore";
import { Button } from "../components/Button";

type TextCollectNavigationProp = StackNavigationProp<RootStackParamList, "TextCollect">;

export default function TextCollectScreen() {
  const navigation = useNavigation<TextCollectNavigationProp>();
  const [texts, setTexts] = useState<PendingText[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = pendingStore.subscribe(() => setTexts(pendingStore.getTexts()));
    setTexts(pendingStore.getTexts());
    return unsub;
  }, []);

  const handleAddText = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    if (editingId) {
      pendingStore.updateText(editingId, t);
      setEditingId(null);
    } else {
      pendingStore.addText(t);
    }
    setDraft("");
  }, [draft, editingId]);

  const handleEdit = (item: PendingText) => {
    setDraft(item.text);
    setEditingId(item.id);
  };

  const handleDelete = (id: string) => {
    pendingStore.removeText(id);
  };

  const handleRecordForText = (item: PendingText) => {
    navigation.navigate("RecordFromText", { text: item.text, textId: item.id });
  };

  const renderItem = ({ item }: { item: PendingText }) => (
    <TouchableOpacity style={styles.item} onPress={() => handleRecordForText(item)}>
      <View style={styles.itemBody}>
        <View style={styles.itemLeft}>
          <Text style={styles.itemText}>{item.text}</Text>
          <Text style={styles.itemMeta}>Tap to record audio for this text</Text>
        </View>
        <View style={styles.itemRight}>
          <Button title="Edit" onPress={() => handleEdit(item)} variant="outline" size="small" />
          <Button title="Delete" onPress={() => handleDelete(item.id)} variant="danger" size="small" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const keyExtractor = (item: PendingText) => item.id;

  const listHeader = () => (
    <>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Write Text</Text>
        <Text style={styles.subtitle}>
          Type as many Afaan Oromo sentences as you like. Audio is optional.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a new sentence</Text>
        <TextInput
          style={styles.textInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type an Afaan Oromo sentence..."
          multiline
          numberOfLines={3}
          spellCheck={false}
          autoCapitalize="sentences"
        />
        <View style={styles.row}>
          <Button title={editingId ? "Update" : "Add"} onPress={handleAddText} variant="primary" />
          {editingId && (
            <Button title="Cancel" onPress={() => { setEditingId(null); setDraft(""); }} variant="outline" size="small" />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Saved Sentences ({texts.length})</Text>
          <Button title="Clear All" onPress={() => pendingStore.clearTexts()} variant="outline" size="small" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next step</Text>
        <View style={styles.row}>
          <Button title="Record Audio for a Sentence" onPress={() => {
            if (texts.length === 0) {
              Alert.alert("No sentences", "Write some text first.");
              return;
            }
            navigation.navigate("RecordFromText", { text: texts[0].text, textId: texts[0].id });
          }} variant="primary" />
          <Button title="Record Audio Instead" onPress={() => navigation.navigate("RecordCollect")} variant="outline" />
        </View>
      </View>
    </>
  );

  return (
    <FlatList
      data={texts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingBottom: 16 }}
      ListEmptyComponent={
        <Text style={styles.empty}>No sentences yet. Type some text above.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginVertical: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4, textAlign: "center" },
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
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  item: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemBody: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemLeft: { flex: 1, marginRight: 10 },
  itemText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  itemRight: { gap: 6 },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginVertical: 16, paddingHorizontal: 16 },
});
