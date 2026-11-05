import axios, { AxiosInstance } from "axios";
import type { TranscriptionResult, Recording, ApiError } from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

type RNFiles = { uri: string; type: string; name: string };

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

  async transcribe(
    uri: string,
    fileName: string,
    mimeType: string,
    language: string = "om"
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    (formData as any).append("file", this.filePart(uri, fileName, mimeType));
    (formData as any).append("language", language);

    const res = await this.client.post("/api/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
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

    const res = await this.client.post("/api/recordings", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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

  async healthCheck(): Promise<{ r2: boolean; supabase: boolean }> {
    const res = await this.client.get("/health");
    return res.data;
  }
}

class ApiErrorImpl implements ApiError {
  constructor(public message: string, public status?: number) {}
}

export const apiService = new ApiService();
