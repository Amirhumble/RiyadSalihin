// Decides when a background audio download is complete, incomplete, or out of space.
// Playback is not decided here. Callers keep streaming if a save fails.

const STORAGE_MESSAGE = 'Not enough storage to save this lesson. You can still listen online.';
const DOWNLOAD_FAILED_MESSAGE = 'Could not download this lesson. Check your connection and try again.';
const OFFLINE_MESSAGE = 'This lesson needs to be downloaded first. Connect to the internet and try again.';
const ABORT_MESSAGE = 'Download cancelled.';
const OVERHEAD_BYTES = 256 * 1024;
const MIN_FREE_BYTES = 1024 * 1024;

export function makeCacheError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

export function isStorageError(err) {
  const blob = `${err?.code || ''} ${err?.message || ''} ${err?.cause?.message || ''}`.toLowerCase();
  return (
    err?.code === 'STORAGE_FULL' ||
    blob.includes('enospc') ||
    blob.includes('no space') ||
    blob.includes('not enough space') ||
    blob.includes('disk full') ||
    blob.includes('storage full') ||
    blob.includes('insufficient storage') ||
    blob.includes('quota exceeded')
  );
}

export function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === 'ABORTED';
}

export function isLikelyOffline(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('internet') ||
    msg.includes('offline') ||
    msg.includes('failed to connect') ||
    msg.includes('unable to resolve') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('unabletodownload') ||
    msg.includes('unable to download')
  );
}

export function isPartialDownload(size, expectedBytes) {
  if (!Number.isFinite(expectedBytes) || expectedBytes <= 0) return false;
  if (!Number.isFinite(size) || size < expectedBytes) return true;
  return false;
}

// A file written before receipts existed is trusted when it is non-empty.
// A receipt that is larger than the file means the save was cut off.
export function cachedFileIsUsable({ size, receiptBytes } = {}) {
  if (!Number.isFinite(size) || size <= 0) return false;
  if (receiptBytes == null) return true;
  return !isPartialDownload(size, receiptBytes);
}

export function isTempCacheName(name) {
  return typeof name === 'string' && name.endsWith('.tmp');
}

export function assessCacheSpace(availableBytes, expectedBytes) {
  if (!Number.isFinite(availableBytes)) return { ok: true };
  if (availableBytes <= 0 || availableBytes < MIN_FREE_BYTES) {
    return { ok: false, message: STORAGE_MESSAGE };
  }
  if (Number.isFinite(expectedBytes) && expectedBytes > 0 && availableBytes < expectedBytes + OVERHEAD_BYTES) {
    return { ok: false, message: STORAGE_MESSAGE };
  }
  return { ok: true };
}

export function remainingBytesFit(availableBytes, totalBytes, bytesWritten) {
  if (!Number.isFinite(availableBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) return true;
  const written = Number.isFinite(bytesWritten) && bytesWritten > 0 ? bytesWritten : 0;
  const remaining = Math.max(0, totalBytes - written);
  return availableBytes >= remaining + OVERHEAD_BYTES;
}

export function normalizeDownloadError(err) {
  if (!err) return makeCacheError('DOWNLOAD_FAILED', DOWNLOAD_FAILED_MESSAGE);
  if (err.code === 'STORAGE_FULL') return err;
  if (err.code === 'ABORTED' || isAbortError(err)) {
    return makeCacheError('ABORTED', ABORT_MESSAGE, err);
  }
  if (isStorageError(err)) return makeCacheError('STORAGE_FULL', STORAGE_MESSAGE, err);
  if (err.code === 'DOWNLOAD_REQUIRED' || isLikelyOffline(err)) {
    return makeCacheError('DOWNLOAD_REQUIRED', OFFLINE_MESSAGE, err);
  }
  if (err.code === 'DOWNLOAD_FAILED' && err.message) return err;
  return makeCacheError('DOWNLOAD_FAILED', DOWNLOAD_FAILED_MESSAGE, err);
}

// Cache success or failure never replaces a stream that is still starting.
// The saved file is used only after the stream itself has failed.
export function settleBackgroundCache({ error = null, streamReady = false, streamFailed = false } = {}) {
  if (!error) {
    return {
      clearProgress: true,
      downloadError: null,
      playbackError: null,
      useDownloadedFile: !streamReady && Boolean(streamFailed),
    };
  }
  if (error.code === 'ABORTED' || error.name === 'AbortError') {
    return {
      clearProgress: true,
      downloadError: null,
      playbackError: null,
      useDownloadedFile: false,
    };
  }
  const playbackAlsoFailed = !streamReady && Boolean(streamFailed);
  return {
    clearProgress: true,
    downloadError: playbackAlsoFailed ? null : error,
    playbackError: playbackAlsoFailed ? error : null,
    useDownloadedFile: false,
  };
}

export async function performCacheDownload({
  readFinal,
  availableBytes,
  expectedBytes = null,
  signal,
  removeTemp,
  removeFinal,
  downloadToTemp,
  commitTemp,
  writeReceipt,
  onProgress,
  readAvailableBytes,
}) {
  const finalInfo = readFinal() || { exists: false, size: 0, receiptBytes: null };
  const finalSize = finalInfo.exists ? finalInfo.size : 0;
  if (cachedFileIsUsable({ size: finalSize, receiptBytes: finalInfo.receiptBytes ?? null })) {
    return { alreadyCached: true, size: finalSize };
  }
  // Keep whatever is already on disk until the new copy is fully written.
  // A failed replacement must not erase that file.

  if (signal?.aborted) throw makeCacheError('ABORTED', ABORT_MESSAGE);

  const space = assessCacheSpace(
    availableBytes,
    Number.isFinite(expectedBytes) ? expectedBytes : null
  );
  if (!space.ok) {
    removeTemp();
    throw makeCacheError('STORAGE_FULL', space.message);
  }

  removeTemp();
  onProgress?.(0, { bytesWritten: 0, totalBytes: expectedBytes ?? null });

  let totalSeen = Number.isFinite(expectedBytes) && expectedBytes > 0 ? expectedBytes : null;
  let storageAbort = false;

  let downloaded;
  try {
    downloaded = await downloadToTemp({
      onBytes: ({ bytesWritten, totalBytes }) => {
        if (Number.isFinite(totalBytes) && totalBytes > 0) totalSeen = totalBytes;
        const availableNow = readAvailableBytes ? readAvailableBytes() : null;
        if (!remainingBytesFit(availableNow, totalSeen, bytesWritten)) {
          storageAbort = true;
          return 'abort-storage';
        }
        const knownTotal = totalSeen;
        const ratio = knownTotal ? Math.min(1, (Number(bytesWritten) || 0) / knownTotal) : null;
        onProgress?.(ratio, {
          bytesWritten: Number(bytesWritten) || 0,
          totalBytes: knownTotal,
        });
        return 'continue';
      },
    });
  } catch (err) {
    removeTemp();
    if (storageAbort) throw makeCacheError('STORAGE_FULL', STORAGE_MESSAGE, err);
    throw normalizeDownloadError(err);
  }

  if (storageAbort) {
    removeTemp();
    throw makeCacheError('STORAGE_FULL', STORAGE_MESSAGE);
  }

  const size = Number(downloaded?.size) || 0;
  if (!cachedFileIsUsable({ size, receiptBytes: totalSeen })) {
    removeTemp();
    const availableNow = readAvailableBytes ? readAvailableBytes() : availableBytes;
    if (isStorageError(downloaded?.error) || (Number.isFinite(availableNow) && availableNow < MIN_FREE_BYTES)) {
      throw makeCacheError('STORAGE_FULL', STORAGE_MESSAGE);
    }
    throw makeCacheError('DOWNLOAD_FAILED', DOWNLOAD_FAILED_MESSAGE);
  }

  try {
    if (finalInfo.exists) removeFinal();
    commitTemp();
    try {
      writeReceipt?.(size);
    } catch {
      // The audio file is already in place. A missing receipt still plays offline.
    }
  } catch (err) {
    removeTemp();
    const after = readFinal() || { exists: false, size: 0, receiptBytes: null };
    const afterSize = after.exists ? after.size : 0;
    // Only drop a final that this attempt left incomplete. A still-valid
    // previous file stays where it is.
    if (after.exists && !cachedFileIsUsable({ size: afterSize, receiptBytes: totalSeen })) {
      const stillOriginal = afterSize === finalSize && (after.receiptBytes ?? null) === (finalInfo.receiptBytes ?? null);
      if (!stillOriginal && !cachedFileIsUsable({ size: afterSize, receiptBytes: after.receiptBytes ?? null })) {
        removeFinal();
      }
    }
    throw normalizeDownloadError(err);
  }

  const saved = readFinal() || { exists: false, size: 0, receiptBytes: null };
  if (!cachedFileIsUsable({ size: saved.exists ? saved.size : 0, receiptBytes: totalSeen })) {
    removeTemp();
    removeFinal();
    throw makeCacheError('DOWNLOAD_FAILED', 'Could not save the downloaded lesson.');
  }

  onProgress?.(1, { bytesWritten: saved.size, totalBytes: saved.size });
  return { alreadyCached: false, size: saved.size };
}
