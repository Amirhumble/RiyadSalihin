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
  // '011.mp3': require('../../assets/audio/011.mp3'),
  // '012.mp3': require('../../assets/audio/012.mp3'),
  // '013.mp3': require('../../assets/audio/013.mp3'),
  // '014.mp3': require('../../assets/audio/014.mp3'),
  // '015.mp3': require('../../assets/audio/015.mp3'),
  // '016.mp3': require('../../assets/audio/016.mp3'),
  // '017.mp3': require('../../assets/audio/017.mp3'),
  // '018.mp3': require('../../assets/audio/018.mp3'),
  // '019.mp3': require('../../assets/audio/019.mp3'),
  // '020.mp3': require('../../assets/audio/020.mp3'),
  // '021.mp3': require('../../assets/audio/021.mp3'),
  // '022.mp3': require('../../assets/audio/022.mp3'),
  // '023.mp3': require('../../assets/audio/023.mp3'),
  // '024.mp3': require('../../assets/audio/024.mp3'),
  // '025.mp3': require('../../assets/audio/025.mp3'),
  // '026.mp3': require('../../assets/audio/026.mp3'),
  // '027.mp3': require('../../assets/audio/027.mp3'),
  // '028.mp3': require('../../assets/audio/028.mp3'),
  // '029.mp3': require('../../assets/audio/029.mp3'),
  // '030.mp3': require('../../assets/audio/030.mp3'),
  // '031.mp3': require('../../assets/audio/031.mp3'),
  // '032.mp3': require('../../assets/audio/032.mp3'),
  // '033.mp3': require('../../assets/audio/033.mp3'),
  // '034.mp3': require('../../assets/audio/034.mp3'),
  // '035.mp3': require('../../assets/audio/035.mp3'),
  // '036.mp3': require('../../assets/audio/036.mp3'),
  // '037.mp3': require('../../assets/audio/037.mp3'),
  // '038.mp3': require('../../assets/audio/038.mp3'),
  // '039.mp3': require('../../assets/audio/039.mp3'),
  // '040.mp3': require('../../assets/audio/040.mp3'),
  // '041.mp3': require('../../assets/audio/041.mp3'),
  // '042.mp3': require('../../assets/audio/042.mp3'),
  // '043.mp3': require('../../assets/audio/043.mp3'),
  // '044.mp3': require('../../assets/audio/044.mp3'),
  // '045.mp3': require('../../assets/audio/045.mp3'),
  // '046.mp3': require('../../assets/audio/046.mp3'),
  // '047.mp3': require('../../assets/audio/047.mp3'),
  // '048.mp3': require('../../assets/audio/048.mp3'),
  // '049.mp3': require('../../assets/audio/049.mp3'),
  // '050.mp3': require('../../assets/audio/050.mp3'),
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
