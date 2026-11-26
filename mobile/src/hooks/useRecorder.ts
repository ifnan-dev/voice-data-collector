import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAudioStream, useAudioRecorder, RecordingPresets } from "expo-audio";
import {
  configureAudioForRecording as applyRecordingAudioMode,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
} from "../services/audio";
import { preserveTake } from "../services/recordingFiles";
import {
  convertWebTakeToWav,
  WAV_SAMPLE_RATE,
  WAV_CHANNELS,
  WAV_MIME_TYPE,
  WAV_EXTENSION,
} from "../services/wav";

export type RecorderStatus = "idle" | "recording" | "paused";

export type RecordResult = {
  uri: string | null;
  durationSeconds: number;
  /** Container actually produced (e.g. ".wav"). */
  extension: string;
  mimeType: string;
};

// Re-exported so existing imports from this hook keep working. The canonical
// definitions live in services/wav.ts to avoid a circular dependency.
export {
  WAV_SAMPLE_RATE,
  WAV_CHANNELS,
  WAV_MIME_TYPE,
  WAV_EXTENSION,
};

const isWeb = Platform.OS === "web";
const STOP_TIMEOUT_MS = 20000;

/**
 * Records straight from the microphone to a PCM WAV file. Takes are copied
 * into persistent storage as soon as they finish, so a completed take is
 * never lost to temp-file cleanup or a later recording overwriting the path.
 *
 * Native (Android/iOS) captures PCM directly through `useAudioStream`, which
 * writes a real WAV container. The browser has no PCM stream (the native
 * `AudioStream` is null on web), so web falls back to `useAudioRecorder`
 * (MediaRecorder → Opus/WebM) and transcodes the take to WAV on stop.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wall-clock marks per segment. Pausing/stopping closes a segment, so
  // duration = sum of segments + time inside the open one.
  const segmentStartRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  // Path of the WAV file currently being appended to by the native stream.
  const segmentFileRef = useRef<string | null>(null);
  // Every file produced by this take, in order (one per pause/resume).
  const segmentsRef = useRef<string[]>([]);

  // Native PCM stream. On web this resolves to a null stream (see
  // expo-audio's AudioStream.web), so it is only used when !isWeb.
  const { stream } = useAudioStream({
    sampleRate: WAV_SAMPLE_RATE,
    channels: WAV_CHANNELS,
    encoding: "int16",
  });

  // Web-only MediaRecorder. Created on every platform (hooks cannot be
  // conditional) but only started on web.
  const webRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const currentElapsed = useCallback(() => {
    const open = segmentStartRef.current
      ? (Date.now() - segmentStartRef.current) / 1000
      : 0;
    return elapsedRef.current + open;
  }, []);

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

  const beginSegment = useCallback(async () => {
    // Native/desktop write straight to WAV. `directory: "document"` puts the
    // file in persistent storage from the start, so even a crash mid-take
    // leaves playable audio behind.
    const { uri } = await stream.startFileRecordingAsync({
      directory: "document",
      format: "wav",
    });
    segmentFileRef.current = uri;
    segmentsRef.current.push(uri);
    segmentStartRef.current = Date.now();
  }, [stream]);

  const endSegment = useCallback(async () => {
    const started = segmentStartRef.current;
    if (started) elapsedRef.current += (Date.now() - started) / 1000;
    segmentStartRef.current = null;

    if (stream.isStreaming) {
      try {
        await stream.stopFileRecordingAsync();
      } catch {
        // The stream keeps a valid WAV on disk even if finalisation reports
        // an error; the file check in stop() decides whether it is usable.
      }
    }
    stream.stop();
  }, [stream]);

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
      await applyRecordingAudioMode();
      elapsedRef.current = 0;
      segmentsRef.current = [];

      if (isWeb) {
        await webRecorder.prepareToRecordAsync();
        webRecorder.record();
        segmentStartRef.current = Date.now();
      } else {
        await stream.start();
        await beginSegment();
      }
      setStatus("recording");
      return true;
    } catch (e: any) {
      if (!isWeb) stream.stop();
      setError(e?.message ?? "Failed to start recording");
      return false;
    }
  }, [stream, webRecorder, checkPermission, beginSegment]);

  const stop = useCallback(async (): Promise<RecordResult | null> => {
    try {
      const durationSeconds = currentElapsed();
      segmentStartRef.current = null;

      if (isWeb) {
        // Browsers capture a single continuous Opus stream; transcode it to
        // WAV after the recorder finalises the blob.
        try {
          await Promise.race([
            webRecorder.stop(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Recording stop timed out")),
                STOP_TIMEOUT_MS,
              ),
            ),
          ]);
        } catch {
          // Fall through: use whatever uri the recorder already holds.
        }
        elapsedRef.current = durationSeconds;
        setStatus("idle");

        const rawUri = webRecorder.uri;
        if (!rawUri) {
          return {
            uri: null,
            durationSeconds,
            extension: WAV_EXTENSION,
            mimeType: WAV_MIME_TYPE,
          };
        }
        const wavUri = await convertWebTakeToWav(rawUri);
        const isWav = wavUri.toLowerCase().endsWith(".wav");
        const extension = isWav ? WAV_EXTENSION : ".webm";
        const mimeType = isWav ? WAV_MIME_TYPE : "audio/webm";
        const preserved = await preserveTake(wavUri, extension);
        return { uri: preserved, durationSeconds, extension, mimeType };
      }

      // Native: each pause/resume starts a new file, so the LAST segment
      // holds the end of the take.
      const segmentFiles = [...segmentsRef.current];
      segmentsRef.current = [];
      segmentFileRef.current = null;
      let finalUri: string | null = segmentFiles[segmentFiles.length - 1] ?? null;

      try {
        await Promise.race([
          endSegment(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Recording stop timed out")),
              STOP_TIMEOUT_MS,
            ),
          ),
        ]);
      } catch {
        // Finalising timed out. Never lose the take: keep the first
        // (longest) segment instead of the empty last one, and make sure the
        // stream is released so the mic is not left running.
        finalUri = segmentFiles[0] ?? finalUri;
        try {
          stream.stop();
        } catch {
          // ignore
        }
      }

      elapsedRef.current = durationSeconds;
      setStatus("idle");

      if (!finalUri)
        return {
          uri: null,
          durationSeconds,
          extension: WAV_EXTENSION,
          mimeType: WAV_MIME_TYPE,
        };

      // Make sure the finished take does not depend on the recorder's temp
      // path being kept around.
      const preserved = await preserveTake(finalUri, WAV_EXTENSION);
      return {
        uri: preserved,
        durationSeconds,
        extension: WAV_EXTENSION,
        mimeType: WAV_MIME_TYPE,
      };
    } catch (e: any) {
      if (!isWeb) {
        try {
          stream.stop();
        } catch {
          // ignore
        }
      }
      setStatus("idle");
      setError(e?.message ?? "Failed to stop recording");
      return null;
    }
  }, [stream, webRecorder, currentElapsed, endSegment]);

  const pause = useCallback(async () => {
    if (status !== "recording") return;
    try {
      if (isWeb) {
        // MediaRecorder.pause() keeps the same blob; the segment boundary is
        // only used for duration accounting.
        const started = segmentStartRef.current;
        if (started) elapsedRef.current += (Date.now() - started) / 1000;
        segmentStartRef.current = null;
        webRecorder.pause();
      } else {
        await endSegment();
      }
      setStatus("paused");
    } catch (e: any) {
      setError(e?.message ?? "Failed to pause recording");
    }
  }, [status, webRecorder, endSegment]);

  const resume = useCallback(async () => {
    if (status !== "paused") return;
    try {
      if (isWeb) {
        // A bare record() resumes the paused MediaRecorder.
        webRecorder.record();
        segmentStartRef.current = Date.now();
      } else {
        // The stream was fully stopped by pause(); restart it before opening
        // a new file segment, otherwise startFileRecordingAsync throws.
        await stream.start();
        await beginSegment();
      }
      setStatus("recording");
    } catch (e: any) {
      setError(e?.message ?? "Failed to resume recording");
    }
  }, [status, stream, webRecorder, beginSegment]);

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