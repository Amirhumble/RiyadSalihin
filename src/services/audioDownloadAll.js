import {
  getLocalAudioUri,
  isAudioCached,
  probeRemoteAudioBytes,
} from './audioCache';

const CONCURRENCY = 2;

let activeController = null;

export function isDownloadAllRunning() {
  return Boolean(activeController);
}

export function cancelDownloadAll() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

export async function downloadAllAudios(audios, { onProgress } = {}) {
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

  const emit = (extra = {}) => {
    const done = cached.length + downloaded.length + failed.length;
    onProgress?.({
      phase: extra.phase || 'download',
      total,
      cached: cached.length,
      downloaded: downloaded.length,
      failed: failed.length,
      remaining: Math.max(0, missing.length - downloaded.length - failed.length),
      current: extra.current || null,
      cancelled,
      ...extra,
    });
  };

  try {
    emit({ phase: 'scan' });

    if (signal.aborted) {
      cancelled = true;
      return { cached, downloaded, failed, cancelled, total };
    }

    await runPool(missing, CONCURRENCY, async (audio) => {
      if (signal.aborted) {
        cancelled = true;
        return;
      }
      emit({ phase: 'download', current: audio });
      try {
        await getLocalAudioUri(audio.filename, { signal });
        if (isAudioCached(audio.filename)) {
          downloaded.push(audio);
        } else if (signal.aborted) {
          cancelled = true;
        } else {
          failed.push(audio);
        }
      } catch (err) {
        if (err?.code === 'ABORTED' || err?.name === 'AbortError' || signal.aborted) {
          cancelled = true;
          return;
        }
        failed.push(audio);
      }
      emit({ phase: 'download', current: audio });
    });

    if (signal.aborted) cancelled = true;
    emit({ phase: 'done', current: null });
    return { cached, downloaded, failed, cancelled, total };
  } finally {
    if (activeController === controller) activeController = null;
  }
}
