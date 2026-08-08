/**
 * audioAssets.js — centralised mapping from audio filename → bundled asset.
 *
 * Each entry maps the bare filename stored in the `audios.filename` column
 * to its `require()` reference.  Metro resolves `require()` at build time
 * so the path must be a static string literal.
 *
 * HOW TO ADD MORE FILES
 * ─────────────────────
 * 1. Drop the MP3 into assets/audio/
 * 2. Add one line here:  '004.mp3': require('../../assets/audio/004.mp3'),
 * 3. Insert the matching row in the database (or devSeed.js for dev testing).
 *
 * That is the only change needed to extend the library from 3 to 40–50 files.
 *
 * DEV NOTE
 * ────────
 * The three entries below point to real files in assets/audio/.
 * They will not be available until you place 001.mp3, 002.mp3, 003.mp3
 * in that directory.  The app handles missing files gracefully via
 * resolveAudioSource() returning null.
 */

const AUDIO_ASSETS = {
  '001.mp3': require('../../assets/audio/001.mp3'),
  '002.mp3': require('../../assets/audio/002.mp3'),
  '003.mp3': require('../../assets/audio/003.mp3'),
};

/**
 * Resolves a filename from the database to a bundled asset reference.
 *
 * @param {string|null|undefined} filename  – Value from audios.filename column.
 * @returns {number|null}  A Metro asset reference (number), or null if unknown.
 */
export function resolveAudioSource(filename) {
  if (!filename) return null;
  const asset = AUDIO_ASSETS[filename];
  if (!asset) {
    console.warn(`[audioAssets] No bundled asset for filename: "${filename}"`);
    return null;
  }
  return asset;
}

/**
 * Returns true if a mapping exists for the given filename.
 * @param {string} filename
 * @returns {boolean}
 */
export function isAudioAssetAvailable(filename) {
  return !!filename && Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, filename);
}
