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
import { AppState } from 'react-native';

import { markAudioCompleted, saveDuration, savePlaybackPosition } from '@/database/repositories/audioRepository';
import { getCachedAudioUri, getLocalAudioUri, isAudioDownloadInflight } from '@/services/audioCache';
import { getRemoteAudioUrl } from '@/services/audioRemote';
import { settleBackgroundCache } from '@/services/cacheDownload';
import {
  freshProgressGate,
  PERSIST_INTERVAL_MS,
  reduceProgressGate,
  shouldMarkCompleted,
} from '@/services/lessonProgress';
import { createPlaybackGate } from '@/services/playbackCommands';
import {
  configureAudioSession,
  getPlayer,
  loadSource,
  pause as svcPause,
  play as svcPlay,
  seekTo as svcSeekTo,
  setRate as svcSetRate,
} from '@/services/AudioService';

const SPEED_STORAGE_KEY = '@riyadus:playback_speed';
const DEFAULT_SPEED = 1;
const STREAM_READY_TIMEOUT_MS = 25_000;

function playbackError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

const AudioStableContext = createContext(null);
const AudioLiveContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentAudio, setCurrentAudio] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_SPEED);

  const playerRef = useRef(getPlayer());
  const lastPersist = useRef(0);
  const durationSavedFor = useRef(null);
  const currentAudioRef = useRef(null);
  const loadedFilenameRef = useRef(null);
  const loadGen = useRef(0);
  const pendingStartRef = useRef(null);
  const streamFailedRef = useRef(false);
  const finishedForRef = useRef(null);
  const completedWriteRef = useRef(new Set());
  const suspendProgressRef = useRef(false);
  const progressGateRef = useRef(freshProgressGate(0, { unloaded: true }));
  const playbackRateRef = useRef(playbackRate);
  const gateRef = useRef(null);
  if (gateRef.current == null) {
    gateRef.current = createPlaybackGate({
      play: () => svcPlay(),
      pause: () => svcPause(),
      seekTo: (seconds) => svcSeekTo(seconds),
    });
  }

  const status = useAudioPlayerStatus(playerRef.current);

  useEffect(() => {
    currentAudioRef.current = currentAudio;
  }, [currentAudio]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

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

  const persistAudio = useCallback((audio, { ended = false } = {}) => {
    if (!audio?.id) return;
    // The end handler already stored completion and a 0 resume point.
    // A later pause, switch, or background tick must not overwrite that 0
    // with the position still sitting at the end of the file.
    if (!ended && finishedForRef.current === audio.id) return;

    const player = playerRef.current;
    const time = player?.currentTime ?? 0;
    const dur = player?.duration ?? 0;
    const mark = ended || shouldMarkCompleted({
      currentTimeSec: time,
      durationSec: dur,
      didJustFinish: ended,
      playbackState: ended ? 'ended' : player?.playbackState,
    });
    const posMs = ended ? 0 : Math.max(0, Math.round(time * 1000));
    // Don't wipe a saved resume point when the player has not started.
    if (!ended && !mark && posMs === 0 && !progressGateRef.current.accept) return;

    if (mark) {
      completedWriteRef.current.add(audio.id);
      markAudioCompleted(audio.id, posMs).catch(() => {
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }
    lastPersist.current = Date.now();
    savePlaybackPosition(audio.id, posMs).catch(() => {});
  }, []);

  const armProgressGate = useCallback(() => {
    const player = playerRef.current;
    const loaded = Boolean(player?.isLoaded || player?.currentStatus?.isLoaded);
    progressGateRef.current = freshProgressGate(player?.currentTime ?? 0, { unloaded: !loaded });
  }, []);

  // Save progress while playing, and mark completion at the threshold or a real ending.
  // Status from the previous source is ignored until this source has actually loaded.
  useEffect(() => {
    if (suspendProgressRef.current) return;
    const audio = currentAudioRef.current;
    if (!audio) return;

    const reduced = reduceProgressGate(progressGateRef.current, status);
    progressGateRef.current = reduced.gate;
    if (!reduced.open) return;

    const time = status.currentTime ?? 0;
    const dur = status.duration ?? 0;
    const endedNow = Boolean(status.didJustFinish) || status.playbackState === 'ended';
    const mark = shouldMarkCompleted({
      currentTimeSec: time,
      durationSec: dur,
      didJustFinish: status.didJustFinish,
      playbackState: status.playbackState,
    });

    if (endedNow) {
      if (!mark || finishedForRef.current === audio.id) return;
      finishedForRef.current = audio.id;
      completedWriteRef.current.add(audio.id);
      markAudioCompleted(audio.id, 0).catch(() => {
        finishedForRef.current = null;
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }

    if (!status.playing) return;

    const posMs = Math.max(0, Math.round(time * 1000));
    const now = Date.now();
    const due = now - lastPersist.current >= PERSIST_INTERVAL_MS;

    if (mark && !completedWriteRef.current.has(audio.id)) {
      completedWriteRef.current.add(audio.id);
      lastPersist.current = now;
      markAudioCompleted(audio.id, posMs).catch(() => {
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }

    if (!due) return;
    lastPersist.current = now;
    savePlaybackPosition(audio.id, posMs).catch(() => {});
  }, [
    status.playing,
    status.currentTime,
    status.didJustFinish,
    status.playbackState,
    status.duration,
    status.isLoaded,
  ]);

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

  // Remote streams: drop the spinner as soon as the player has enough data.
  useEffect(() => {
    if (!audioLoading) return;
    if (status.isLoaded || status.playing) {
      setAudioLoading(false);
    }
  }, [audioLoading, status.isLoaded, status.playing]);

  // Seek to a saved position only after this source is ready, and only if
  // the user has not paused since the load started.
  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    if (pending.gen !== loadGen.current) return;
    if (!status.isLoaded) return;
    if (gateRef.current.getDesired() === 'pause') {
      pendingStartRef.current = null;
      return;
    }

    pendingStartRef.current = null;
    const resumeAt = Math.max(0, (pending.startPositionMs || 0) / 1_000);
    if (resumeAt <= 0) return;
    gateRef.current.requestSeek(resumeAt).catch(() => {});
  }, [status.isLoaded]);

  // If a remote stream never becomes ready, surface a retryable playback error.
  // A background save failure is not a playback failure.
  useEffect(() => {
    if (!audioLoading) return undefined;
    const gen = loadGen.current;
    const timeoutId = setTimeout(() => {
      if (gen !== loadGen.current) return;
      if (gateRef.current.getDesired() === 'pause') {
        setAudioLoading(false);
        return;
      }
      const player = playerRef.current;
      if (player?.isLoaded || player?.playing) {
        setAudioLoading(false);
        return;
      }
      streamFailedRef.current = true;
      pendingStartRef.current = null;
      setAudioLoading(false);
      setAudioError(playbackError(
        'PLAYBACK_FAILED',
        'Could not start this lesson. Check your connection and try again.'
      ));
    }, STREAM_READY_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [audioLoading]);

  // Apply a missed play or pause once the player is ready to accept it.
  useEffect(() => {
    gateRef.current.reconcile({
      playing: status.playing,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      didJustFinish: status.didJustFinish,
      playbackState: status.playbackState,
    });
  }, [
    status.playing,
    status.isLoaded,
    status.isBuffering,
    status.didJustFinish,
    status.playbackState,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      persistAudio(currentAudioRef.current);
    });
    return () => sub.remove();
  }, [persistAudio]);

  const applyCacheResult = useCallback((gen, audioRecord, startPositionMs, error, localUri) => {
    if (gen !== loadGen.current) return;
    const player = playerRef.current;
    const outcome = settleBackgroundCache({
      error,
      streamReady: Boolean(player?.playing || player?.isLoaded),
      streamFailed: streamFailedRef.current,
    });
    if (outcome.clearProgress) setDownloadProgress(null);
    if (outcome.downloadError) setDownloadError(outcome.downloadError);
    else if (!error) setDownloadError(null);

    if (outcome.playbackError) {
      pendingStartRef.current = null;
      if (!player?.playing && !player?.isLoaded) loadedFilenameRef.current = null;
      setAudioLoading(false);
      setAudioError((current) => current || outcome.playbackError);
      return;
    }

    if (!outcome.useDownloadedFile || !localUri) return;
    if (gateRef.current.getDesired() === 'pause') return;
    try {
      loadSource({ uri: localUri });
      loadedFilenameRef.current = audioRecord.filename;
      try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
      streamFailedRef.current = false;
      if (startPositionMs > 0) {
        pendingStartRef.current = { gen, startPositionMs };
      }
      gateRef.current.requestPlay().catch(() => {});
      setAudioLoading(false);
      setAudioError(null);
    } catch (err) {
      if (gen !== loadGen.current) return;
      setAudioLoading(false);
      setAudioError(err);
    }
  }, []);

  const play = useCallback(() => {
    setAudioError(null);
    finishedForRef.current = null;
    const player = playerRef.current;
    const dur = player?.duration ?? 0;
    const time = player?.currentTime ?? 0;
    const restart = dur > 0 && time >= Math.max(0, dur - 0.35);
    gateRef.current.requestPlay(restart ? { restartAt: 0 } : {}).catch((err) => {
      setAudioLoading(false);
      setAudioError(err);
    });
  }, []);

  const pause = useCallback(() => {
    setAudioLoading(false);
    gateRef.current.requestPause().then(() => {
      persistAudio(currentAudioRef.current);
    }).catch((err) => {
      console.warn('[AudioContext] pause failed:', err);
    });
  }, [persistAudio]);

  const loadAudio = useCallback(async (audioRecord, startPositionMs = 0) => {
    if (!audioRecord?.filename) {
      setAudioError(new Error('No filename on audio record.'));
      return;
    }

    const gen = ++loadGen.current;
    setAudioError(null);

    // Already in the player — play/pause must not replace the source or flash loading.
    if (loadedFilenameRef.current === audioRecord.filename) {
      pendingStartRef.current = null;
      setAudioLoading(false);
      setDownloadProgress(null);
      if (currentAudioRef.current?.id !== audioRecord.id) {
        setCurrentAudio(audioRecord);
      }
      play();
      return;
    }

    suspendProgressRef.current = true;
    const previous = currentAudioRef.current;
    if (previous && previous.id !== audioRecord.id) {
      persistAudio(previous);
    }
    if (Number(audioRecord.completed) === 1) {
      completedWriteRef.current.add(audioRecord.id);
    }
    finishedForRef.current = null;
    currentAudioRef.current = audioRecord;
    setCurrentAudio(audioRecord);
    durationSavedFor.current = null;
    lastPersist.current = 0;
    streamFailedRef.current = false;
    armProgressGate();

    const cachedUri = getCachedAudioUri(audioRecord.filename);
    if (cachedUri) {
      pendingStartRef.current = startPositionMs > 0 ? { gen, startPositionMs } : null;
      setAudioLoading(false);
      setDownloadProgress(null);
      setDownloadError(null);
      try {
        loadSource({ uri: cachedUri });
        loadedFilenameRef.current = audioRecord.filename;
        try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
        gateRef.current.requestPlay().catch((err) => {
          if (gen !== loadGen.current) return;
          setAudioError(err);
        });
      } catch (err) {
        if (gen !== loadGen.current) return;
        loadedFilenameRef.current = null;
        console.error('[AudioContext] loadAudio failed:', err);
        setAudioError(err);
      } finally {
        suspendProgressRef.current = false;
      }
      return;
    }

    // Cache miss: stream the remote MP3 immediately. Saving a local copy
    // reports its own progress and must not hold the play button.
    setAudioLoading(true);
    setDownloadError(null);
    setDownloadProgress(isAudioDownloadInflight(audioRecord.filename) ? null : 0);
    pendingStartRef.current = startPositionMs > 0 ? { gen, startPositionMs } : null;

    try {
      const remoteUrl = getRemoteAudioUrl(audioRecord.filename);
      loadSource({
        uri: remoteUrl,
        headers: { Accept: 'audio/mpeg,audio/*,*/*' },
      });
      loadedFilenameRef.current = audioRecord.filename;
      try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
      gateRef.current.requestPlay().catch((err) => {
        if (gen !== loadGen.current) return;
        setAudioLoading(false);
        setAudioError(err);
      });
    } catch (err) {
      if (gen !== loadGen.current) return;
      streamFailedRef.current = true;
      pendingStartRef.current = null;
      loadedFilenameRef.current = null;
      console.error('[AudioContext] loadAudio stream failed:', err);
      setAudioError(err);
      setAudioLoading(false);
    } finally {
      suspendProgressRef.current = false;
    }

    getLocalAudioUri(audioRecord.filename, {
      onProgress: (progress) => {
        if (gen !== loadGen.current) return;
        if (progress == null) return;
        setDownloadProgress(progress);
      },
    }).then((localUri) => {
      applyCacheResult(gen, audioRecord, startPositionMs, null, localUri);
    }).catch((err) => {
      applyCacheResult(gen, audioRecord, startPositionMs, err, null);
    });
  }, [applyCacheResult, armProgressGate, persistAudio, play]);

  const seek = useCallback((seconds) => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const player = playerRef.current;
    const dur = player?.duration ?? 0;
    const clamped = dur > 0 ? Math.min(safe, dur) : safe;
    // Scrubbing after the ending is a new resume point. Completion stays set.
    finishedForRef.current = null;
    return gateRef.current.requestSeek(clamped).then(() => {
      persistAudio(currentAudioRef.current);
    }).catch((err) => {
      console.warn('[AudioContext] seek failed:', err);
    });
  }, [persistAudio]);

  const stop = useCallback(() => {
    setAudioLoading(false);
    return gateRef.current.requestPause().then(() => gateRef.current.requestSeek(0)).then(() => {
      const audio = currentAudioRef.current;
      if (audio) savePlaybackPosition(audio.id, 0).catch(() => {});
    }).catch((err) => {
      console.warn('[AudioContext] stop failed:', err);
    });
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

  const retryOfflineSave = useCallback(() => {
    const audio = currentAudioRef.current;
    if (!audio?.filename) return;
    const gen = loadGen.current;
    setDownloadError(null);
    setDownloadProgress(0);
    getLocalAudioUri(audio.filename, {
      onProgress: (progress) => {
        if (gen !== loadGen.current) return;
        if (progress == null) return;
        setDownloadProgress(progress);
      },
    }).then(() => {
      if (gen !== loadGen.current) return;
      setDownloadProgress(null);
      setDownloadError(null);
    }).catch((err) => {
      if (gen !== loadGen.current) return;
      setDownloadProgress(null);
      if (err?.code === 'ABORTED') return;
      setDownloadError(err);
    });
  }, []);

  const isPlaying = status.playing ?? false;
  // A stuck finish flag must not hide playback, or pause can never be reached.
  const didJustFinish = Boolean(status.didJustFinish) && !isPlaying;

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
    retryOfflineSave,
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
    retryOfflineSave,
  ]);

  const liveValue = useMemo(() => ({
    isPlaying,
    isBuffering: status.isBuffering ?? false,
    didJustFinish,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
    downloadProgress,
    downloadError,
  }), [
    isPlaying,
    status.isBuffering,
    didJustFinish,
    status.currentTime,
    status.duration,
    downloadProgress,
    downloadError,
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
