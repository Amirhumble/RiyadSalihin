
const AUDIO_ASSETS = {
  '001.mp3': require('../../assets/audio/001.mp3'),
  '002.mp3': require('../../assets/audio/002.mp3'),
  '003.mp3': require('../../assets/audio/003.mp3'),
};

export function resolveAudioSource(filename) {
  if (!filename) return null;
  const asset = AUDIO_ASSETS[filename];
  if (!asset) {
    console.warn(`[audioAssets] No bundled asset for filename: "${filename}"`);
    return null;
  }
  return asset;
}

export function isAudioAssetAvailable(filename) {
  return !!filename && Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, filename);
}
