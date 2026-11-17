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

export type RecordResult = { uri: string | null; durationSeconds: number };

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
  // Wall-clock start/stop marks. These are the source of truth for duration:
  // `recorder.currentTime` can read 0 right after `stop()` because the native
  // recorder has already been torn down by the time we ask.
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const recorder = useAudioRecorder(SPEECH_OPTIONS, (s: RecordingStatus) => {
    if (s.hasError) {
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
      return false;
    }
    try {
      // Reset audio mode for each take so a previous playback session
      // cannot leave the input route in a bad state.
      await configureAudioForRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      elapsedRef.current = 0;
      setStatus("recording");
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Failed to start recording");
      return false;
    }
  }, [recorder, checkPermission]);

  const stop = useCallback(async (): Promise<RecordResult | null> => {
    const startedAt = startedAtRef.current;
    const wallClockSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    startedAtRef.current = null;
    try {
      // Read status BEFORE stopping: after stop() the native side may
      // already report 0 duration.
      let nativeSeconds = 0;
      try {
        const st = recorder.getStatus();
        nativeSeconds = (st?.durationMillis ?? 0) / 1000;
      } catch {
        // getStatus is not available on every platform; fall back to wall clock.
      }

      const stopPromise = recorder.stop();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Recording stop timed out")), 5000)
      );
      await Promise.race([stopPromise, timeoutPromise]);

      const recordingUri = recorder.uri;
      const durationSeconds = Math.max(wallClockSeconds, nativeSeconds, elapsedRef.current);
      elapsedRef.current = durationSeconds;
      setStatus("idle");
      return { uri: recordingUri, durationSeconds };
    } catch (e: any) {
      setStatus("idle");
      setError(e?.message ?? "Failed to stop recording");
      return null;
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
      startedAtRef.current = Date.now() - elapsedRef.current * 1000;
      setStatus("recording");
    } catch (e: any) {
      setError(e?.message ?? "Failed to resume recording");
    }
  }, [recorder]);

  const isRecording = status === "recording";

  return {
    status,
    permission,
    error,
    isRecording,
    start,
    stop,
    pause,
    resume,
    checkPermission,
    clearError: useCallback(() => setError(null), []),
  };
}
