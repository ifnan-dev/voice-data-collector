export type RecordingStatus = "idle" | "recording" | "paused" | "playing";

export interface LocalRecording {
  uri: string;
  durationSeconds: number;
  mimeType: string;
  /** Container extension of the stored file, e.g. ".wav". */
  extension?: string;
}

export interface Recording {
  id: string;
  audio_path: string;
  transcription: string;
  language: string;
  duration_seconds: number | null;
  created_at: string;
}

export interface ApiError {
  message: string;
  status?: number;
}
