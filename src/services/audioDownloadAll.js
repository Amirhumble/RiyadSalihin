import {
  getCachedAudioBytes,
  getLocalAudioUri,
  isAudioCached,
  probeRemoteAudioBytes,
} from './audioCache';

const CONCURRENCY = 2;
const PROGRESS_THROTTLE_MS = 200;

let activeController = null;
const listeners = new Set();
let publishTimer = null;
let pendingPatch = null;

const IDLE_SNAPSHOT = {
  status: 'idle',
  total: 0,
  saved: 0,
  failed: 0,
  remaining: 0,
  percent: 0,
  cancelled: false,
  current: null,
  currentProgress: null,
  currentSpeedBps: null,
  currentBytes: null,
  currentTotalBytes: null,
  bytesHave: null,
  bytesTotal: null,
  bytesReliable: false,
  failedItems: [],
  statuses: {},
  fileProgress: {},
  error: null,
};

let snapshot = { ...IDLE_SNAPSHOT };

export function getDownloadAllSnapshot() {
  return snapshot;
}

export function subscribeDownloadAll(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDownloadAllRunning() {
  return Boolean(activeController);
}

export function cancelDownloadAll() {
  if (!activeController || activeController.signal.aborted) return;
  activeController.abort();
  applySnapshot({ status: 'cancelling', cancelled: true }, { flush: true });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatSpeed(bps) {
  if (!Number.isFinite(bps) || bps <= 0) return null;
  const label = formatBytes(bps);
  return label ? `${label}/s` : null;
}

function slimAudio(audio) {
  if (!audio) return null;
  return {
    id: audio.id,
    filename: audio.filename,
    title: audio.title,
    ordering: audio.ordering,
  };
}

function applySnapshot(partial, { flush = false } = {}) {
  pendingPatch = pendingPatch ? { ...pendingPatch, ...partial } : { ...partial };
  if (flush) {
    if (publishTimer) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
    flushSnapshot();
    return;
  }
  if (publishTimer) return;
  publishTimer = setTimeout(flushSnapshot, PROGRESS_THROTTLE_MS);
}

function flushSnapshot() {
  publishTimer = null;
  if (!pendingPatch) return;
  const next = { ...snapshot, ...pendingPatch };
  pendingPatch = null;
  snapshot = next;
  listeners.forEach((listener) => {
    try { listener(snapshot); } catch { /* UI subscriber errors must not stop downloads */ }
  });
}

async function runPool(items, limit, worker) {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  }
  const n = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: n }, () => run()));
}

export function classifyAudioCache(audios) {
  const list = Array.isArray(audios) ? audios : [];
  const cached = [];
  const missing = [];
  for (const audio of list) {
    if (!audio?.filename) continue;
    if (isAudioCached(audio.filename)) cached.push(audio);
    else missing.push(audio);
  }
  return { cached, missing, total: cached.length + missing.length };
}

function sumCachedBytes(audios) {
  let total = 0;
  for (const audio of audios) {
    if (!audio?.filename) continue;
    total += getCachedAudioBytes(audio.filename);
  }
  return total;
}

function statusesFromClassification(cached, missing, failedItems = []) {
  const statuses = {};
  const failedSet = new Set(failedItems.map((item) => item.filename).filter(Boolean));
  for (const audio of cached) statuses[audio.filename] = 'downloaded';
  for (const audio of missing) {
    statuses[audio.filename] = failedSet.has(audio.filename) ? 'failed' : 'idle';
  }
  return statuses;
}

export function scanDownloadAllCache(audios) {
  if (activeController) return snapshot;

  const { cached, missing, total } = classifyAudioCache(audios);
  const failedItems = (snapshot.failedItems || []).filter(
    (item) => item?.filename && !isAudioCached(item.filename)
  );
  const statuses = statusesFromClassification(cached, missing, failedItems);
  const saved = cached.length;
  const allDone = total > 0 && missing.length === 0;
  const hasFailures = failedItems.length > 0;

  let status = 'idle';
  if (allDone) status = 'completed';
  else if (snapshot.status === 'cancelled' && missing.length > 0) status = 'cancelled';
  else if (hasFailures) status = 'partial';

  const bytesHave = sumCachedBytes(cached);

  applySnapshot({
    status,
    total,
    saved,
    failed: failedItems.length,
    remaining: missing.length,
    percent: total > 0 ? Math.round((saved / total) * 100) : 0,
    cancelled: status === 'cancelled',
    current: null,
    currentProgress: null,
    currentSpeedBps: null,
    currentBytes: null,
    currentTotalBytes: null,
    bytesHave: bytesHave > 0 ? bytesHave : null,
    bytesTotal: null,
    bytesReliable: false,
    failedItems,
    statuses,
    fileProgress: {},
    error: null,
  }, { flush: true });

  return snapshot;
}

export async function estimateMissingBytes(missing, { signal } = {}) {
  let totalBytes = 0;
  let sizedCount = 0;
  let networkFailures = 0;

  if (!missing.length) {
    return { totalBytes: 0, sizedCount: 0, networkFailures: 0 };
  }

  await runPool(missing, CONCURRENCY, async (audio) => {
    if (signal?.aborted) return;
    try {
      const bytes = await probeRemoteAudioBytes(audio.filename);
      if (bytes) {
        totalBytes += bytes;
        sizedCount += 1;
      }
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (
        err?.name === 'AbortError' ||
        msg.includes('network') ||
        msg.includes('failed to fetch') ||
        msg.includes('internet') ||
        msg.includes('offline')
      ) {
        networkFailures += 1;
      }
    }
  });

  return { totalBytes, sizedCount, networkFailures };
}

export async function downloadAllAudios(audios, { onProgress, estimatedBytes } = {}) {
  if (activeController) {
    const err = new Error('A download is already in progress.');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  const { cached, missing, total } = classifyAudioCache(audios);
  const downloaded = [];
  const failed = [];
  let cancelled = false;

  const statuses = {
    ...(snapshot.statuses || {}),
    ...statusesFromClassification(cached, missing),
  };
  for (const audio of missing) statuses[audio.filename] = 'waiting';

  const activeFiles = new Map();
  const fileProgress = {};
  const speedSamples = new Map();
  let bytesCompleted = sumCachedBytes(cached);
  const estimatedMissing = Number(estimatedBytes);
  const bytesReliable = Number.isFinite(estimatedMissing) && estimatedMissing > 0;
  const bytesTotal = bytesReliable ? bytesCompleted + estimatedMissing : null;

  const pickCurrent = () => {
    if (activeFiles.size === 0) return null;
    let latest = null;
    let latestAt = -1;
    for (const audio of activeFiles.values()) {
      const at = fileProgress[audio.filename]?.updatedAt ?? 0;
      if (at >= latestAt) {
        latestAt = at;
        latest = audio;
      }
    }
    return slimAudio(latest);
  };

  const currentFields = (current) => {
    if (!current) {
      return {
        current: null,
        currentProgress: null,
        currentSpeedBps: null,
        currentBytes: null,
        currentTotalBytes: null,
      };
    }
    const progress = fileProgress[current.filename];
    return {
      current,
      currentProgress: progress?.ratio ?? null,
      currentSpeedBps: progress?.speedBps ?? null,
      currentBytes: progress?.bytesWritten ?? null,
      currentTotalBytes: progress?.totalBytes ?? null,
    };
  };

  const inProgressBytes = () => {
    let extra = 0;
    for (const audio of activeFiles.values()) {
      const written = fileProgress[audio.filename]?.bytesWritten;
      if (Number.isFinite(written) && written > 0) extra += written;
    }
    return extra;
  };

  const publish = (extra = {}, { flush = false } = {}) => {
    const saved = cached.length + downloaded.length;
    const bytesHave = bytesCompleted + inProgressBytes();
    const percent = bytesReliable && bytesTotal > 0
      ? Math.min(100, Math.round((bytesHave / bytesTotal) * 100))
      : (total > 0 ? Math.round((saved / total) * 100) : 0);
    const current = pickCurrent();
    const next = {
      status: extra.status
        || (signal.aborted ? 'cancelling' : 'downloading'),
      total,
      saved,
      failed: failed.length,
      remaining: Math.max(0, missing.length - downloaded.length - failed.length),
      percent,
      cancelled,
      ...currentFields(current),
      bytesHave: bytesHave > 0 ? bytesHave : null,
      bytesTotal,
      bytesReliable,
      failedItems: failed.slice(),
      statuses: { ...statuses },
      fileProgress: { ...fileProgress },
      error: extra.error || null,
      ...extra,
    };
    applySnapshot(next, { flush });
    onProgress?.({
      phase: next.status === 'scanning' ? 'scan' : (next.status === 'downloading' ? 'download' : 'done'),
      total,
      cached: cached.length,
      downloaded: downloaded.length,
      failed: failed.length,
      remaining: next.remaining,
      current: next.current,
      cancelled,
    });
  };

  try {
    applySnapshot({
      status: 'scanning',
      total,
      saved: cached.length,
      failed: 0,
      remaining: missing.length,
      percent: total > 0 ? Math.round((cached.length / total) * 100) : 0,
      cancelled: false,
      current: null,
      currentProgress: null,
      currentSpeedBps: null,
      currentBytes: null,
      currentTotalBytes: null,
      bytesHave: bytesCompleted > 0 ? bytesCompleted : null,
      bytesTotal,
      bytesReliable,
      failedItems: [],
      statuses: { ...statuses },
      fileProgress: {},
      error: null,
    }, { flush: true });

    if (signal.aborted) {
      cancelled = true;
      applySnapshot({ status: 'cancelled', cancelled: true }, { flush: true });
      return { cached, downloaded, failed, cancelled, total };
    }

    publish({ status: 'downloading' }, { flush: true });

    await runPool(missing, CONCURRENCY, async (audio) => {
      if (signal.aborted) {
        cancelled = true;
        return;
      }

      statuses[audio.filename] = 'downloading';
      activeFiles.set(audio.filename, audio);
      publish({}, { flush: true });

      try {
        await getLocalAudioUri(audio.filename, {
          signal,
          onProgress: (ratio, meta) => {
            const now = Date.now();
            const bytesWritten = Number(meta?.bytesWritten);
            const totalBytes = Number(meta?.totalBytes);
            const prev = speedSamples.get(audio.filename);
            let speedBps = fileProgress[audio.filename]?.speedBps ?? null;
            if (prev && Number.isFinite(bytesWritten) && now > prev.t) {
              const dt = (now - prev.t) / 1000;
              if (dt >= 0.2) {
                const delta = bytesWritten - prev.bytes;
                if (delta >= 0) speedBps = delta / dt;
                speedSamples.set(audio.filename, { t: now, bytes: bytesWritten });
              }
            } else if (Number.isFinite(bytesWritten)) {
              speedSamples.set(audio.filename, { t: now, bytes: bytesWritten });
            }

            fileProgress[audio.filename] = {
              ratio: Number.isFinite(ratio) ? ratio : fileProgress[audio.filename]?.ratio ?? null,
              bytesWritten: Number.isFinite(bytesWritten) ? bytesWritten : null,
              totalBytes: Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null,
              speedBps,
              updatedAt: now,
            };
            publish();
          },
        });

        if (isAudioCached(audio.filename)) {
          downloaded.push(audio);
          statuses[audio.filename] = 'downloaded';
          bytesCompleted += getCachedAudioBytes(audio.filename);
        } else if (signal.aborted) {
          cancelled = true;
          statuses[audio.filename] = 'idle';
        } else {
          failed.push(audio);
          statuses[audio.filename] = 'failed';
        }
      } catch (err) {
        if (err?.code === 'ABORTED' || err?.name === 'AbortError' || signal.aborted) {
          cancelled = true;
          statuses[audio.filename] = 'idle';
        } else {
          failed.push(audio);
          statuses[audio.filename] = 'failed';
        }
      } finally {
        activeFiles.delete(audio.filename);
        delete fileProgress[audio.filename];
        speedSamples.delete(audio.filename);
        publish({}, { flush: true });
      }
    });

    if (signal.aborted) cancelled = true;

    const saved = cached.length + downloaded.length;
    const allDone = !cancelled && failed.length === 0 && saved === total && total > 0;
    const status = cancelled
      ? 'cancelled'
      : allDone
        ? 'completed'
        : (failed.length > 0 ? 'partial' : 'idle');

    for (const audio of missing) {
      if (statuses[audio.filename] === 'waiting' || statuses[audio.filename] === 'downloading') {
        statuses[audio.filename] = failed.some((item) => item.filename === audio.filename)
          ? 'failed'
          : (isAudioCached(audio.filename) ? 'downloaded' : 'idle');
      }
    }

    applySnapshot({
      status,
      total,
      saved,
      failed: failed.length,
      remaining: Math.max(0, total - saved),
      percent: total > 0 ? Math.round((saved / total) * 100) : 0,
      cancelled,
      current: null,
      currentProgress: null,
      currentSpeedBps: null,
      currentBytes: null,
      currentTotalBytes: null,
      bytesHave: bytesCompleted > 0 ? bytesCompleted : null,
      bytesTotal: null,
      bytesReliable: false,
      failedItems: failed.slice(),
      statuses: { ...statuses },
      fileProgress: {},
      error: null,
    }, { flush: true });

    onProgress?.({
      phase: 'done',
      total,
      cached: cached.length,
      downloaded: downloaded.length,
      failed: failed.length,
      remaining: Math.max(0, missing.length - downloaded.length - failed.length),
      current: null,
      cancelled,
    });

    return { cached, downloaded, failed, cancelled, total };
  } finally {
    if (activeController === controller) activeController = null;
  }
}
