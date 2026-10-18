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
  RESUME_APPLY_THRESHOLD_MS,
  freshResume,
  isResumePending,
  planResumeStart,
  positionToSave,
  reduceResumeReady,
  resumeTargetSeconds,
} from '@/services/resumePosition';
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
  const acceptedPositionRef = useRef(null);
  const intentionalZeroRef = useRef(null);
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

    if (ended) {
      intentionalZeroRef.current = audio.id;
      acceptedPositionRef.current = { id: audio.id, ms: 0 };
      pendingStartRef.current = null;
      completedWriteRef.current.add(audio.id);
      markAudioCompleted(audio.id, 0).catch(() => {
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }

    const pending = pendingStartRef.current;
    const resumePending = isResumePending(pending, loadGen.current);
    const accepted = acceptedPositionRef.current;
    const rawMs = Math.max(0, Math.round(time * 1000));
    const posMs = positionToSave({
      playerMs: rawMs,
      acceptedMs: accepted?.id === audio.id ? accepted.ms : 0,
      resumeTargetMs: resumePending ? pending.startPositionMs : 0,
      resumePending,
      intentionalZero: intentionalZeroRef.current === audio.id,
    });

    if (mark) {
      if (posMs == null) return;
      completedWriteRef.current.add(audio.id);
      if (posMs >= RESUME_APPLY_THRESHOLD_MS) {
        acceptedPositionRef.current = { id: audio.id, ms: posMs };
      }
      markAudioCompleted(audio.id, posMs).catch(() => {
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }

    // A 0 from replace(), or before the new source has played, is not a resume point.
    if (posMs == null) return;
    if (posMs === 0 && intentionalZeroRef.current !== audio.id && !progressGateRef.current.accept) return;

    lastPersist.current = Date.now();
    if (posMs >= RESUME_APPLY_THRESHOLD_MS) {
      acceptedPositionRef.current = { id: audio.id, ms: posMs };
    }
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
      intentionalZeroRef.current = audio.id;
      acceptedPositionRef.current = { id: audio.id, ms: 0 };
      pendingStartRef.current = null;
      completedWriteRef.current.add(audio.id);
      markAudioCompleted(audio.id, 0).catch(() => {
        finishedForRef.current = null;
        completedWriteRef.current.delete(audio.id);
      });
      return;
    }

    if (!status.playing) return;

    const rawMs = Math.max(0, Math.round(time * 1000));
    const pending = pendingStartRef.current;
    const resumePending = isResumePending(pending, loadGen.current);
    const accepted = acceptedPositionRef.current;
    const posMs = positionToSave({
      playerMs: rawMs,
      acceptedMs: accepted?.id === audio.id ? accepted.ms : 0,
      resumeTargetMs: resumePending ? pending.startPositionMs : 0,
      resumePending,
      intentionalZero: intentionalZeroRef.current === audio.id,
    });
    if (!resumePending && rawMs >= RESUME_APPLY_THRESHOLD_MS) {
      acceptedPositionRef.current = { id: audio.id, ms: rawMs };
    }
    if (posMs == null) return;

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
    if (posMs >= RESUME_APPLY_THRESHOLD_MS) {
      acceptedPositionRef.current = { id: audio.id, ms: posMs };
    }
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

  // replace() leaves ExoPlayer at 0. If that first seek was ignored because the
  // timeline was not ready, seek again once this source's clock is actually ready.
  // A pause keeps the pending position so the next play can still restore it.
  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!isResumePending(pending, loadGen.current)) return;

    const reduced = reduceResumeReady(pending, status);
    pendingStartRef.current = reduced.pending;

    if (reduced.landed) {
      const audio = currentAudioRef.current;
      const ms = reduced.positionMs || pending.startPositionMs;
      if (audio?.id && ms >= RESUME_APPLY_THRESHOLD_MS) {
        acceptedPositionRef.current = { id: audio.id, ms };
      }
      lastPersist.current = Date.now();
      return;
    }

    if (!reduced.issueSeek) return;
    const seconds = resumeTargetSeconds(reduced.pending?.startPositionMs ?? pending.startPositionMs);
    if (!(seconds > 0)) return;
    gateRef.current.requestSeek(seconds).catch(() => {});
  }, [
    status.isLoaded,
    status.currentTime,
    status.playbackState,
    status.didJustFinish,
    status.isBuffering,
  ]);

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
    // A bare play here would start the new item at 0 and race the resume seek.
    if (isResumePending(pendingStartRef.current, loadGen.current)) return;
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
      // Keep a pending resume so a failed start cannot store position 0.
      if (!player?.playing && !player?.isLoaded) loadedFilenameRef.current = null;
      setAudioLoading(false);
      setAudioError((current) => current || outcome.playbackError);
      return;
    }

    if (!outcome.useDownloadedFile || !localUri) return;
    if (gateRef.current.getDesired() === 'pause') return;
    try {
      const liveMs = Math.max(0, Math.round((player?.currentTime ?? 0) * 1000));
      const accepted = acceptedPositionRef.current;
      const acceptedMs = accepted?.id === audioRecord.id ? accepted.ms : 0;
      const resumeMs = liveMs >= RESUME_APPLY_THRESHOLD_MS
        ? liveMs
        : (acceptedMs >= RESUME_APPLY_THRESHOLD_MS ? acceptedMs : startPositionMs);
      if (resumeMs >= RESUME_APPLY_THRESHOLD_MS) {
        pendingStartRef.current = {
          ...freshResume(resumeMs, {
            currentTime: player?.currentTime ?? 0,
            isLoaded: Boolean(player?.isLoaded),
          }),
          gen,
          seekIssued: true,
        };
      } else {
        pendingStartRef.current = null;
      }
      loadSource({ uri: localUri });
      loadedFilenameRef.current = audioRecord.filename;
      try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
      streamFailedRef.current = false;
      const options = resumeMs >= RESUME_APPLY_THRESHOLD_MS
        ? { restartAt: resumeMs / 1000 }
        : {};
      gateRef.current.requestPlay(options).catch(() => {});
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
    const pending = pendingStartRef.current;
    const resumeAt = isResumePending(pending, loadGen.current)
      ? resumeTargetSeconds(pending.startPositionMs)
      : 0;
    if (resumeAt > 0) {
      pending.seekIssued = true;
      gateRef.current.requestPlay({ restartAt: resumeAt }).catch((err) => {
        setAudioLoading(false);
        setAudioError(err);
      });
      return;
    }

    const player = playerRef.current;
    const dur = player?.duration ?? 0;
    const time = player?.currentTime ?? 0;
    const restart = dur > 0 && time >= Math.max(0, dur - 0.35);
    if (restart && currentAudioRef.current?.id) {
      intentionalZeroRef.current = currentAudioRef.current.id;
      acceptedPositionRef.current = { id: currentAudioRef.current.id, ms: 0 };
      pendingStartRef.current = null;
    }
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

    const playerNow = playerRef.current;
    const playerMs = Math.max(0, Math.round((playerNow?.currentTime ?? 0) * 1000));
    const sameSource = loadedFilenameRef.current === audioRecord.filename;
    const plan = planResumeStart({
      savedPositionMs: startPositionMs,
      playerMs,
      sameSource,
    });

    // Same file, still at a real position. Do not replace() — that restarts ExoPlayer at 0.
    if (sameSource && plan.action === 'continue') {
      pendingStartRef.current = null;
      setAudioLoading(false);
      setDownloadProgress(null);
      if (currentAudioRef.current?.id !== audioRecord.id) {
        setCurrentAudio(audioRecord);
      }
      currentAudioRef.current = audioRecord;
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
    intentionalZeroRef.current = null;
    currentAudioRef.current = audioRecord;
    setCurrentAudio(audioRecord);
    durationSavedFor.current = null;
    lastPersist.current = 0;
    streamFailedRef.current = false;

    if (plan.action === 'restore') {
      pendingStartRef.current = {
        ...freshResume(plan.positionMs, {
          currentTime: playerNow?.currentTime ?? 0,
          isLoaded: Boolean(playerNow?.isLoaded),
        }, { sourceMatches: sameSource }),
        gen,
      };
    } else {
      pendingStartRef.current = null;
    }
    armProgressGate();

    const resumeSeconds = plan.action === 'restore' ? plan.positionMs / 1000 : 0;
    const startPlayback = () => {
      if (resumeSeconds > 0 && pendingStartRef.current?.gen === gen) {
        pendingStartRef.current.seekIssued = true;
      }
      const options = resumeSeconds > 0 ? { restartAt: resumeSeconds } : {};
      gateRef.current.requestPlay(options).catch((err) => {
        if (gen !== loadGen.current) return;
        setAudioLoading(false);
        setAudioError(err);
      });
    };

    // Player was reset on this file. Seek, then play. Do not replace the source.
    if (sameSource) {
      setAudioLoading(false);
      setDownloadProgress(null);
      setDownloadError(null);
      try {
        startPlayback();
      } finally {
        suspendProgressRef.current = false;
      }
      return;
    }

    const cachedUri = getCachedAudioUri(audioRecord.filename);
    if (cachedUri) {
      setAudioLoading(false);
      setDownloadProgress(null);
      setDownloadError(null);
      try {
        loadSource({ uri: cachedUri });
        loadedFilenameRef.current = audioRecord.filename;
        try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
        startPlayback();
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
    // The resume seek is inside the same play command, after replace().
    setAudioLoading(true);
    setDownloadError(null);
    setDownloadProgress(isAudioDownloadInflight(audioRecord.filename) ? null : 0);

    try {
      const remoteUrl = getRemoteAudioUrl(audioRecord.filename);
      loadSource({
        uri: remoteUrl,
        headers: { Accept: 'audio/mpeg,audio/*,*/*' },
      });
      loadedFilenameRef.current = audioRecord.filename;
      try { svcSetRate(playbackRateRef.current); } catch (_) { /* ignore */ }
      startPlayback();
    } catch (err) {
      if (gen !== loadGen.current) return;
      streamFailedRef.current = true;
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
    pendingStartRef.current = null;
    const audio = currentAudioRef.current;
    const ms = Math.round(clamped * 1000);
    if (audio?.id) {
      intentionalZeroRef.current = ms < RESUME_APPLY_THRESHOLD_MS ? audio.id : null;
      acceptedPositionRef.current = { id: audio.id, ms };
    }
    return gateRef.current.requestSeek(clamped).then(() => {
      persistAudio(currentAudioRef.current);
    }).catch((err) => {
      console.warn('[AudioContext] seek failed:', err);
    });
  }, [persistAudio]);

  const stop = useCallback(() => {
    setAudioLoading(false);
    pendingStartRef.current = null;
    return gateRef.current.requestPause().then(() => gateRef.current.requestSeek(0)).then(() => {
      const audio = currentAudioRef.current;
      if (!audio?.id) return;
      intentionalZeroRef.current = audio.id;
      acceptedPositionRef.current = { id: audio.id, ms: 0 };
      savePlaybackPosition(audio.id, 0).catch(() => {});
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
