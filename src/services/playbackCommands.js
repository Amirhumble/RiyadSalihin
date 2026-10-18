// Serializes play, pause, and seek.
// A seek that finishes late must not start playback after the user has paused.
// Rapid taps keep the latest play or pause only.

export function createPlaybackGate({ play, pause, seekTo }) {
  let tail = Promise.resolve();
  let pending = 0;
  let draining = false;
  let ticket = 0;
  let desired = null;
  let reconcileAttempts = 0;

  // The active command starts immediately. Later commands wait for it, so a
  // seek that is still running cannot call play() after a newer pause.
  function enqueue(task) {
    pending += 1;

    const execute = () => {
      draining = true;
      let result;
      try {
        result = task();
      } catch (err) {
        result = Promise.reject(err);
      }
      return Promise.resolve(result).finally(() => {
        pending -= 1;
        if (pending === 0) draining = false;
      });
    };

    if (!draining) {
      const current = execute();
      tail = current.then(() => undefined, () => undefined);
      return current;
    }

    const current = tail.then(execute, execute);
    tail = current.then(() => undefined, () => undefined);
    return current;
  }

  function requestPlay(options = {}) {
    const mine = ++ticket;
    desired = 'play';
    const restartAt = options.restartAt;
    return enqueue(async () => {
      if (mine !== ticket || desired !== 'play') return { applied: false, action: 'play' };
      if (restartAt != null) {
        try {
          await seekTo(restartAt);
        } catch (err) {
          // The item may not be seekable until ExoPlayer has prepared it.
          // Starting playback still has to happen; a later status can seek again.
          if (mine !== ticket || desired !== 'play') return { applied: false, action: 'play' };
        }
        if (mine !== ticket || desired !== 'play') return { applied: false, action: 'play' };
      }
      play();
      return { applied: true, action: 'play' };
    });
  }

  function requestPause() {
    const mine = ++ticket;
    desired = 'pause';
    return enqueue(async () => {
      if (mine !== ticket || desired !== 'pause') return { applied: false, action: 'pause' };
      pause();
      return { applied: true, action: 'pause' };
    });
  }

  function requestSeek(seconds) {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    return enqueue(async () => {
      await seekTo(safe);
      return { applied: true, action: 'seek', seconds: safe };
    });
  }

  // If the native player missed a command (common while buffering), try once more
  // after the queue is idle. Stop after two misses so a broken player cannot loop.
  function reconcile(status) {
    if (pending > 0 || !desired || !status) return;
    const playing = Boolean(status.playing);
    const inSync = (desired === 'play' && playing) || (desired === 'pause' && !playing);
    if (inSync) {
      reconcileAttempts = 0;
      return;
    }
    if (!status.isLoaded || status.isBuffering) return;
    if (desired === 'play' && (status.didJustFinish || status.playbackState === 'ended')) return;
    if (reconcileAttempts >= 2) return;
    reconcileAttempts += 1;
    const command = desired === 'play' ? requestPlay() : requestPause();
    command.catch(() => {});
  }

  return {
    requestPlay,
    requestPause,
    requestSeek,
    reconcile,
    getDesired: () => desired,
    getPending: () => pending,
  };
}

// didJustFinish can stay true after expo-audio stops sending updates.
// That must not hide a real playing state, or the button can no longer pause.
export function playbackUiState({ isPlaying, didJustFinish, audioLoading }) {
  const playingNow = Boolean(isPlaying);
  const finished = Boolean(didJustFinish) && !playingNow;
  const playing = playingNow && !finished;
  const showSpinner = Boolean(audioLoading) && !playing;
  return {
    playing,
    finished,
    showSpinner,
    pauseOnPress: playing || showSpinner,
  };
}
