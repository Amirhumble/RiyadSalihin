// Map each filename in audios.js to its bundled require().
// Metro needs static require() paths — dynamic paths do not work.
const AUDIO_ASSETS = {
  '001.mp3': require('../../assets/audio/001.mp3'),
  '002.mp3': require('../../assets/audio/002.mp3'),
  '003.mp3': require('../../assets/audio/003.mp3'),
  '004.mp3': require('../../assets/audio/004.mp3'),
  '005.mp3': require('../../assets/audio/005.mp3'),
  '006.mp3': require('../../assets/audio/006.mp3'),
  '007.mp3': require('../../assets/audio/007.mp3'),
  '008.mp3': require('../../assets/audio/008.mp3'),
  '009.mp3': require('../../assets/audio/009.mp3'),
  '010.mp3': require('../../assets/audio/010.mp3'),
  '011.mp3': require('../../assets/audio/011.mp3'),
  '012.mp3': require('../../assets/audio/012.mp3'),
  '013.mp3': require('../../assets/audio/013.mp3'),
  '014.mp3': require('../../assets/audio/014.mp3'),
  '015.mp3': require('../../assets/audio/015.mp3'),
  '016.mp3': require('../../assets/audio/016.mp3'),
  '017.mp3': require('../../assets/audio/017.mp3'),
  '018.mp3': require('../../assets/audio/018.mp3'),
  '019.mp3': require('../../assets/audio/019.mp3'),
  '020.mp3': require('../../assets/audio/020.mp3'),
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
