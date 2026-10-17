// A lesson is complete at 98% of its duration, or when playback actually reaches
// the end. The flag is sticky: saving a resume position, including 0 after the
// lesson ends, must not clear it. Replaying from the start is not completion.

export const COMPLETION_RATIO = 0.98;
export const PERSIST_INTERVAL_MS = 5_000;

export function meetsCompletionThreshold(positionMs, durationMs) {
  const pos = Number(positionMs);
  const dur = Number(durationMs);
  if (!Number.isFinite(pos) || !Number.isFinite(dur) || dur <= 0 || pos <= 0) return false;
  return pos / dur >= COMPLETION_RATIO;
}

export function shouldMarkCompleted({
  currentTimeSec,
  durationSec,
  didJustFinish = false,
  playbackState = null,
  positionMs,
  durationMs,
} = {}) {
  const timeSec = Number(currentTimeSec);
  const durSec = Number(durationSec);
  const timeKnown = Number.isFinite(timeSec);
  const durKnown = Number.isFinite(durSec) && durSec > 0;
  const ended = Boolean(didJustFinish) || playbackState === 'ended';

  if (ended) {
    // Replacing a source can emit a finish event before the new lesson plays.
    if (!timeKnown || timeSec < 1) {
      if (!durKnown || durSec >= 5 || durSec <= 0) return false;
    }
    return true;
  }

  const pos = timeKnown ? Math.round(timeSec * 1000) : Number(positionMs);
  const dur = durKnown ? Math.round(durSec * 1000) : Number(durationMs);
  return meetsCompletionThreshold(pos, dur);
}

export function isLessonCompleted(audio) {
  if (!audio) return false;
  if (Number(audio.completed) === 1) return true;
  return meetsCompletionThreshold(audio.position_ms, audio.duration_ms);
}

export function freshProgressGate(currentTimeSec, { unloaded = false } = {}) {
  return {
    accept: false,
    sawUnload: Boolean(unloaded),
    armTime: Number(currentTimeSec) || 0,
  };
}

// Ignore status that still belongs to the previous source. Open after the
// player unloads, or after the clock moves, and not on a stale finish event.
export function reduceProgressGate(gate, status) {
  const current = gate || freshProgressGate(0);
  if (current.accept) return { gate: current, open: true };

  const time = Number(status?.currentTime) || 0;
  const sawUnload = current.sawUnload || status?.isLoaded === false;
  const staleFinish = Boolean(status?.didJustFinish) || status?.playbackState === 'ended';
  const timeMoved = Math.abs(time - (current.armTime || 0)) > 0.3;
  const loaded = status?.isLoaded !== false;
  // A loaded player can still be showing the previous lesson's clock.
  // Wait until that clock moves, or until the new lesson is at the start.
  const clockFresh = time < 1 || timeMoved;
  const open = loaded && !staleFinish && clockFresh && (sawUnload || timeMoved);

  return {
    gate: { ...current, sawUnload, accept: open },
    open,
  };
}

// Position and completion writes for one lesson run in call order.
export function createSerializedProgressStore(adapter) {
  const chains = new Map();

  function enqueue(id, task) {
    const key = String(id);
    const prev = chains.get(key) || Promise.resolve();
    const run = prev.then(task, task);
    chains.set(
      key,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run;
  }

  return {
    savePosition(id, positionMs) {
      return enqueue(id, () => adapter.savePosition(id, positionMs));
    },
    markCompleted(id, positionMs = null) {
      return enqueue(id, () => adapter.markCompleted(id, positionMs));
    },
    saveDuration(id, durationMs) {
      return enqueue(id, () => adapter.saveDuration(id, durationMs));
    },
  };
}
