/**
 * AudioContext — global audio state.
 *
 * PERFORMANCE DESIGN
 * ──────────────────
 * The core performance problem with a naïve audio context is that
 * useAudioPlayerStatus fires ~2–4× per second while playing, and if
 * currentTime/isPlaying are in a single context value, every consumer
 * (including all 50 AudioList rows) re-renders on every tick.
 *
 * Solution: split into two contexts.
 *
 * AudioStableContext  — changes rarely (track switch, error, rate change)
 *   currentAudio, audioLoading, audioError, playbackRate
 *   commands: loadAudio, play, pause, seek, stop, setSpeed
 *
 * AudioLiveContext    — changes every status tick (playing, time, buffering)
 *   isPlaying, isBuffering, didJustFinish
 *   (currentTime and duration are NOT in context — read directly from the
 *    player ref inside PlayerBar using a local useAudioPlayerStatus call)
 *
 * AudioListScreen rows only consume AudioStableContext → zero re-renders
 * from playback ticks. Only PlayerBar subscribes to the live status.
 *
 * DB PERSISTENCE
 * ──────────────
 * Position is written to SQLite at most every 5 seconds while playing,
 * and immediately on pause.
 */

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
const SPEED_STORAGE_KEY   = '@riyadus:playback_speed';
const DEFAULT_SPEED       = 1;

// ── Contexts ──────────────────────────────────────────────────────────────────

const AudioStableContext = createContext(null);
const AudioLiveContext   = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AudioProvider({ children }) {
  const [currentAudio,  setCurrentAudio]  = useState(null);
  const [audioLoading,  setAudioLoading]  = useState(false);
  const [audioError,    setAudioError]    = useState(null);
  const [playbackRate,  setPlaybackRate]  = useState(DEFAULT_SPEED);

  // Keep the player ref stable for useAudioPlayerStatus
  const playerRef    = useRef(getPlayer());
  const lastPersist       = useRef(0);
  // Tracks the audio ID whose duration has already been saved this session.
  // Prevents writing the same duration repeatedly on every status tick.
  const durationSavedFor  = useRef(null);

  // Live status — drives AudioLiveContext only
  const status = useAudioPlayerStatus(playerRef.current);

  // ── Session config ─────────────────────────────────────────────────
  useEffect(() => { configureAudioSession(); }, []);

  // ── Restore saved speed on mount ───────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SPEED_STORAGE_KEY).then((stored) => {
      const rate = stored ? parseFloat(stored) : DEFAULT_SPEED;
      if (rate && rate > 0 && rate <= 2) {
        setPlaybackRate(rate);
        svcSetRate(rate);
      }
    }).catch(() => {});
  }, []);

  // ── Completion: reset DB position ──────────────────────────────────
  useEffect(() => {
    if (status.didJustFinish && currentAudio) {
      savePlaybackPosition(currentAudio.id, 0).catch(() => {});
    }
  }, [status.didJustFinish, currentAudio]);

  // ── Throttled position persistence ────────────────────────────────
  useEffect(() => {
    if (!status.playing || !currentAudio) return;
    const now = Date.now();
    if (now - lastPersist.current >= PERSIST_INTERVAL_MS) {
      lastPersist.current = now;
      const posMs = Math.round(status.currentTime * 1_000);
      savePlaybackPosition(currentAudio.id, posMs).catch(() => {});
    }
  }, [status.playing, status.currentTime, currentAudio]);

  // ── One-time duration persistence ─────────────────────────────────
  // Saves duration_ms the first time expo-audio reports a valid duration
  // for the current track. Only writes once per loaded track per session,
  // and only when the DB row doesn't already have a stored duration.
  useEffect(() => {
    if (!currentAudio) return;

    // Validate the reported duration
    const secs = status.duration;
    if (!secs || !isFinite(secs) || secs <= 0) return;

    // Guard: already saved duration for this audio ID this session
    if (durationSavedFor.current === currentAudio.id) return;

    // Guard: DB row already has a valid duration — skip the write
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

  // ── Commands ──────────────────────────────────────────────────────

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
    // Reset so the new track's duration gets persisted when expo-audio reports it
    durationSavedFor.current = null;

    try {
      loadSource(source);
      // Re-apply current speed to the new track
      svcSetRate(playbackRate);
      if (startPositionMs > 0) {
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
    try { svcPlay(); } catch (err) { setAudioError(err); }
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
    try { await svcSeekTo(seconds); }
    catch (err) { console.warn('[AudioContext] seek failed:', err); }
  }, []);

  const stop = useCallback(async () => {
    try {
      await svcStop();
      if (currentAudio) savePlaybackPosition(currentAudio.id, 0).catch(() => {});
    } catch (err) { console.warn('[AudioContext] stop failed:', err); }
  }, [currentAudio]);

  const setSpeed = useCallback((rate) => {
    setPlaybackRate(rate);
    svcSetRate(rate);
    AsyncStorage.setItem(SPEED_STORAGE_KEY, String(rate)).catch(() => {});
  }, []);

  // ── Context values ────────────────────────────────────────────────

  // Stable: only changes on track switch / error / speed change
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

  // Live: changes on every status tick — only PlayerBar subscribes
  const liveValue = {
    isPlaying:    status.playing      ?? false,
    isBuffering:  status.isBuffering  ?? false,
    didJustFinish: status.didJustFinish ?? false,
    currentTime:  status.currentTime  ?? 0,
    duration:     status.duration     ?? 0,
  };

  return (
    <AudioStableContext.Provider value={stableValue}>
      <AudioLiveContext.Provider value={liveValue}>
        {children}
      </AudioLiveContext.Provider>
    </AudioStableContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * useAudio() — stable audio state + commands.
 * Safe to use in FlatList rows — does NOT re-render on playback ticks.
 * Provides: currentAudio, audioLoading, audioError, playbackRate,
 *           loadAudio, play, pause, seek, stop, setSpeed, clearAudioError.
 * Also includes isPlaying from the live context (needed for row active state).
 */
export function useAudio() {
  const stable = useContext(AudioStableContext);
  const live   = useContext(AudioLiveContext);
  if (!stable) throw new Error('useAudio must be used within AudioProvider');
  return { ...stable, isPlaying: live.isPlaying };
}

/**
 * useAudioPlayer() — full live playback state for the player UI.
 * Re-renders on every status tick (~2–4× per second while playing).
 * Only use inside the PlayerBar component.
 */
export function useAudioPlayer() {
  const stable = useContext(AudioStableContext);
  const live   = useContext(AudioLiveContext);
  if (!stable) throw new Error('useAudioPlayer must be used within AudioProvider');
  return { ...stable, ...live };
}
