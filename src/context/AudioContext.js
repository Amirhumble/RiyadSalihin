// Shared audio state for the whole app.
//
// AudioStableContext — track, play/pause flag, speed, commands (changes rarely)
// AudioLiveContext   — time / buffering (ticks while playing)
//
// List rows use useAudio() → only stable context → no re-render on time ticks.
// PlayerBar uses useAudioPlayer() → live progress.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { saveDuration, savePlaybackPosition } from '@/database/repositories/audioRepository';
import { getCachedAudioUri, getLocalAudioUri } from '@/services/audioCache';
import {
  configureAudioSession,
  getPlayer,
  loadSource,
  pause as svcPause,
  play as svcPlay,
  seekTo as svcSeekTo,
  setRate as svcSetRate,
  stop as svcStop,
} from '@/services/AudioService';

const PERSIST_INTERVAL_MS = 5_000;
const SPEED_STORAGE_KEY = '@riyadus:playback_speed';
const DEFAULT_SPEED = 1;

const AudioStableContext = createContext(null);
const AudioLiveContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentAudio, setCurrentAudio] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_SPEED);

  const playerRef = useRef(getPlayer());
  const lastPersist = useRef(0);
  const durationSavedFor = useRef(null);
  const currentAudioRef = useRef(null);
  const loadedFilenameRef = useRef(null);
  const actionLock = useRef(false);
  const loadGen = useRef(0);

  const status = useAudioPlayerStatus(playerRef.current);

  useEffect(() => {
    currentAudioRef.current = currentAudio;
  }, [currentAudio]);

  useEffect(() => {
    configureAudioSession();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SPEED_STORAGE_KEY).then((stored) => {
      const rate = stored ? parseFloat(stored) : DEFAULT_SPEED;
      if (rate && rate > 0 && rate <= 2) {
        setPlaybackRate(rate);
        try { svcSetRate(rate); } catch (_) { /* unsupported rate */ }
      }
    }).catch(() => {});
  }, []);

  // Reset saved position when a track finishes
  useEffect(() => {
    if (status.didJustFinish && currentAudio) {
      savePlaybackPosition(currentAudio.id, 0).catch(() => {});
    }
  }, [status.didJustFinish, currentAudio]);

  // Save position at most every 5 seconds while playing (never during UI-only drag)
  useEffect(() => {
    if (!status.playing || !currentAudio) return;
    if (status.didJustFinish) return;
    const now = Date.now();
    if (now - lastPersist.current >= PERSIST_INTERVAL_MS) {
      lastPersist.current = now;
      const posMs = Math.round((status.currentTime ?? 0) * 1_000);
      if (posMs >= 0) {
        savePlaybackPosition(currentAudio.id, posMs).catch(() => {});
      }
    }
  }, [status.playing, status.currentTime, status.didJustFinish, currentAudio]);

  // Save duration once per track when expo-audio first reports it
  useEffect(() => {
    if (!currentAudio) return;

    const secs = status.duration;
    if (!secs || !isFinite(secs) || secs <= 0) return;
    if (durationSavedFor.current === currentAudio.id) return;

    if (currentAudio.duration_ms > 0) {
      durationSavedFor.current = currentAudio.id;
      return;
    }

    durationSavedFor.current = currentAudio.id;
    const durationMs = Math.round(secs * 1_000);
    saveDuration(currentAudio.id, durationMs).catch((err) =>
      console.warn('[AudioContext] saveDuration failed:', err)
    );
  }, [status.duration, currentAudio]);

  const playExisting = useCallback(() => {
    const player = playerRef.current;
    const current = player?.currentTime ?? 0;
    const duration = player?.duration ?? 0;

    if (duration > 0 && current >= Math.max(0, duration - 0.35)) {
      svcSeekTo(0).then(() => svcPlay()).catch(() => {
        try { svcPlay(); } catch (_) { /* ignore */ }
      });
      return;
    }

    svcPlay();
  }, []);

  const playNewSource = useCallback((startPositionMs, gen) => {
    const resumeAt = Math.max(0, (startPositionMs || 0) / 1_000);
    if (resumeAt > 0) {
      setTimeout(() => {
        if (gen !== loadGen.current) return;
        svcSeekTo(resumeAt).then(() => svcPlay()).catch(() => {
          try { svcPlay(); } catch (_) { /* ignore */ }
        });
      }, 250);
      return;
    }
    svcPlay();
  }, []);

  const loadAudio = useCallback(async (audioRecord, startPositionMs = 0) => {
    if (!audioRecord?.filename) {
      setAudioError(new Error('No filename on audio record.'));
      return;
    }

    const gen = ++loadGen.current;
    setAudioError(null);

    // Already in the player — play/pause must not replace the source or flash loading.
    if (loadedFilenameRef.current === audioRecord.filename) {
      setAudioLoading(false);
      setDownloadProgress(null);
      if (currentAudioRef.current?.id !== audioRecord.id) {
        setCurrentAudio(audioRecord);
      }
      try {
        playExisting();
      } catch (err) {
        setAudioError(err);
      }
      return;
    }

    setCurrentAudio(audioRecord);
    durationSavedFor.current = null;
    lastPersist.current = 0;

    // Sync cache hit: use the local URI immediately. Never set audioLoading.
    const cachedUri = getCachedAudioUri(audioRecord.filename);
    if (cachedUri) {
      setAudioLoading(false);
      setDownloadProgress(null);
      try {
        loadSource({ uri: cachedUri });
        loadedFilenameRef.current = audioRecord.filename;
        try { svcSetRate(playbackRate); } catch (_) { /* ignore */ }
        playNewSource(startPositionMs, gen);
      } catch (err) {
        if (gen !== loadGen.current) return;
        loadedFilenameRef.current = null;
        console.error('[AudioContext] loadAudio failed:', err);
        setAudioError(err);
      }
      return;
    }

    setAudioLoading(true);
    setDownloadProgress(0);

    try {
      const uri = await getLocalAudioUri(audioRecord.filename, {
        onProgress: (progress) => {
          if (gen !== loadGen.current) return;
          setDownloadProgress(progress);
        },
      });
      if (gen !== loadGen.current) return;

      loadSource({ uri });
      loadedFilenameRef.current = audioRecord.filename;
      try { svcSetRate(playbackRate); } catch (_) { /* ignore */ }
      playNewSource(startPositionMs, gen);
    } catch (err) {
      if (gen !== loadGen.current) return;
      loadedFilenameRef.current = null;
      console.error('[AudioContext] loadAudio failed:', err);
      setAudioError(err);
    } finally {
      if (gen === loadGen.current) {
        setAudioLoading(false);
        setDownloadProgress(null);
      }
    }
  }, [playbackRate, playExisting, playNewSource]);

  const play = useCallback(() => {
    if (actionLock.current) return;
    actionLock.current = true;
    setAudioError(null);
    try {
      const p = playerRef.current;
      const dur = p?.duration ?? 0;
      const t = p?.currentTime ?? 0;
      // After completion (or at end), restart from the beginning
      if (dur > 0 && t >= Math.max(0, dur - 0.35)) {
        svcSeekTo(0).then(() => svcPlay()).catch(() => {
          try { svcPlay(); } catch (err) { setAudioError(err); }
        });
      } else {
        svcPlay();
      }
    } catch (err) {
      setAudioError(err);
    } finally {
      setTimeout(() => { actionLock.current = false; }, 120);
    }
  }, []);

  const pause = useCallback(() => {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      svcPause();
      const audio = currentAudioRef.current;
      if (audio) {
        const posMs = Math.round((playerRef.current.currentTime ?? 0) * 1_000);
        if (posMs >= 0) {
          lastPersist.current = Date.now();
          savePlaybackPosition(audio.id, posMs).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[AudioContext] pause failed:', err);
    } finally {
      setTimeout(() => { actionLock.current = false; }, 120);
    }
  }, []);

  const seek = useCallback(async (seconds) => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    try {
      const p = playerRef.current;
      const dur = p?.duration ?? 0;
      const clamped = dur > 0 ? Math.min(safe, dur) : safe;
      await svcSeekTo(clamped);
      const audio = currentAudioRef.current;
      if (audio) {
        lastPersist.current = Date.now();
        savePlaybackPosition(audio.id, Math.round(clamped * 1_000)).catch(() => {});
      }
    } catch (err) {
      console.warn('[AudioContext] seek failed:', err);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await svcStop();
      const audio = currentAudioRef.current;
      if (audio) savePlaybackPosition(audio.id, 0).catch(() => {});
    } catch (err) {
      console.warn('[AudioContext] stop failed:', err);
    }
  }, []);

  const setSpeed = useCallback((rate) => {
    const safe = Math.max(0.5, Math.min(Number(rate) || 1, 2));
    setPlaybackRate(safe);
    try {
      svcSetRate(safe);
    } catch (err) {
      console.warn('[AudioContext] setSpeed failed:', err);
    }
    AsyncStorage.setItem(SPEED_STORAGE_KEY, String(safe)).catch(() => {});
  }, []);

  const clearAudioError = useCallback(() => setAudioError(null), []);

  const isPlaying = status.playing ?? false;

  // Stable value only changes on track / play state / speed / error — not on time ticks
  const stableValue = useMemo(() => ({
    currentAudio,
    audioLoading,
    audioError,
    playbackRate,
    isPlaying,
    clearAudioError,
    loadAudio,
    play,
    pause,
    seek,
    stop,
    setSpeed,
  }), [
    currentAudio,
    audioLoading,
    audioError,
    playbackRate,
    isPlaying,
    clearAudioError,
    loadAudio,
    play,
    pause,
    seek,
    stop,
    setSpeed,
  ]);

  const liveValue = useMemo(() => ({
    isPlaying,
    isBuffering: status.isBuffering ?? false,
    didJustFinish: status.didJustFinish ?? false,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
    downloadProgress,
  }), [
    isPlaying,
    status.isBuffering,
    status.didJustFinish,
    status.currentTime,
    status.duration,
    downloadProgress,
  ]);

  return (
    <AudioStableContext.Provider value={stableValue}>
      <AudioLiveContext.Provider value={liveValue}>
        {children}
      </AudioLiveContext.Provider>
    </AudioStableContext.Provider>
  );
}

// Stable state only — safe in list rows (does not re-render on time ticks).
export function useAudio() {
  const stable = useContext(AudioStableContext);
  if (!stable) throw new Error('useAudio must be used within AudioProvider');
  return stable;
}

// Full live state for the player UI. Re-renders while audio plays.
export function useAudioPlayer() {
  const stable = useContext(AudioStableContext);
  const live = useContext(AudioLiveContext);
  if (!stable) throw new Error('useAudioPlayer must be used within AudioProvider');
  return { ...stable, ...live };
}
