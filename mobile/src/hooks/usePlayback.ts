import { useCallback, useRef, useState, useEffect } from "react";
import { createAudioPlayer } from "expo-audio";

export function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (playerRef.current) {
        try { playerRef.current.remove(); } catch { /* ignore */ }
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  const play = useCallback(async (uri: string) => {
    stopPolling();
    setError(null);
    setLoading(true);
    try {
      if (playerRef.current) {
        try { playerRef.current.remove(); } catch { /* ignore */ }
      }
      const player = createAudioPlayer(uri, { updateInterval: 500 });
      playerRef.current = player;
      player.play();
      setPlaying(true);
      setLoading(false);
      const poll = () => {
        const st = player.currentStatus;
        if (!st.playing && st.didJustFinish) {
          setPlaying(false);
          stopPolling();
          return;
        }
        pollRef.current = setTimeout(poll, 500);
      };
      poll();
    } catch (e: any) {
      setLoading(false);
      setPlaying(false);
      setError(e?.message ?? "Playback failed");
    }
  }, []);

  const stop = useCallback(() => {
    stopPolling();
    setPlaying(false);
    setLoading(false);
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch { /* ignore */ }
      playerRef.current = null;
    }
  }, []);

  return { playing, loading, error, play, stop };
}
