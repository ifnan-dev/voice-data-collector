import { LocalRecording, Recording } from "../types";

export type RootStackParamList = {
  Record: undefined;
  Review: {
    recording: LocalRecording;
    transcription: string;
  };
  RecordingsList: undefined;
  RecordingDetails: {
    recording: Recording;
  };
};
