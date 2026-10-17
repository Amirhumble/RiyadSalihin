import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSerializedProgressStore,
  freshProgressGate,
  isLessonCompleted,
  meetsCompletionThreshold,
  reduceProgressGate,
  shouldMarkCompleted,
} from '../src/services/lessonProgress.js';

function memoryAdapter() {
  const rows = new Map();
  const row = (id) => {
    if (!rows.has(id)) rows.set(id, { position_ms: 0, completed: 0, duration_ms: 0 });
    return rows.get(id);
  };
  return {
    rows,
    async savePosition(id, positionMs) {
      await Promise.resolve();
      row(id).position_ms = positionMs;
    },
    async markCompleted(id, positionMs) {
      await Promise.resolve();
      const current = row(id);
      current.completed = 1;
      if (positionMs != null) current.position_ms = positionMs;
    },
    async saveDuration(id, durationMs) {
      row(id).duration_ms = durationMs;
    },
  };
}

test('completion starts at 98 percent and not when playback merely starts', () => {
  assert.equal(meetsCompletionThreshold(0, 180_000), false);
  assert.equal(meetsCompletionThreshold(1_000, 180_000), false);
  assert.equal(meetsCompletionThreshold(176_000, 180_000), false);
  assert.equal(meetsCompletionThreshold(176_400, 180_000), true);
  assert.equal(meetsCompletionThreshold(180_000, 180_000), true);
});

test('a real ending counts even if the resume point is then stored as 0', () => {
  assert.equal(shouldMarkCompleted({
    currentTimeSec: 180,
    durationSec: 180,
    didJustFinish: true,
  }), true);
  assert.equal(shouldMarkCompleted({
    currentTimeSec: 0,
    durationSec: 180,
    didJustFinish: true,
  }), false);
  assert.equal(shouldMarkCompleted({
    currentTimeSec: 0.2,
    durationSec: 0,
    playbackState: 'ended',
  }), false);
  assert.equal(shouldMarkCompleted({
    currentTimeSec: 12,
    durationSec: 180,
    didJustFinish: false,
  }), false);
});

test('reopening uses the sticky flag, including when position was reset', () => {
  assert.equal(isLessonCompleted({ completed: 1, position_ms: 0, duration_ms: 180_000 }), true);
  assert.equal(isLessonCompleted({ completed: 0, position_ms: 179_000, duration_ms: 180_000 }), true);
  assert.equal(isLessonCompleted({ completed: 0, position_ms: 20_000, duration_ms: 180_000 }), false);
  assert.equal(isLessonCompleted({ completed: 0, position_ms: 0, duration_ms: 180_000 }), false);
});

test('a later position write cannot clear completion', async () => {
  const adapter = memoryAdapter();
  const store = createSerializedProgressStore(adapter);

  const finished = store.markCompleted(7, 0);
  const replay = store.savePosition(7, 4_000);
  await Promise.all([finished, replay]);

  assert.equal(adapter.rows.get(7).completed, 1);
  assert.equal(adapter.rows.get(7).position_ms, 4_000);
});

test('finishing after a progress save still ends completed at position 0', async () => {
  const adapter = memoryAdapter();
  const store = createSerializedProgressStore(adapter);

  const mid = store.savePosition(3, 120_000);
  const done = store.markCompleted(3, 0);
  await Promise.all([mid, done]);

  assert.equal(adapter.rows.get(3).completed, 1);
  assert.equal(adapter.rows.get(3).position_ms, 0);
});

test('writes for different lessons do not block each other', async () => {
  const adapter = memoryAdapter();
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const original = adapter.savePosition;
  adapter.savePosition = async (id, positionMs) => {
    if (id === 1) await blocked;
    return original(id, positionMs);
  };
  const store = createSerializedProgressStore(adapter);

  const first = store.savePosition(1, 500);
  const second = store.markCompleted(2, 0);
  await second;
  assert.equal(adapter.rows.get(2).completed, 1);
  release();
  await first;
  assert.equal(adapter.rows.get(1).position_ms, 500);
  assert.equal(adapter.rows.get(1).completed, 0);
});

test('progress from the previous lesson is ignored until the new clock is fresh', () => {
  let gate = freshProgressGate(120, { unloaded: false });

  let step = reduceProgressGate(gate, {
    isLoaded: true,
    currentTime: 120,
    didJustFinish: true,
    playbackState: 'ended',
  });
  gate = step.gate;
  assert.equal(step.open, false);

  step = reduceProgressGate(gate, {
    isLoaded: false,
    currentTime: 120,
    didJustFinish: false,
    playbackState: 'idle',
  });
  gate = step.gate;
  assert.equal(step.open, false);

  step = reduceProgressGate(gate, {
    isLoaded: true,
    currentTime: 120,
    didJustFinish: false,
    playbackState: 'ready',
  });
  gate = step.gate;
  assert.equal(step.open, false);

  step = reduceProgressGate(gate, {
    isLoaded: true,
    currentTime: 0.2,
    didJustFinish: false,
    playbackState: 'ready',
  });
  assert.equal(step.open, true);
});
