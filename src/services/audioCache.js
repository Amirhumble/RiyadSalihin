import { Directory, File, Paths } from 'expo-file-system';

import {
  cachedFileIsUsable,
  isTempCacheName,
  performCacheDownload,
} from './cacheDownload';
import { getRemoteAudioUrl, sanitizeAudioFilename } from './audioRemote';

const CACHE_DIR_NAME = 'audio-cache';
const inflight = new Map();

function makeError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

function getCacheDir() {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function readAvailableBytes() {
  try {
    const value = Number(Paths.availableDiskSpace);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readReceiptBytes(file) {
  try {
    if (!file.exists || file.size <= 0) return null;
    const value = Number(String(file.textSync()).trim());
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function removeIfExists(file) {
  try {
    if (file?.exists) file.delete();
  } catch {
    // ignore cleanup failures
  }
}

function bindAbort(controller, signal) {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  return () => signal.removeEventListener('abort', onAbort);
}

export function getCachedAudioPath(filename) {
  const safe = sanitizeAudioFilename(filename);
  return new File(getCacheDir(), safe);
}

function cachedEntry(filename) {
  const safe = sanitizeAudioFilename(filename);
  const dir = getCacheDir();
  const file = new File(dir, safe);
  const receipt = new File(dir, `${safe}.bytes`);
  if (!file.exists) return null;
  const receiptBytes = readReceiptBytes(receipt);
  // An incomplete file is not a saved lesson. Leave it on disk so a failed
  // retry cannot be the thing that deletes the only copy.
  if (!cachedFileIsUsable({ size: file.size, receiptBytes })) return null;
  return file;
}

export function getCachedAudioUri(filename) {
  try {
    return cachedEntry(filename)?.uri ?? null;
  } catch {
    return null;
  }
}

export function isAudioCached(filename) {
  return getCachedAudioUri(filename) != null;
}

export function getCachedAudioBytes(filename) {
  try {
    return cachedEntry(filename)?.size ?? 0;
  } catch {
    return 0;
  }
}

export function isAudioDownloadInflight(filename) {
  try {
    return inflight.has(sanitizeAudioFilename(filename));
  } catch {
    return false;
  }
}

function purgeOrphanTempFiles() {
  let dir;
  try {
    dir = getCacheDir();
  } catch {
    return;
  }
  let entries = [];
  try {
    entries = dir.list();
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry?.name || '';
    if (!isTempCacheName(name)) continue;
    const base = name.slice(0, -'.tmp'.length);
    if (inflight.has(base)) continue;
    removeIfExists(entry);
  }
}

async function downloadToCache(filename, onProgress, signal) {
  const safe = sanitizeAudioFilename(filename);
  const dir = getCacheDir();
  const finalFile = new File(dir, safe);
  const tmpFile = new File(dir, `${safe}.tmp`);
  const receiptFile = new File(dir, `${safe}.bytes`);
  let task = null;
  let resultFile = tmpFile;

  await performCacheDownload({
    signal,
    availableBytes: readAvailableBytes(),
    readAvailableBytes,
    readFinal: () => ({
      exists: Boolean(finalFile.exists),
      size: finalFile.exists ? finalFile.size : 0,
      receiptBytes: readReceiptBytes(receiptFile),
    }),
    removeTemp: () => removeIfExists(tmpFile),
    removeFinal: () => {
      removeIfExists(finalFile);
      removeIfExists(receiptFile);
    },
    onProgress,
    downloadToTemp: async ({ onBytes }) => {
      const url = getRemoteAudioUrl(safe);
      task = File.createDownloadTask(url, tmpFile, {
        headers: { Accept: 'audio/mpeg,audio/*,*/*' },
        signal,
        onProgress: (event) => {
          if (onBytes(event) === 'abort-storage') {
            try { task?.cancel(); } catch { /* the rejection is handled below */ }
          }
        },
      });
      const downloaded = await task.downloadAsync();
      resultFile = downloaded && downloaded.exists ? downloaded : tmpFile;
      if (!resultFile?.exists) {
        throw makeError('ABORTED', 'Download cancelled.');
      }
      return { size: resultFile.size };
    },
    commitTemp: () => {
      if (finalFile.exists) finalFile.delete();
      if (resultFile.exists && resultFile.uri !== finalFile.uri) {
        resultFile.moveSync(finalFile);
      }
    },
    writeReceipt: (size) => {
      receiptFile.write(String(size));
    },
  });

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
  purgeOrphanTempFiles();

  const cachedUri = getCachedAudioUri(safe);
  if (cachedUri) return cachedUri;

  const existing = inflight.get(safe);
  if (existing) {
    const unlink = bindAbort({ abort: () => existing.abort?.() }, signal);
    if (onProgress) {
      existing.listeners.add(onProgress);
      if (existing.lastRatio != null || existing.lastMeta) {
        try { onProgress(existing.lastRatio, existing.lastMeta); } catch { /* ignore */ }
      }
    }
    try {
      return await existing.promise;
    } finally {
      unlink();
      if (onProgress) existing.listeners.delete(onProgress);
    }
  }

  if (signal?.aborted) {
    throw makeError('ABORTED', 'Download cancelled.');
  }

  const controller = new AbortController();
  const unlink = bindAbort(controller, signal);
  const entry = {
    listeners: new Set(),
    lastRatio: null,
    lastMeta: undefined,
    promise: null,
    abort: () => controller.abort(),
  };
  if (onProgress) entry.listeners.add(onProgress);

  entry.promise = downloadToCache(
    safe,
    (ratio, meta) => notifyProgress(entry, ratio, meta),
    controller.signal
  ).finally(() => {
    unlink();
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
  removeIfExists(new File(dir, `${safe}.bytes`));
}
