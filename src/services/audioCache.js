import { Directory, File, Paths } from 'expo-file-system';

import { getRemoteAudioUrl, sanitizeAudioFilename } from './audioRemote';

const CACHE_DIR_NAME = 'audio-cache';
const inflight = new Map();

function makeError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

function isLikelyOffline(err) {
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
    msg.includes('unable to download') ||
    err?.name === 'AbortError'
  );
}

function getCacheDir() {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function getCachedAudioPath(filename) {
  const safe = sanitizeAudioFilename(filename);
  return new File(getCacheDir(), safe);
}

export function getCachedAudioUri(filename) {
  try {
    const file = getCachedAudioPath(filename);
    if (file.exists && file.size > 0) return file.uri;
  } catch {
    // missing or unreadable cache entry
  }
  return null;
}

export function isAudioCached(filename) {
  return getCachedAudioUri(filename) != null;
}

export function getCachedAudioBytes(filename) {
  try {
    const file = getCachedAudioPath(filename);
    if (file.exists && file.size > 0) return file.size;
  } catch {
    // missing or unreadable cache entry
  }
  return 0;
}

export function isAudioDownloadInflight(filename) {
  try {
    return inflight.has(sanitizeAudioFilename(filename));
  } catch {
    return false;
  }
}

function removeIfExists(file) {
  try {
    if (file.exists) file.delete();
  } catch {
    // ignore cleanup failures
  }
}

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === 'ABORTED';
}

async function downloadToCache(filename, onProgress, signal) {
  const safe = sanitizeAudioFilename(filename);
  const dir = getCacheDir();
  const finalFile = new File(dir, safe);
  const tmpFile = new File(dir, `${safe}.tmp`);

  if (finalFile.exists && finalFile.size > 0) {
    return finalFile.uri;
  }

  if (signal?.aborted) {
    throw makeError('ABORTED', 'Download cancelled.');
  }

  removeIfExists(tmpFile);
  removeIfExists(finalFile);

  const url = getRemoteAudioUrl(safe);
  onProgress?.(0, { bytesWritten: 0, totalBytes: null });

  let downloaded;
  try {
    const task = File.createDownloadTask(url, tmpFile, {
      headers: { Accept: 'audio/mpeg,audio/*,*/*' },
      signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (!onProgress) return;
        const knownTotal = totalBytes > 0 ? totalBytes : null;
        const ratio = knownTotal ? Math.min(1, bytesWritten / knownTotal) : null;
        onProgress(ratio, { bytesWritten, totalBytes: knownTotal });
      },
    });
    downloaded = await task.downloadAsync();
  } catch (err) {
    removeIfExists(tmpFile);
    if (isAbortError(err) || signal?.aborted) {
      throw makeError('ABORTED', 'Download cancelled.', err);
    }
    if (isLikelyOffline(err)) {
      throw makeError(
        'DOWNLOAD_REQUIRED',
        'This lesson needs to be downloaded first. Connect to the internet and try again.',
        err
      );
    }
    throw makeError(
      'DOWNLOAD_FAILED',
      'Could not download this lesson. Check your connection and try again.',
      err
    );
  }

  const resultFile = downloaded && downloaded.exists ? downloaded : tmpFile;
  if (!resultFile.exists || resultFile.size <= 0) {
    removeIfExists(tmpFile);
    throw makeError(
      'DOWNLOAD_FAILED',
      'Could not download this lesson. Check your connection and try again.'
    );
  }

  try {
    if (finalFile.exists) finalFile.delete();
    if (resultFile.uri !== finalFile.uri) {
      resultFile.moveSync(finalFile);
    }
  } catch (err) {
    removeIfExists(tmpFile);
    throw makeError('DOWNLOAD_FAILED', 'Could not save the downloaded lesson.', err);
  }

  const savedBytes = finalFile.size > 0 ? finalFile.size : null;
  onProgress?.(1, { bytesWritten: savedBytes, totalBytes: savedBytes });

  if (!finalFile.exists || finalFile.size <= 0) {
    throw makeError('DOWNLOAD_FAILED', 'Could not save the downloaded lesson.');
  }

  return finalFile.uri;
}

function notifyProgress(entry, ratio, meta) {
  entry.lastRatio = ratio;
  entry.lastMeta = meta;
  for (const fn of entry.listeners) {
    try { fn(ratio, meta); } catch { /* listener errors must not fail the download */ }
  }
}

export async function getLocalAudioUri(filename, { onProgress, signal } = {}) {
  const safe = sanitizeAudioFilename(filename);

  const cachedUri = getCachedAudioUri(safe);
  if (cachedUri) return cachedUri;

  const existing = inflight.get(safe);
  if (existing) {
    if (onProgress) {
      existing.listeners.add(onProgress);
      if (existing.lastRatio != null || existing.lastMeta) {
        try { onProgress(existing.lastRatio, existing.lastMeta); } catch { /* ignore */ }
      }
    }
    try {
      return await existing.promise;
    } finally {
      if (onProgress) existing.listeners.delete(onProgress);
    }
  }

  if (signal?.aborted) {
    throw makeError('ABORTED', 'Download cancelled.');
  }

  const entry = {
    listeners: new Set(),
    lastRatio: null,
    lastMeta: undefined,
    promise: null,
  };
  if (onProgress) entry.listeners.add(onProgress);

  entry.promise = downloadToCache(
    safe,
    (ratio, meta) => notifyProgress(entry, ratio, meta),
    signal
  ).finally(() => {
    inflight.delete(safe);
  });
  inflight.set(safe, entry);
  return entry.promise;
}

export async function probeRemoteAudioBytes(filename) {
  const url = getRemoteAudioUrl(filename);
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) {
    const err = new Error(`HEAD failed (${res.status})`);
    err.code = 'HEAD_FAILED';
    throw err;
  }
  const raw = res.headers.get('content-length');
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return bytes;
}

export function deleteCachedAudio(filename) {
  const safe = sanitizeAudioFilename(filename);
  const dir = getCacheDir();
  removeIfExists(new File(dir, safe));
  removeIfExists(new File(dir, `${safe}.tmp`));
}
