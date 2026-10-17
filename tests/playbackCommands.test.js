const test = require('node:test');
const assert = require('node:assert/strict');

const { createPlaybackGate, playbackUiState } = require('../src/services/playbackCommands');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('rapid play, pause, and play applies only the latest play', async () => {
  const calls = [];
  let releaseSeek;
  const gate = createPlaybackGate({
    play() { calls.push('play'); },
    pause() { calls.push('pause'); },
    seekTo() {
      calls.push('seek');
      return new Promise((resolve) => { releaseSeek = resolve; });
    },
  });

  const first = gate.requestPlay({ restartAt: 0 });
  const paused = gate.requestPause();
  const last = gate.requestPlay();
  await Promise.resolve();
  assert.deepEqual(calls, ['seek']);

  releaseSeek();
  const results = await Promise.all([first, paused, last]);
  assert.deepEqual(calls, ['seek', 'play']);
  assert.equal(results[0].applied, false);
  assert.equal(results[1].applied, false);
  assert.equal(results[2].applied, true);
  assert.equal(gate.getDesired(), 'play');
});

test('pause during an in-flight restart seek does not start playback', async () => {
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

  const playing = gate.requestPlay({ restartAt: 0 });
  const pausing = gate.requestPause();
  await Promise.resolve();
  seek.resolve();
  await Promise.all([playing, pausing]);

  assert.deepEqual(calls, ['seek', 'pause']);
  assert.equal(gate.getDesired(), 'pause');
});

test('seeks run one at a time and still complete after a transport change', async () => {
  const calls = [];
  const firstSeek = deferred();
  let seekCount = 0;
  const gate = createPlaybackGate({
    play() { calls.push('play'); },
    pause() { calls.push('pause'); },
    seekTo(seconds) {
      seekCount += 1;
      calls.push(`seek:${seconds}`);
      if (seekCount === 1) return firstSeek.promise;
      return Promise.resolve();
    },
  });

  const a = gate.requestSeek(12);
  const b = gate.requestSeek(40);
  await Promise.resolve();
  assert.deepEqual(calls, ['seek:12']);
  assert.equal(gate.getPending(), 2);

  firstSeek.resolve();
  await Promise.all([a, b]);
  assert.deepEqual(calls, ['seek:12', 'seek:40']);
});

test('a failed play rejects and a later pause still runs', async () => {
  const calls = [];
  const gate = createPlaybackGate({
    play() { throw new Error('native play failed'); },
    pause() { calls.push('pause'); },
    seekTo() { return Promise.resolve(); },
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
    seekTo() { return Promise.resolve(); },
  });

  gate.reconcile({ isLoaded: true, playing: false, isBuffering: false });
  assert.equal(plays, 0);

  await gate.requestPlay();
  plays = 0;
  gate.reconcile({ isLoaded: true, playing: false, isBuffering: false });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(plays, 1);

  gate.reconcile({ isLoaded: true, playing: false, isBuffering: true });
  await Promise.resolve();
  assert.equal(plays, 1);
});

test('a stuck finish flag does not hide active playback', () => {
  const stuck = playbackUiState({ isPlaying: true, didJustFinish: true, audioLoading: false });
  assert.equal(stuck.playing, true);
  assert.equal(stuck.pauseOnPress, true);
  assert.equal(stuck.showSpinner, false);

  const ended = playbackUiState({ isPlaying: false, didJustFinish: true, audioLoading: false });
  assert.equal(ended.playing, false);
  assert.equal(ended.pauseOnPress, false);

  const starting = playbackUiState({ isPlaying: false, didJustFinish: false, audioLoading: true });
  assert.equal(starting.showSpinner, true);
  assert.equal(starting.pauseOnPress, true);
});
