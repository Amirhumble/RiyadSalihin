import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlaybackGate, playbackUiState } from '../src/services/playbackCommands.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('rapid play, pause, and play keeps only the latest play', async () => {
  const calls = [];
  const seek = deferred();
  const gate = createPlaybackGate({
    play() { calls.push('play'); },
    pause() { calls.push('pause'); },
    seekTo() {
      calls.push('seek');
      return seek.promise;
    },
  });

  const first = gate.requestPlay({ restartAt: 0 });
  const paused = gate.requestPause();
  const last = gate.requestPlay();

  assert.deepEqual(calls, ['seek']);
  seek.resolve();
  await Promise.all([first, paused, last]);

  assert.deepEqual(calls, ['seek', 'play']);
  assert.equal(gate.getDesired(), 'play');
});

test('pause during an in-flight seek does not start playback afterwards', async () => {
  const calls = [];
  const seek = deferred();
  const gate = createPlaybackGate({
    play() { calls.push('play'); },
    pause() { calls.push('pause'); },
    seekTo() { return seek.promise; },
  });

  const playing = gate.requestPlay({ restartAt: 0 });
  const pausing = gate.requestPause();
  seek.resolve();
  await Promise.all([playing, pausing]);

  assert.deepEqual(calls, ['pause']);
  assert.equal(gate.getDesired(), 'pause');
});

test('seek and play run one at a time', async () => {
  const order = [];
  let releaseSeek;
  let started = 0;
  const gate = createPlaybackGate({
    play() { order.push('play'); },
    pause() { order.push('pause'); },
    seekTo(seconds) {
      started += 1;
      order.push(`seek-${seconds}`);
      if (started === 1) {
        return new Promise((resolve) => {
          releaseSeek = resolve;
        });
      }
      return Promise.resolve();
    },
  });

  const first = gate.requestSeek(12);
  const second = gate.requestSeek(40);
  assert.deepEqual(order, ['seek-12']);
  assert.equal(gate.getPending() > 0, true);

  releaseSeek();
  await first;
  await second;
  assert.deepEqual(order, ['seek-12', 'seek-40']);
});

test('a failed play rejects and a later pause still runs', async () => {
  const calls = [];
  const gate = createPlaybackGate({
    play() { throw new Error('native play failed'); },
    pause() { calls.push('pause'); },
    seekTo() {},
  });

  await assert.rejects(gate.requestPlay(), /native play failed/);
  await gate.requestPause();
  assert.deepEqual(calls, ['pause']);
});

test('reconcile retries a missed play only while the queue is idle', async () => {
  let plays = 0;
  const gate = createPlaybackGate({
    play() { plays += 1; },
    pause() {},
    seekTo() {},
  });

  gate.reconcile({
    playing: false,
    isLoaded: true,
    isBuffering: false,
    didJustFinish: false,
    playbackState: 'ready',
  });
  assert.equal(plays, 0);

  await gate.requestPause();
  gate.reconcile({
    playing: true,
    isLoaded: true,
    isBuffering: true,
    didJustFinish: false,
    playbackState: 'buffering',
  });
  assert.equal(plays, 0);

  gate.reconcile({
    playing: true,
    isLoaded: true,
    isBuffering: false,
    didJustFinish: false,
    playbackState: 'ready',
  });
  await Promise.resolve();
  assert.equal(gate.getDesired(), 'pause');
});

test('reconcile does not restart a lesson that just finished', async () => {
  let plays = 0;
  const gate = createPlaybackGate({
    play() { plays += 1; },
    pause() {},
    seekTo() {},
  });

  await gate.requestPlay();
  plays = 0;
  gate.reconcile({
    playing: false,
    isLoaded: true,
    isBuffering: false,
    didJustFinish: true,
    playbackState: 'ended',
  });
  await Promise.resolve();
  assert.equal(plays, 0);
});

test('a stuck finish flag does not hide playback or block pause', () => {
  const stuck = playbackUiState({
    isPlaying: true,
    didJustFinish: true,
    audioLoading: false,
  });
  assert.equal(stuck.playing, true);
  assert.equal(stuck.finished, false);
  assert.equal(stuck.pauseOnPress, true);

  const starting = playbackUiState({
    isPlaying: false,
    didJustFinish: false,
    audioLoading: true,
  });
  assert.equal(starting.showSpinner, true);
  assert.equal(starting.pauseOnPress, true);
  assert.equal(starting.playing, false);

  const ended = playbackUiState({
    isPlaying: false,
    didJustFinish: true,
    audioLoading: false,
  });
  assert.equal(ended.playing, false);
  assert.equal(ended.pauseOnPress, false);
  assert.equal(ended.showSpinner, false);
});
