export function sanitizeAudioFilename(filename) {
  const name = String(filename || '').trim();
  const base = name.replace(/\\/g, '/').split('/').pop();
  if (!base || base !== name || base.includes('..') || !/\.mp3$/i.test(base)) {
    const err = new Error('Invalid audio filename.');
    err.code = 'INVALID_FILENAME';
    throw err;
  }
  return base;
}

const FALLBACK_AUDIO_BASE_URL =
  'https://pub-1be73d585aea4edb857616059935d6da.r2.dev';

export function getAudioStoragePath(filename) {
  return `audio/${sanitizeAudioFilename(filename)}`;
}

export function getRemoteAudioUrl(filename) {
  const base = process.env.EXPO_PUBLIC_AUDIO_BASE_URL || FALLBACK_AUDIO_BASE_URL;
  if (!base || !String(base).trim()) {
    const err = new Error('Audio storage is not configured.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const origin = String(base).trim().replace(/\/+$/, '');
  const objectPath = getAudioStoragePath(filename);
  return `${origin}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}
