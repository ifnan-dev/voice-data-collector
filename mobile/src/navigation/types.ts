import type { LocalRecording, Recording } from "../types";
import type { PendingRecording } from "../store/pendingStore";

export type RootStackParamList = {
  RecordCollect: undefined;
  TextCollect: undefined;
  TranscribeAudio: {
    recording: PendingRecording;
  };
  RecordFromText: {
    text: string;
    textId: string;
  };
  RecordingsList: undefined;
  RecordingDetails: {
    recording: Recording;
  };
};
