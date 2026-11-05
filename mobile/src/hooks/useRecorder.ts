import { useCallback, useRef, useState } from "react";
import {
  useAudioRecorder,
  RecordingStatus,
  AudioQuality,
  AndroidOutputFormat,
  AndroidAudioEncoder,
  IOSOutputFormat,
} from "expo-audio";
import {
  configureAudioForRecording,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
} from "../services/audio";

export type RecorderStatus = "idle" | "recording" | "paused";

const SPEECH_OPTIONS = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: "mpeg4" as AndroidOutputFormat, audioEncoder: "aac" as AndroidAudioEncoder },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 64000 },
};

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useAudioRecorder(SPEECH_OPTIONS, (s: RecordingStatus) => {
    if (s.isFinished) {
      setStatus("idle");
    } else if (s.hasError) {
      setStatus("idle");
      setError(s.error ?? "Recording error");
    }
  });

  const checkPermission = useCallback(async () => {
    const stored = await getMicrophonePermissionStatus();
    if (stored !== "granted") {
      const granted = await requestMicrophonePermission();
      setPermission(granted);
      return granted;
    }
    setPermission(true);
    return true;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const granted = await checkPermission();
    if (!granted) {
      setError("Microphone permission not granted");
      return;
    }
    try {
      await configureAudioForRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus("recording");
    } catch (e: any) {
      setError(e?.message ?? "Failed to start recording");
    }
  }, [recorder, checkPermission]);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      setStatus("idle");
    } catch (e: any) {
      setError(e?.message ?? "Failed to stop recording");
    }
  }, [recorder]);

  const pause = useCallback(async () => {
    try {
      recorder.pause();
      setStatus("paused");
    } catch {
      // ignore
    }
  }, [recorder]);

  const resume = useCallback(async () => {
    try {
      recorder.record();
      setStatus("recording");
    } catch (e: any) {
      setError(e?.message ?? "Failed to resume recording");
    }
  }, [recorder]);

  const isRecording = status === "recording";
  const uri = recorder.uri;
  const durationSeconds = recorder.currentTime;

  return {
    status,
    permission,
    error,
    isRecording,
    uri,
    durationSeconds,
    start,
    stop,
    pause,
    resume,
    checkPermission,
  };
}
