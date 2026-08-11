// Shared audio state for the whole app.
//
// Two contexts keep list rows cheap:
//   AudioStableContext — track, errors, speed, commands (rarely changes)
//   AudioLiveContext   — playing / time / buffering (updates while playing)
//
// List rows use useAudio() so they do not re-render on every time tick.
// PlayerBar uses useAudioPlayer() so it can show live progress.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { saveDuration, savePlaybackPosition } from '@/database/repositories/audioRepository';
import { resolveAudioSource } from '@/services/audioAssets';
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
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_SPEED);

  const playerRef = useRef(getPlayer());
  const lastPersist = useRef(0);
  // Only write duration once per track per session
  const durationSavedFor = useRef(null);

  const status = useAudioPlayerStatus(playerRef.current);

  useEffect(() => {
    configureAudioSession();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SPEED_STORAGE_KEY).then((stored) => {
      const rate = stored ? parseFloat(stored) : DEFAULT_SPEED;
      if (rate && rate > 0 && rate <= 2) {
        setPlaybackRate(rate);
        svcSetRate(rate);
      }
    }).catch(() => {});
  }, []);

  // Reset saved position when a track finishes
  useEffect(() => {
    if (status.didJustFinish && currentAudio) {
      savePlaybackPosition(currentAudio.id, 0).catch(() => {});
    }
  }, [status.didJustFinish, currentAudio]);

  // Save position at most every 5 seconds while playing
  useEffect(() => {
    if (!status.playing || !currentAudio) return;
    const now = Date.now();
    if (now - lastPersist.current >= PERSIST_INTERVAL_MS) {
      lastPersist.current = now;
      const posMs = Math.round(status.currentTime * 1_000);
      savePlaybackPosition(currentAudio.id, posMs).catch(() => {});
    }
  }, [status.playing, status.currentTime, currentAudio]);

  // Save duration the first time expo-audio reports it for this track
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

  const loadAudio = useCallback(async (audioRecord, startPositionMs = 0) => {
    if (!audioRecord?.filename) {
      setAudioError(new Error('No filename on audio record.'));
      return;
    }
    const source = resolveAudioSource(audioRecord.filename);
    if (!source) {
      setAudioError(new Error(`Audio "${audioRecord.filename}" not available.`));
      return;
    }

    setAudioLoading(true);
    setAudioError(null);
    setCurrentAudio(audioRecord);
    durationSavedFor.current = null;

    try {
      loadSource(source);
      svcSetRate(playbackRate);
      if (startPositionMs > 0) {
        // Brief delay so the new source is ready before seeking
        setTimeout(() => svcSeekTo(startPositionMs / 1_000).catch(() => {}), 300);
      }
      svcPlay();
    } catch (err) {
      console.error('[AudioContext] loadAudio failed:', err);
      setAudioError(err);
    } finally {
      setAudioLoading(false);
    }
  }, [playbackRate]);

  const play = useCallback(() => {
    setAudioError(null);
    try {
      svcPlay();
    } catch (err) {
      setAudioError(err);
    }
  }, []);

  const pause = useCallback(() => {
    try {
      svcPause();
      if (currentAudio) {
        const posMs = Math.round((playerRef.current.currentTime ?? 0) * 1_000);
        savePlaybackPosition(currentAudio.id, posMs).catch(() => {});
      }
    } catch (err) {
      console.warn('[AudioContext] pause failed:', err);
    }
  }, [currentAudio]);

  const seek = useCallback(async (seconds) => {
    try {
      await svcSeekTo(seconds);
    } catch (err) {
      console.warn('[AudioContext] seek failed:', err);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await svcStop();
      if (currentAudio) savePlaybackPosition(currentAudio.id, 0).catch(() => {});
    } catch (err) {
      console.warn('[AudioContext] stop failed:', err);
    }
  }, [currentAudio]);

  const setSpeed = useCallback((rate) => {
    setPlaybackRate(rate);
    svcSetRate(rate);
    AsyncStorage.setItem(SPEED_STORAGE_KEY, String(rate)).catch(() => {});
  }, []);

  const stableValue = {
    currentAudio,
    audioLoading,
    audioError,
    playbackRate,
    clearAudioError: () => setAudioError(null),
    loadAudio,
    play,
    pause,
    seek,
    stop,
    setSpeed,
  };

  const liveValue = {
    isPlaying: status.playing ?? false,
    isBuffering: status.isBuffering ?? false,
    didJustFinish: status.didJustFinish ?? false,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
  };

  return (
    <AudioStableContext.Provider value={stableValue}>
      <AudioLiveContext.Provider value={liveValue}>
        {children}
      </AudioLiveContext.Provider>
    </AudioStableContext.Provider>
  );
}

// Stable state + commands. Safe in list rows (does not tick with playback time).
export function useAudio() {
  const stable = useContext(AudioStableContext);
  const live = useContext(AudioLiveContext);
  if (!stable) throw new Error('useAudio must be used within AudioProvider');
  return { ...stable, isPlaying: live.isPlaying };
}

// Full live state for the player UI. Re-renders while audio plays.
export function useAudioPlayer() {
  const stable = useContext(AudioStableContext);
  const live = useContext(AudioLiveContext);
  if (!stable) throw new Error('useAudioPlayer must be used within AudioProvider');
  return { ...stable, ...live };
}
