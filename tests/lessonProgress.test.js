const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMPLETION_RATIO,
  createSerializedProgressStore,
  freshProgressGate,
  isLessonCompleted,
  meetsCompletionThreshold,
  reduceProgressGate,
  shouldMarkCompleted,
} = require('../src/services/lessonProgress');

test('completion starts at 98 percent and ignores a short listen', () => {
  assert.equal(COMPLETION_RATIO, 0.98);
  assert.equal(meetsCompletionThreshold(1_000, 100_000), false);
  assert.equal(meetsCompletionThreshold(97_999, 100_000), false);
  assert.equal(meetsCompletionThreshold(98_000, 100_000), true);
  assert.equal(meetsCompletionThreshold(0, 100_000), false);
  assert.equal(meetsCompletionThreshold(50_000, 0), false);
});

test('a real ending counts and a finish event at the start does not', () => {
  assert.equal(shouldMarkCompleted({
    currentTimeSec: 600,
    durationSec: 600,
    didJustFinish: true,
  }), true);

  assert.equal(shouldMarkCompleted({
    currentTimeSec: 0,
    durationSec: 600,
    didJustFinish: true,
    playbackState: 'ended',
  }), false);

  assert.equal(shouldMarkCompleted({
    currentTimeSec: 120,
    durationSec: 600,
    playbackState: 'ready',
  }), false);
});

test('saved completion stays complete when the resume position is cleared', () => {
  assert.equal(isLessonCompleted({ completed: 1, position_ms: 0, duration_ms: 600_000 }), true);
  assert.equal(isLessonCompleted({ completed: 0, position_ms: 590_000, duration_ms: 600_000 }), true);
  assert.equal(isLessonCompleted({ completed: 0, position_ms: 20_000, duration_ms: 600_000 }), false);
  assert.equal(isLessonCompleted({ position_ms: 0, duration_ms: 600_000 }), false);
});

test('progress from the previous lesson is ignored until the new source loads', () => {
  let gate = freshProgressGate(180, { unloaded: false });
  let step = reduceProgressGate(gate, {
    currentTime: 180,
    isLoaded: true,
    didJustFinish: true,
    playbackState: 'ended',
  });
  assert.equal(step.open, false);

  step = reduceProgressGate(step.gate, { currentTime: 180, isLoaded: false, didJustFinish: false });
  assert.equal(step.open, false);
  assert.equal(step.gate.sawUnload, true);

  step = reduceProgressGate(step.gate, {
    currentTime: 0,
    isLoaded: true,
    didJustFinish: false,
    playbackState: 'ready',
  });
  assert.equal(step.open, true);
});

function memoryRows() {
  const rows = new Map();
  const order = [];
  function row(id) {
    if (!rows.has(id)) rows.set(id, { position_ms: 0, completed: 0, duration_ms: 0 });
    return rows.get(id);
  }
  const adapter = {
    async savePosition(id, positionMs) {
      await Promise.resolve();
      order.push(`position:${positionMs}`);
      row(id).position_ms = positionMs;
    },
    async markCompleted(id, positionMs) {
      await Promise.resolve();
      order.push(`complete:${positionMs}`);
      const current = row(id);
      current.completed = 1;
      if (positionMs != null) current.position_ms = positionMs;
    },
    async saveDuration(id, durationMs) {
      order.push(`duration:${durationMs}`);
      row(id).duration_ms = durationMs;
    },
  };
  return { rows, order, adapter };
}

test('a later resume save cannot clear a completion write', async () => {
  const { rows, adapter } = memoryRows();
  const store = createSerializedProgressStore(adapter);

  await store.markCompleted(7, 0);
  await store.savePosition(7, 4_000);

  assert.equal(rows.get(7).completed, 1);
  assert.equal(rows.get(7).position_ms, 4_000);
});

test('overlapping position and completion writes keep call order', async () => {
  const { rows, order, adapter } = memoryRows();
  const store = createSerializedProgressStore(adapter);

  await Promise.all([
    store.savePosition(3, 120_000),
    store.markCompleted(3, 0),
  ]);

  assert.deepEqual(order, ['position:120000', 'complete:0']);
  assert.equal(rows.get(3).completed, 1);
  assert.equal(rows.get(3).position_ms, 0);

  await Promise.all([
    store.markCompleted(4, 0),
    store.savePosition(4, 8_000),
  ]);
  assert.equal(rows.get(4).completed, 1);
  assert.equal(rows.get(4).position_ms, 8_000);
});
