import type { LocalRecording } from "../types";

export interface PendingRecording {
  id: string;
  uri: string;
  durationSeconds: number;
  mimeType: string;
  createdAt: number;
}

export interface PendingText {
  id: string;
  text: string;
  createdAt: number;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

let pendingRecordings: PendingRecording[] = [];
let pendingTexts: PendingText[] = [];

let listeners: (() => void)[] = [];

export const pendingStore = {
  subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  emit() {
    listeners.forEach((l) => l());
  },

  // Recordings
  getRecordings(): PendingRecording[] {
    return [...pendingRecordings];
  },
  addRecording(recording: Omit<PendingRecording, "id" | "createdAt">) {
    const item: PendingRecording = {
      ...recording,
      id: generateId(),
      createdAt: Date.now(),
    };
    pendingRecordings.unshift(item);
    this.emit();
    return item;
  },
  removeRecording(id: string) {
    pendingRecordings = pendingRecordings.filter((r) => r.id !== id);
    this.emit();
  },
  clearRecordings() {
    pendingRecordings = [];
    this.emit();
  },
  getRecording(id: string): PendingRecording | undefined {
    return pendingRecordings.find((r) => r.id === id);
  },

  // Texts
  getTexts(): PendingText[] {
    return [...pendingTexts];
  },
  addText(text: string) {
    const item: PendingText = {
      id: generateId(),
      text,
      createdAt: Date.now(),
    };
    pendingTexts.unshift(item);
    this.emit();
    return item;
  },
  removeText(id: string) {
    pendingTexts = pendingTexts.filter((t) => t.id !== id);
    this.emit();
  },
  clearTexts() {
    pendingTexts = [];
    this.emit();
  },
  getText(id: string): PendingText | undefined {
    return pendingTexts.find((t) => t.id === id);
  },
  updateText(id: string, text: string) {
    const item = pendingTexts.find((t) => t.id === id);
    if (item) item.text = text;
    this.emit();
  },
};
