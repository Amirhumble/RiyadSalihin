/**
 * AudioContext — global audio player state.
 *
 * Wraps the shared AudioPlayer from AudioService so that:
 *  - Navigation between screens never creates a second player.
 *  - Any component can read player state or dispatch commands.
 *  - DB persistence (savePlaybackPosition) is throttled here, not in screens.
 *
 * Architecture
 * ────────────
 *   AudioProvider (in app/_layout.js)
 *     └─ calls configureAudioSession once
 *     └─ owns loadAudio / play / pause / seek / stop
 *     └─ subscribes to expo-audio status via useAudioPlayerStatus
 *     └─ writes position to DB every PERSIST_INTERVAL_MS while playing
 *
 *   useAudio() hook
 *     └─ consumed by AudioPlayer component and screens
 */

import { useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { savePlaybackPosition } from '@/database/repositories/audioRepository';
import { resolveAudioSource } from '@/services/audioAssets';
import {
    configureAudioSession,
    getPlayer,
    loadSource,
    pause as svcPause,
    play as svcPlay,
    seekTo as svcSeekTo,
    stop as svcStop,
} from '@/services/AudioService';

/** Write position to DB at most once every 5 seconds while playing. */
const PERSIST_INTERVAL_MS = 5_000;

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  // Currently loaded audio record from the DB { id, filename, title, … }
  const [currentAudio, setCurrentAudio] = useState(null);
  // Loading / error state at the application level
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError]     = useState(null);

  // The shared player lives inside AudioService; we just hold the ref here
  // so we can pass it to useAudioPlayerStatus.
  const playerRef = useRef(getPlayer());

  // Reactive status from expo-audio (updates ~4×/sec while playing).
  const status = useAudioPlayerStatus(playerRef.current);

  // ── Session configuration ──────────────────────────────────────────
  useEffect(() => {
    configureAudioSession();
  }, []);

  // ── Playback-completion handler ────────────────────────────────────
  useEffect(() => {
    if (status.didJustFinish && currentAudio) {
      // Reset position in DB so the track can be replayed from the start.
      savePlaybackPosition(currentAudio.id, 0).catch((err) =>
        console.warn('[AudioContext] failed to reset position:', err)
      );
    }
  }, [status.didJustFinish, currentAudio]);

  // ── Throttled position persistence ────────────────────────────────
  const lastPersistRef = useRef(0);

  useEffect(() => {
    if (!status.playing || !currentAudio) return;

    const nowMs = Date.now();
    if (nowMs - lastPersistRef.current >= PERSIST_INTERVAL_MS) {
      lastPersistRef.current = nowMs;
      const posMs = Math.round(status.currentTime * 1000);
      savePlaybackPosition(currentAudio.id, posMs).catch((err) =>
        console.warn('[AudioContext] savePlaybackPosition failed:', err)
      );
    }
  }, [status.playing, status.currentTime, currentAudio]);

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Load an audio DB record and start playing.
   *
   * @param {object} audioRecord  – Row from the audios table.
   * @param {number} [startPositionMs=0]  – Resume from this position.
   */
  const loadAudio = useCallback(async (audioRecord, startPositionMs = 0) => {
    if (!audioRecord?.filename) {
      setAudioError(new Error('No filename on audio record.'));
      return;
    }

    const source = resolveAudioSource(audioRecord.filename);
    if (!source) {
      setAudioError(
        new Error(`Audio file "${audioRecord.filename}" is not available.`)
      );
      return;
    }

    setAudioLoading(true);
    setAudioError(null);
    setCurrentAudio(audioRecord);

    try {
      loadSource(source);

      // Seek to saved position after a brief moment to allow the player
      // to register the new source before seeking.
      if (startPositionMs > 0) {
        setTimeout(() => {
          svcSeekTo(startPositionMs / 1000).catch(() => {});
        }, 300);
      }

      svcPlay();
    } catch (err) {
      console.error('[AudioContext] loadAudio failed:', err);
      setAudioError(err);
    } finally {
      setAudioLoading(false);
    }
  }, []);

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
      // Persist position immediately on manual pause.
      if (currentAudio) {
        const posMs = Math.round((playerRef.current.currentTime ?? 0) * 1000);
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
      if (currentAudio) {
        savePlaybackPosition(currentAudio.id, 0).catch(() => {});
      }
    } catch (err) {
      console.warn('[AudioContext] stop failed:', err);
    }
  }, [currentAudio]);

  const value = {
    /** The audio record currently loaded (or null). */
    currentAudio,
    /** True while a new source is being loaded. */
    audioLoading,
    /** Error from last load / play attempt, or null. */
    audioError,
    /** Clears the current error. */
    clearAudioError: () => setAudioError(null),

    // ── Live status (from useAudioPlayerStatus) ──
    isPlaying:    status.playing,
    isPaused:     status.paused ?? !status.playing,
    isBuffering:  status.isBuffering,
    isLoaded:     status.isLoaded,
    didJustFinish: status.didJustFinish,
    currentTime:  status.currentTime  ?? 0,   // seconds
    duration:     status.duration     ?? 0,   // seconds

    // ── Commands ──────────────────────────────────
    loadAudio,
    play,
    pause,
    seek,
    stop,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return ctx;
}
