import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessCacheSpace,
  cachedFileIsUsable,
  isPartialDownload,
  isStorageError,
  isTempCacheName,
  normalizeDownloadError,
  performCacheDownload,
  settleBackgroundCache,
} from '../src/services/cacheDownload.js';

function fakeFiles(initial = {}) {
  const files = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    files,
    readFinal() {
      const file = files.get('final');
      return {
        exists: Boolean(file),
        size: file?.size ?? 0,
        receiptBytes: file?.receipt ?? null,
      };
    },
    removeTemp() {
      calls.push('remove-temp');
      files.delete('temp');
    },
    removeFinal() {
      calls.push('remove-final');
      files.delete('final');
    },
    commitTemp() {
      calls.push('commit');
      const temp = files.get('temp');
      if (!temp) throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      files.set('final', { size: temp.size, receipt: null });
      files.delete('temp');
    },
    writeReceipt(size) {
      calls.push('receipt');
      const finalFile = files.get('final');
      if (finalFile) finalFile.receipt = size;
    },
  };
}

test('a non-empty legacy file is usable and a short receipt is not', () => {
  assert.equal(cachedFileIsUsable({ size: 5_000_000, receiptBytes: null }), true);
  assert.equal(cachedFileIsUsable({ size: 0, receiptBytes: null }), false);
  assert.equal(cachedFileIsUsable({ size: 1000, receiptBytes: 5_000_000 }), false);
  assert.equal(cachedFileIsUsable({ size: 5_000_000, receiptBytes: 5_000_000 }), true);
  assert.equal(isPartialDownload(1000, 5_000_000), true);
  assert.equal(isPartialDownload(5_000_000, null), false);
  assert.equal(isTempCacheName('lesson.mp3.tmp'), true);
  assert.equal(isTempCacheName('lesson.mp3'), false);
});

test('low free space skips the download and does not leave a temp file', async () => {
  const fs = fakeFiles({ temp: { size: 4096 } });
  let downloaded = false;
  await assert.rejects(
    performCacheDownload({
      ...fs,
      availableBytes: 200_000,
      readAvailableBytes: () => 200_000,
      downloadToTemp: async () => {
        downloaded = true;
        return { size: 1 };
      },
    }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(downloaded, false);
  assert.equal(fs.files.has('temp'), false);
  assert.equal(assessCacheSpace(null, 5_000_000).ok, true);
});

test('a file write failure deletes the partial temp and is reported as storage full', async () => {
  const fs = fakeFiles();
  await assert.rejects(
    performCacheDownload({
      ...fs,
      availableBytes: 80_000_000,
      readAvailableBytes: () => 80_000_000,
      downloadToTemp: async ({ onBytes }) => {
        onBytes({ bytesWritten: 1000, totalBytes: 5_000_000 });
        fs.files.set('temp', { size: 1000 });
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      },
    }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(fs.files.has('temp'), false);
  assert.equal(fs.files.has('final'), false);
  assert.equal(isStorageError(Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })), true);
});

test('an incomplete download is not committed', async () => {
  const fs = fakeFiles();
  await assert.rejects(
    performCacheDownload({
      ...fs,
      availableBytes: 80_000_000,
      downloadToTemp: async ({ onBytes }) => {
        onBytes({ bytesWritten: 1000, totalBytes: 5_000_000 });
        fs.files.set('temp', { size: 1000 });
        return { size: 1000 };
      },
    }),
    (err) => err.code === 'DOWNLOAD_FAILED'
  );
  assert.equal(fs.calls.includes('commit'), false);
  assert.equal(fs.files.has('final'), false);
  assert.equal(fs.files.has('temp'), false);
});

test('a complete download is committed and a second save is skipped', async () => {
  const fs = fakeFiles();
  let downloads = 0;
  const first = await performCacheDownload({
    ...fs,
    availableBytes: 80_000_000,
    downloadToTemp: async ({ onBytes }) => {
      downloads += 1;
      onBytes({ bytesWritten: 5_000_000, totalBytes: 5_000_000 });
      fs.files.set('temp', { size: 5_000_000 });
      return { size: 5_000_000 };
    },
  });
  assert.equal(first.alreadyCached, false);
  assert.equal(fs.files.get('final').receipt, 5_000_000);

  const second = await performCacheDownload({
    ...fs,
    availableBytes: 80_000_000,
    downloadToTemp: async () => {
      downloads += 1;
      return { size: 1 };
    },
  });
  assert.equal(second.alreadyCached, true);
  assert.equal(downloads, 1);
});

test('running out of room mid-download cancels the save and removes the temp file', async () => {
  const fs = fakeFiles();
  let available = 8_000_000;
  await assert.rejects(
    performCacheDownload({
      ...fs,
      availableBytes: available,
      readAvailableBytes: () => available,
      downloadToTemp: async ({ onBytes }) => {
        const action = onBytes({ bytesWritten: 1_000_000, totalBytes: 20_000_000 });
        assert.equal(action, 'abort-storage');
        fs.files.set('temp', { size: 1_000_000 });
        available = 100_000;
        throw Object.assign(new Error('Download cancelled.'), { name: 'AbortError' });
      },
    }),
    (err) => err.code === 'STORAGE_FULL'
  );
  assert.equal(fs.files.has('temp'), false);
});

test('a user cancel stays a cancel, and other failures keep their codes', () => {
  const aborted = normalizeDownloadError(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  assert.equal(aborted.code, 'ABORTED');
  const offline = normalizeDownloadError(new Error('Network request failed'));
  assert.equal(offline.code, 'DOWNLOAD_REQUIRED');
  const generic = normalizeDownloadError(new Error('500'));
  assert.equal(generic.code, 'DOWNLOAD_FAILED');
});

test('background cache failure does not take over playback', () => {
  const storageError = Object.assign(new Error('full'), { code: 'STORAGE_FULL' });

  const whileStarting = settleBackgroundCache({
    error: storageError,
    streamReady: false,
    streamFailed: false,
  });
  assert.equal(whileStarting.playbackError, null);
  assert.equal(whileStarting.downloadError, storageError);
  assert.equal(whileStarting.useDownloadedFile, false);
  assert.equal(whileStarting.clearProgress, true);

  const whilePlaying = settleBackgroundCache({
    error: storageError,
    streamReady: true,
    streamFailed: false,
  });
  assert.equal(whilePlaying.playbackError, null);
  assert.equal(whilePlaying.downloadError, storageError);

  const savedWhileStreaming = settleBackgroundCache({
    error: null,
    streamReady: false,
    streamFailed: false,
  });
  assert.equal(savedWhileStreaming.useDownloadedFile, false);

  const savedAfterStreamFailed = settleBackgroundCache({
    error: null,
    streamReady: false,
    streamFailed: true,
  });
  assert.equal(savedAfterStreamFailed.useDownloadedFile, true);

  const bothFailed = settleBackgroundCache({
    error: storageError,
    streamReady: false,
    streamFailed: true,
  });
  assert.equal(bothFailed.playbackError, storageError);
  assert.equal(bothFailed.downloadError, null);

  const cancelled = settleBackgroundCache({
    error: Object.assign(new Error('cancel'), { code: 'ABORTED' }),
    streamReady: true,
    streamFailed: false,
  });
  assert.equal(cancelled.downloadError, null);
  assert.equal(cancelled.playbackError, null);
});
