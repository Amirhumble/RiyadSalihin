const test = require('node:test');
const assert = require('node:assert/strict');

const { createSerializedProgressStore } = require('../src/services/lessonProgress');
const {
  freshResume,
  planResumeStart,
  positionToSave,
  reduceResumeReady,
} = require('../src/services/resumePosition');

test('a paused position is the value that gets saved', () => {
  assert.equal(positionToSave({ playerMs: 90_500, acceptedMs: 80_000 }), 90_500);
  assert.equal(positionToSave({
    playerMs: 0,
    acceptedMs: 90_500,
    intentionalZero: false,
  }), 90_500);
});

test('a zero sample does not replace a resume that is still pending', () => {
  assert.equal(positionToSave({
    playerMs: 0,
    acceptedMs: 90_000,
    resumeTargetMs: 90_000,
    resumePending: true,
  }), null);
  assert.equal(positionToSave({
    playerMs: 4_000,
    acceptedMs: 90_000,
    resumeTargetMs: 90_000,
    resumePending: true,
  }), null);
  assert.equal(positionToSave({
    playerMs: 90_200,
    resumeTargetMs: 90_000,
    resumePending: true,
  }), 90_200);
});

test('an intentional return to the start is saved as zero', () => {
  assert.equal(positionToSave({
    playerMs: 0,
    acceptedMs: 90_000,
    intentionalZero: true,
  }), 0);
});

test('restore seeks only after the new source is ready', () => {
  let pending = freshResume(90_000, { currentTime: 180, isLoaded: true });
  let step = reduceResumeReady(pending, {
    currentTime: 180,
    isLoaded: true,
    didJustFinish: true,
    playbackState: 'ended',
  });
  assert.equal(step.issueSeek, false);
  assert.equal(step.landed, false);

  step = reduceResumeReady(step.pending, { currentTime: 180, isLoaded: false });
  assert.equal(step.issueSeek, false);
  assert.equal(step.pending.sawUnload, true);

  step = reduceResumeReady(step.pending, {
    currentTime: 0,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.issueSeek, true);

  step = reduceResumeReady(step.pending, {
    currentTime: 90,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.landed, true);
  assert.equal(step.pending, null);
  assert.equal(step.positionMs, 90_000);
});

test('a seek issued before the timeline is ready is retried, then kept once it lands', () => {
  let pending = freshResume(90_000, { currentTime: 0, isLoaded: false });
  pending = { ...pending, seekIssued: true, gen: 1 };

  let step = reduceResumeReady(pending, {
    currentTime: 180,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.issueSeek, false);
  assert.equal(step.giveUp, false);

  step = reduceResumeReady(step.pending, {
    currentTime: 0,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.issueSeek, true);
  assert.equal(step.pending.retries, 1);

  step = reduceResumeReady(step.pending, {
    currentTime: 90.4,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.landed, true);
  assert.equal(step.positionMs, 90_000);
});

test('the previous item is not treated as a landed resume when its clock matches', () => {
  let pending = freshResume(90_000, { currentTime: 90, isLoaded: true });
  pending = { ...pending, seekIssued: true };

  let step = reduceResumeReady(pending, {
    currentTime: 90,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.landed, false);
  assert.equal(step.issueSeek, false);
  assert.ok(step.pending);

  step = reduceResumeReady(step.pending, { currentTime: 0, isLoaded: false });
  step = reduceResumeReady(step.pending, {
    currentTime: 90,
    isLoaded: true,
    isBuffering: false,
    playbackState: 'ready',
  });
  assert.equal(step.landed, true);
  assert.equal(step.positionMs, 90_000);
});

test('the same loaded file keeps its clock when the database row is stale', () => {
  assert.deepEqual(planResumeStart({
    savedPositionMs: 0,
    playerMs: 90_000,
    sameSource: true,
  }), { action: 'continue', positionMs: 90_000 });

  assert.deepEqual(planResumeStart({
    savedPositionMs: 90_000,
    playerMs: 0,
    sameSource: true,
  }), { action: 'restore', positionMs: 90_000 });

  assert.deepEqual(planResumeStart({
    savedPositionMs: 90_000,
    playerMs: 0,
    sameSource: false,
  }), { action: 'restore', positionMs: 90_000 });

  assert.deepEqual(planResumeStart({
    savedPositionMs: 0,
    playerMs: 0,
    sameSource: false,
  }), { action: 'start', positionMs: 0 });
});

test('a blocked zero write leaves the saved position and completion flag', async () => {
  const rows = new Map();
  const store = createSerializedProgressStore({
    async savePosition(id, positionMs) {
      const row = rows.get(id);
      row.position_ms = positionMs;
    },
    async markCompleted(id, positionMs) {
      const row = rows.get(id);
      row.completed = 1;
      if (positionMs != null) row.position_ms = positionMs;
    },
    async saveDuration() {},
  });
  rows.set(4, { position_ms: 0, completed: 1, duration_ms: 600_000 });
  await store.savePosition(4, 90_000);

  const blocked = positionToSave({
    playerMs: 0,
    acceptedMs: 90_000,
    resumeTargetMs: 90_000,
    resumePending: true,
  });
  assert.equal(blocked, null);
  if (blocked != null) await store.savePosition(4, blocked);

  assert.equal(rows.get(4).position_ms, 90_000);
  assert.equal(rows.get(4).completed, 1);

  const paused = positionToSave({ playerMs: 91_000, acceptedMs: 90_000 });
  await store.savePosition(4, paused);
  assert.equal(rows.get(4).position_ms, 91_000);
  assert.equal(rows.get(4).completed, 1);
});
