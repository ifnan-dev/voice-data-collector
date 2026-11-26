import { File, Paths } from "expo-file-system";

// Lossless capture format shared by every take. Defined here (not in the
// recorder hook) so this module has no dependency on the hook, avoiding a
// circular import between the hook and this transcoder.
export const WAV_SAMPLE_RATE = 16000;
export const WAV_CHANNELS = 1;
export const WAV_BIT_DEPTH = 16;
export const WAV_MIME_TYPE = "audio/wav";
export const WAV_EXTENSION = ".wav";

/**
 * Lossless-on-disk guarantees shared by every take.
 *
 * Native platforms record straight to PCM WAV. The browser cannot do that
 * (mediarecorder only offers Opus/WebM), so on web we decode the captured
 * Opus and re-encode it to a standard 16-bit PCM WAV container. Opus is
 * lossy at capture time on web; everything after that is byte-exact.
 */

const BYTES_PER_SAMPLE = WAV_BIT_DEPTH / 8;
export const MIN_WAV_BYTES = 44; // canonical header size

// The RN tsconfig has no DOM lib; describe just the browser surface we use.
type BrowserBlob = { arrayBuffer(): Promise<ArrayBuffer> };
type BrowserAudioContext = {
  decodeAudioData(data: ArrayBuffer): Promise<{
    numberOfChannels: number;
    sampleRate: number;
    getChannelData(channel: number): Float32Array;
  }>;
  close?(): Promise<void>;
};
type BrowserWindow = {
  AudioContext?: new (options?: { sampleRate?: number }) => BrowserAudioContext;
  webkitAudioContext?: new (options?: { sampleRate?: number }) => BrowserAudioContext;
};

function getBrowserWindow(): BrowserWindow | null {
  const g = globalThis as unknown as { window?: BrowserWindow };
  return g.window ?? null;
}

/** True when the file starts with a RIFF....WAVE header. */
export async function isWavFile(uri: string): Promise<boolean> {
  try {
    const file = new File(uri);
    if (!file.exists || file.size < MIN_WAV_BYTES) return false;
    const head = file.slice(0, 12);
    const bytes = new Uint8Array(await (head as unknown as BrowserBlob).arrayBuffer());
    const ascii = (from: number, to: number) =>
      String.fromCharCode(...bytes.slice(from, to));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  } catch {
    return false;
  }
}

/**
 * Expected size of a PCM WAV take, used to cross-check that a stop() did not
 * truncate the file. Returns 0 when the duration is unknown.
 */
export function expectedWavBytes(seconds: number): number {
  if (!seconds || seconds <= 0) return 0;
  return (
    Math.ceil(seconds * WAV_SAMPLE_RATE * WAV_CHANNELS * BYTES_PER_SAMPLE) +
    MIN_WAV_BYTES
  );
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(MIN_WAV_BYTES + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, WAV_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * WAV_CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, WAV_CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, WAV_BIT_DEPTH, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = MIN_WAV_BYTES;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += BYTES_PER_SAMPLE;
  }
  return buffer;
}

/**
 * Web-only: turn the recorded WebM/Opus blob into a 16 kHz mono PCM WAV file
 * in the app document directory. Returns the original URI untouched when
 * conversion is not possible, so the take is never lost.
 */
export async function convertWebTakeToWav(uri: string): Promise<string> {
  const win = getBrowserWindow();
  if (!win) return uri;
  try {
    const blob = (await (await fetch(uri)).blob()) as unknown as BrowserBlob;
    const AudioContextCtor = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextCtor) return uri;

    const ctx = new AudioContextCtor({ sampleRate: WAV_SAMPLE_RATE });
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    let pcm: Float32Array;
    if (decoded.numberOfChannels === 1) {
      pcm = decoded.getChannelData(0);
    } else {
      const left = decoded.getChannelData(0);
      const right = decoded.getChannelData(1);
      pcm = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) pcm[i] = (left[i] + right[i]) / 2;
    }
    await ctx.close?.();

    const wav = encodeWav(pcm, decoded.sampleRate || WAV_SAMPLE_RATE);
    const name = `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(wav));
    return file.uri;
  } catch {
    return uri;
  }
}
