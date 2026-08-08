/**
 * audioLinks.js — Audio-to-hadith relationship definitions.
 *
 * HOW TO USE
 * ──────────
 * Each entry links a filename to a specific hadith using logical identifiers
 * (chapter_number + hadith_number) rather than database auto-increment IDs.
 * The importer resolves these to real database IDs at import time.
 *
 * Shape:
 *   {
 *     filename       : string   — must match a filename in audios.js
 *     chapter_number : number   — chapter the hadith belongs to
 *     hadith_number  : string   — identifier of the hadith within that chapter
 *   }
 *
 * ONE AUDIO → MULTIPLE HADITHS
 * ─────────────────────────────
 * If one audio track covers multiple hadiths, add one entry per hadith
 * using the same filename:
 *
 *   { filename: '001.mp3', chapter_number: 1, hadith_number: '1' },
 *   { filename: '001.mp3', chapter_number: 1, hadith_number: '2' },
 *
 * ONE HADITH → MULTIPLE AUDIOS
 * ─────────────────────────────
 * If a hadith has multiple takes / languages:
 *
 *   { filename: '001.mp3', chapter_number: 1, hadith_number: '1' },
 *   { filename: '001b.mp3', chapter_number: 1, hadith_number: '1' },
 *
 * IMPORTANT
 * ─────────
 * - Do NOT use database IDs.
 * - Do NOT put SQL here.
 * - filenames must match entries in audios.js.
 * - chapter_number + hadith_number must match entries in hadiths.js
 *   (or the dev seed when running in development).
 *
 * CURRENT STATE
 * ─────────────
 * Three development links match the existing devSeed.js setup.
 * Replace these when adding the real production audio files.
 */

/**
 * @type {Array<{
 *   filename       : string,
 *   chapter_number : number,
 *   hadith_number  : string,
 * }>}
 */
const audioLinks = [
  // ── Development links — matches devSeed.js ───────────────────────────
  { filename: '001.mp3', chapter_number: 1, hadith_number: '1' },
  { filename: '002.mp3', chapter_number: 1, hadith_number: '2' },
  { filename: '003.mp3', chapter_number: 1, hadith_number: '3' },

  // ── Production links will go here ────────────────────────────────────
  // Example (one audio → two hadiths):
  // { filename: '004.mp3', chapter_number: 2, hadith_number: '1' },
  // { filename: '004.mp3', chapter_number: 2, hadith_number: '2' },
];

export default audioLinks;
