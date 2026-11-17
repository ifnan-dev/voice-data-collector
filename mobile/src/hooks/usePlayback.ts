import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer } from "expo-audio";

type Player = ReturnType<typeof createAudioPlayer>;

export function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const releasePlayer = useCallback(() => {
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch { /* ignore */ }
      playerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
      releasePlayer();
    };
  }, [releasePlayer, stopPolling]);

  const stop = useCallback(() => {
    stopPolling();
    releasePlayer();
    setPlaying(false);
    setLoading(false);
  }, [releasePlayer, stopPolling]);

  const play = useCallback(async (uri: string) => {
    stopPolling();
    releasePlayer();
    setError(null);
    setLoading(true);
    try {
      const player = createAudioPlayer(uri, { updateInterval: 250 });
      playerRef.current = player;
      player.play();
      if (!mountedRef.current) return;
      setPlaying(true);
      setLoading(false);

      pollRef.current = setInterval(() => {
        const current = playerRef.current;
        if (!current) {
          stopPolling();
          return;
        }
        const st = current.currentStatus;
        if (st.didJustFinish) {
          stopPolling();
          if (!mountedRef.current) return;
          setPlaying(false);
        }
      }, 250);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setLoading(false);
      setPlaying(false);
      setError(e?.message ?? "Playback failed");
    }
  }, [releasePlayer, stopPolling]);

  return { playing, loading, error, play, stop };
}
