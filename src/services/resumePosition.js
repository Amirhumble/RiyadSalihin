// Resume position for one lesson.
//
// expo-audio replace() builds a new ExoPlayer item that starts at 0.
// A status sample from that reset, or from the previous item, must not be
// written over audios.position_ms. Completion is a separate column and is
// never cleared here.

export const RESUME_APPLY_THRESHOLD_MS = 1000;
const LAND_TOLERANCE_SEC = 1.5;
const MAX_RESUME_RETRIES = 2;

export function resumeTargetSeconds(positionMs) {
  const ms = Number(positionMs);
  if (!Number.isFinite(ms) || ms < RESUME_APPLY_THRESHOLD_MS) return 0;
  return ms / 1000;
}

export function isResumePending(pending, gen) {
  if (!pending || pending.landed) return false;
  if (gen != null && pending.gen !== gen) return false;
  return (Number(pending.startPositionMs) || 0) >= RESUME_APPLY_THRESHOLD_MS;
}

// sourceMatches: the player is already holding this file, so its clock is
// this lesson's clock. Otherwise the current status may still be the previous item.
export function freshResume(startPositionMs, statusSnapshot = {}, options = {}) {
  const time = Number(statusSnapshot.currentTime) || 0;
  const loaded = statusSnapshot.isLoaded === true;
  const sourceMatches = Boolean(options.sourceMatches);
  return {
    startPositionMs: Math.max(0, Math.round(Number(startPositionMs) || 0)),
    sawUnload: sourceMatches || !loaded,
    armTime: sourceMatches ? 0 : time,
    seekIssued: false,
    retries: 0,
    landed: false,
  };
}

// Same file still in the player: keep its clock. A stale 0 from the database
// must not rewind it. Restore only when the player itself was reset to the start.
export function planResumeStart({ savedPositionMs = 0, playerMs = 0, sameSource = false } = {}) {
  const saved = Math.max(0, Math.round(Number(savedPositionMs) || 0));
  const player = Math.max(0, Math.round(Number(playerMs) || 0));
  if (sameSource && !(saved >= RESUME_APPLY_THRESHOLD_MS && player < RESUME_APPLY_THRESHOLD_MS)) {
    return { action: 'continue', positionMs: player };
  }
  if (saved >= RESUME_APPLY_THRESHOLD_MS) {
    return { action: 'restore', positionMs: saved };
  }
  return { action: 'start', positionMs: 0 };
}

// Ready only after this source has unloaded or its clock has left the previous item.
// Seek again if the source is ready and still at the start. Land when the clock
// arrives at the saved position.
export function reduceResumeReady(pending, status) {
  if (!pending) return { pending: null, issueSeek: false, landed: false, giveUp: false };
  if (pending.landed) {
    return {
      pending: null,
      issueSeek: false,
      landed: true,
      giveUp: false,
      positionMs: pending.startPositionMs,
    };
  }

  const time = Number(status?.currentTime) || 0;
  const target = resumeTargetSeconds(pending.startPositionMs);
  const sawUnload = Boolean(pending.sawUnload) || status?.isLoaded === false;
  const staleFinish = Boolean(status?.didJustFinish) || status?.playbackState === 'ended';
  const timeMoved = Math.abs(time - (Number(pending.armTime) || 0)) > 0.3;
  const loaded = status?.isLoaded === true;
  const buffering = Boolean(status?.isBuffering);
  // The armed clock belongs to whatever was loaded before replace().
  // Landing requires that clock to have been replaced, not merely to match the target.
  const clockIsNew = sawUnload || timeMoved;
  const clockFresh = time < 1 || timeMoved;
  const sourceReady = loaded && !buffering && !staleFinish && clockFresh && clockIsNew;

  if (target <= 0) {
    return { pending: null, issueSeek: false, landed: true, giveUp: false, positionMs: 0 };
  }

  if (
    pending.seekIssued &&
    loaded &&
    !staleFinish &&
    clockIsNew &&
    Math.abs(time - target) < LAND_TOLERANCE_SEC
  ) {
    return {
      pending: null,
      issueSeek: false,
      landed: true,
      giveUp: false,
      positionMs: pending.startPositionMs,
    };
  }

  const next = { ...pending, sawUnload };

  // The player actually ran from the start after the seek was retried.
  // Follow that clock. A previous item's position must not take this branch.
  if (
    next.seekIssued &&
    next.retries >= MAX_RESUME_RETRIES &&
    next.sawUnload &&
    sourceReady &&
    time >= 3 &&
    time < 15 &&
    time + LAND_TOLERANCE_SEC < target
  ) {
    return { pending: null, issueSeek: false, landed: false, giveUp: true };
  }

  if (next.seekIssued && sourceReady && time < 1 && next.retries < MAX_RESUME_RETRIES) {
    next.retries += 1;
    next.seekIssued = false;
  }

  const issueSeek = sourceReady && !next.seekIssued;
  if (issueSeek) next.seekIssued = true;
  return { pending: next, issueSeek, landed: false, giveUp: false };
}

// null means do not write. Callers update position_ms only, never completed.
export function positionToSave({
  playerMs = 0,
  acceptedMs = 0,
  resumeTargetMs = 0,
  resumePending = false,
  intentionalZero = false,
} = {}) {
  const player = Math.max(0, Math.round(Number(playerMs) || 0));
  if (intentionalZero) return player;

  const accepted = Math.max(0, Math.round(Number(acceptedMs) || 0));
  const target = Math.max(0, Math.round(Number(resumeTargetMs) || 0));

  // Still waiting for the seek. The start of the new item is not the resume point.
  if (resumePending && target >= RESUME_APPLY_THRESHOLD_MS && player + 1500 < target) {
    return null;
  }

  // Pause and background can report 0 after a position we already accepted.
  if (player < RESUME_APPLY_THRESHOLD_MS && accepted >= RESUME_APPLY_THRESHOLD_MS) {
    return accepted;
  }

  return player;
}
