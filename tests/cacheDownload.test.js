const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assessCacheSpace,
  cachedFileIsUsable,
  isPartialDownload,
  isStorageError,
  isTempCacheName,
  normalizeDownloadError,
  performCacheDownload,
  settleBackgroundCache,
} = require('../src/services/cacheDownload');

function fakeFiles(initial = {}) {
  const files = {
    final: { exists: false, size: 0, receiptBytes: null },
    temp: { exists: false },
    ...initial,
  };
  const calls = [];
  return {
    files,
    calls,
    async run(options = {}) {
      return performCacheDownload({
        availableBytes: options.availableBytes ?? 80 * 1024 * 1024,
        expectedBytes: options.expectedBytes ?? null,
        signal: options.signal,
        readAvailableBytes: options.readAvailableBytes || (() => options.availableBytes ?? 80 * 1024 * 1024),
        readFinal: () => ({ ...files.final }),
        removeTemp: () => {
          calls.push('removeTemp');
          files.temp.exists = false;
        },
        removeFinal: () => {
          calls.push('removeFinal');
          files.final = { exists: false, size: 0, receiptBytes: null };
        },
        downloadToTemp: options.downloadToTemp || (async ({ onBytes }) => {
          calls.push('download');
          files.temp.exists = true;
          const totalBytes = options.totalBytes ?? 1_000_000;
          const written = options.bytesWritten ?? totalBytes;
          onBytes({ bytesWritten: written, totalBytes });
          if (options.downloadError) throw options.downloadError;
          return { size: options.fileSize ?? written, error: options.fileError };
        }),
        commitTemp: options.commitTemp || (() => {
          calls.push('commit');
          files.final = {
            exists: true,
            size: options.fileSize ?? options.bytesWritten ?? options.totalBytes ?? 1_000_000,
            receiptBytes: null,
          };
          files.temp.exists = false;
        }),
        writeReceipt: (size) => {
          calls.push(`receipt:${size}`);
          files.final.receiptBytes = size;
        },
        onProgress: (ratio) => calls.push(`progress:${ratio}`),
      });
    },
  };
}

test('a non-empty legacy file is usable and a short receipt is not', () => {
  assert.equal(cachedFileIsUsable({ size: 50_000, receiptBytes: null }), true);
  assert.equal(cachedFileIsUsable({ size: 0, receiptBytes: null }), false);
  assert.equal(cachedFileIsUsable({ size: 400, receiptBytes: 1_000_000 }), false);
  assert.equal(isPartialDownload(400, 1_000_000), true);
  assert.equal(isPartialDownload(1_000_000, 1_000_000), false);
  assert.equal(isTempCacheName('lesson.mp3.tmp'), true);
  assert.equal(isTempCacheName('lesson.mp3'), false);
});

test('low free space skips the download and does not leave a temp file', async () => {
  const disk = fakeFiles();
  disk.files.temp.exists = true;
  const space = assessCacheSpace(200 * 1024, 5_000_000);
  assert.equal(space.ok, false);

  await assert.rejects(
    disk.run({ availableBytes: 200 * 1024, expectedBytes: 5_000_000 }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(disk.calls.includes('download'), false);
  assert.equal(disk.files.temp.exists, false);
});

test('unknown free space still attempts the download', async () => {
  const disk = fakeFiles();
  const space = assessCacheSpace(null, 5_000_000);
  assert.equal(space.ok, true);
  const result = await disk.run({
    availableBytes: null,
    totalBytes: 1_000,
    bytesWritten: 1_000,
    fileSize: 1_000,
    readAvailableBytes: () => null,
  });
  assert.equal(result.alreadyCached, false);
  assert.equal(disk.calls.includes('download'), true);
});

test('a short download is deleted and is not treated as saved', async () => {
  const disk = fakeFiles();
  await assert.rejects(
    disk.run({ totalBytes: 1_000_000, bytesWritten: 1_000_000, fileSize: 2_000 }),
    (err) => err.code === 'DOWNLOAD_FAILED'
  );
  assert.equal(disk.files.temp.exists, false);
  assert.equal(disk.files.final.exists, false);
  assert.equal(disk.calls.includes('commit'), false);
});

test('a storage write failure removes the partial file', async () => {
  const disk = fakeFiles();
  const error = new Error('ENOSPC: no space left on device');
  await assert.rejects(
    disk.run({ downloadError: error }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(isStorageError(error), true);
  assert.equal(disk.files.temp.exists, false);
  assert.equal(disk.files.final.exists, false);
  assert.equal(normalizeDownloadError(error).code, 'STORAGE_FULL');
});

test('running out of room during the write cancels and keeps the final file untouched', async () => {
  // A finished file never starts a write; that case is the next test.
  // This file is an older copy whose receipt says the full lesson is larger,
  // so a replacement starts. Running out of room must not delete it.
  const disk = fakeFiles({
    final: { exists: true, size: 8_000_000, receiptBytes: 9_000_000 },
  });
  await assert.rejects(
    disk.run({
      availableBytes: 80 * 1024 * 1024,
      readAvailableBytes: () => 100 * 1024,
      downloadToTemp: async ({ onBytes }) => {
        disk.calls.push('download');
        disk.files.temp.exists = true;
        const action = onBytes({ bytesWritten: 50_000, totalBytes: 5_000_000 });
        assert.equal(action, 'abort-storage');
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(disk.files.temp.exists, false);
  assert.equal(disk.calls.includes('removeFinal'), false);
  assert.equal(disk.calls.includes('commit'), false);
  assert.equal(disk.files.final.exists, true);
  assert.equal(disk.files.final.size, 8_000_000);
  assert.equal(disk.files.final.receiptBytes, 9_000_000);
});

test('an existing complete file is not downloaded again', async () => {
  const disk = fakeFiles({
    final: { exists: true, size: 2_000, receiptBytes: null },
  });
  const result = await disk.run();
  assert.equal(result.alreadyCached, true);
  assert.deepEqual(disk.calls, []);
});

test('a receipt mismatch is removed and downloaded again', async () => {
  const disk = fakeFiles({
    final: { exists: true, size: 100, receiptBytes: 9_000 },
  });
  const result = await disk.run({ totalBytes: 500, bytesWritten: 500, fileSize: 500 });
  assert.equal(result.alreadyCached, false);
  assert.ok(disk.calls.indexOf('download') < disk.calls.indexOf('removeFinal'));
  assert.equal(disk.files.final.size, 500);
  assert.equal(disk.files.final.receiptBytes, 500);
});

test('cache failure does not stop a stream that is playing or still starting', () => {
  const storageError = Object.assign(new Error('full'), { code: 'STORAGE_FULL' });

  const playing = settleBackgroundCache({
    error: storageError,
    streamReady: true,
    streamFailed: false,
  });
  assert.equal(playing.playbackError, null);
  assert.equal(playing.downloadError, storageError);
  assert.equal(playing.useDownloadedFile, false);

  const starting = settleBackgroundCache({
    error: storageError,
    streamReady: false,
    streamFailed: false,
  });
  assert.equal(starting.playbackError, null);
  assert.equal(starting.downloadError, storageError);

  const savedWhileStarting = settleBackgroundCache({
    error: null,
    streamReady: false,
    streamFailed: false,
  });
  assert.equal(savedWhileStarting.useDownloadedFile, false);

  const bothFailed = settleBackgroundCache({
    error: storageError,
    streamReady: false,
    streamFailed: true,
  });
  assert.equal(bothFailed.playbackError, storageError);
  assert.equal(bothFailed.downloadError, null);

  const cancelled = settleBackgroundCache({
    error: Object.assign(new Error('cancelled'), { code: 'ABORTED' }),
    streamReady: true,
    streamFailed: false,
  });
  assert.equal(cancelled.downloadError, null);
  assert.equal(cancelled.playbackError, null);
});
