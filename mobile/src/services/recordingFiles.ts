import { Directory, File, Paths } from "expo-file-system";

/**
 * Local, persistent storage for recorded takes.
 *
 * `expo-audio` writes each take to a temp path that the OS may wipe and that
 * the next recording reuses. We therefore copy every finished take into the
 * app's document directory under a unique name, so a recording survives app
 * restarts, permission bumps and later takes. Files are only removed after a
 * successful upload (`deleteTake`) or an explicit discard.
 */
const RECORDINGS_DIR_NAME = "recordings";

function getRecordingsDir(): Directory {
  const dir = new Directory(Paths.document, RECORDINGS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function extensionOf(uri: string): string {
  const clean = uri.split("?")[0];
  const dot = clean.lastIndexOf(".");
  const slash = clean.lastIndexOf("/");
  if (dot <= slash) return "";
  return clean.slice(dot).toLowerCase();
}

/**
 * Move a freshly recorded file into persistent storage and return its new
 * URI. Never deletes the source until the copy is confirmed to exist.
 */
export async function preserveTake(
  sourceUri: string,
  extension = ".wav",
): Promise<string> {
  const dir = getRecordingsDir();
  const ext = extensionOf(sourceUri) || extension;
  const name = `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const target = new File(dir, name);

  try {
    const source = new File(sourceUri);
    await source.copy(target);
    return target.uri;
  } catch {
    // Some URIs (e.g. content:// on Android) cannot be copied with the
    // File API; fall back to the legacy string-based copy which handles them.
    const { copyAsync } = await import("expo-file-system/legacy");
    await copyAsync({ from: sourceUri, to: target.uri });
    return target.uri;
  }
}

/** Remove a preserved take (best-effort; never throws). */
export async function deleteTake(
  uri: string | null | undefined,
): Promise<void> {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore: file already gone or not ours
  }
}
