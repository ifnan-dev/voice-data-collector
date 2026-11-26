import axios, { AxiosInstance } from "axios";
import type { Recording, ApiError } from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

type RNFiles = { uri: string; type: string; name: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
};

/**
 * Build an upload filename from the recording's real extension. The extension
 * decides how the backend stores and validates the audio, so we never label
 * a file something it is not.
 */
export function recordingFileName(extension = ".wav", prefix = "recording"): string {
  return `${prefix}-${Date.now()}${extension}`;
}

export function recordingMimeType(extension = ".wav", fallback?: string): string {
  return fallback ?? MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export class ApiService {
  private client: AxiosInstance;

  constructor(baseURL: string = API_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 180000,
      headers: { Accept: "application/json" },
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        const message = err.response?.data?.detail || err.message || "An error occurred";
        const status = err.response?.status;
        return Promise.reject(new ApiErrorImpl(message, status));
      }
    );
  }

  private filePart(uri: string, fileName: string, mimeType: string): RNFiles {
    return { uri, type: mimeType, name: fileName };
  }

  async saveRecording(
    uri: string,
    fileName: string,
    mimeType: string,
    transcription: string,
    language: string,
    durationSeconds: number | null
  ): Promise<Recording> {
    const formData = new FormData();
    (formData as any).append("file", this.filePart(uri, fileName, mimeType));
    (formData as any).append("transcription", transcription);
    (formData as any).append("language", language);
    if (durationSeconds != null) {
      (formData as any).append("duration_seconds", String(durationSeconds));
    }

    // Do NOT set Content-Type manually: React Native's XHR layer adds
    // `multipart/form-data; boundary=...` itself. Hard-coding the header
    // without a boundary makes the upload stall forever on device.
    const res = await this.client.post("/api/recordings", formData);
    return res.data;
  }

  async getRecordings(): Promise<Recording[]> {
    const res = await this.client.get("/api/recordings");
    return res.data;
  }

  async getRecording(id: string): Promise<Recording> {
    const res = await this.client.get(`/api/recordings/${id}`);
    return res.data;
  }

  async getRecordingAudio(id: string): Promise<{ audioUrl: string; expiresIn: number | null }> {
    const res = await this.client.get(`/api/recordings/${id}/audio`);
    return {
      audioUrl: res.data.audio_url,
      expiresIn: res.data.expires_in ?? null,
    };
  }

  async healthCheck(): Promise<{ storage: boolean; supabase: boolean }> {
    const res = await this.client.get("/api/health");
    return res.data;
  }
}

class ApiErrorImpl implements ApiError {
  constructor(public message: string, public status?: number) {}
}

export const apiService = new ApiService();
