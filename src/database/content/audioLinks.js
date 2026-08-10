/**
 * audioLinks.js — Audio-to-hadith relationship definitions.
 *
 * Each entry links a filename to a specific hadith via logical identifiers
 * (chapter_number + hadith_number) rather than database auto-increment IDs.
 * The importer resolves these to real database IDs at startup.
 *
 * SHAPE
 * ─────
 *   {
 *     filename       : string  — must match a filename in audios.js
 *     chapter_number : number  — chapter the hadith belongs to
 *     hadith_number  : string  — identifier of the hadith within that chapter
 *   }
 *
 * ONE AUDIO → MULTIPLE HADITHS
 * ─────────────────────────────
 * If one track covers several hadiths, add one entry per hadith:
 *   { filename: '002.mp3', chapter_number: 1, hadith_number: '1' },
 *   { filename: '002.mp3', chapter_number: 1, hadith_number: '2' },
 *
 * IMPORTANT
 * ─────────
 * - filenames must match entries in audios.js.
 * - chapter_number + hadith_number must match hadiths in the database
 *   (seeded by devSeed.js in development, or real content in production).
 * - Do NOT use database IDs here.
 */

/** @type {Array<{ filename: string, chapter_number: number, hadith_number: string }>} */
const audioLinks = [
  { filename: '001.mp3', chapter_number: 1, hadith_number: '1' },
  { filename: '002.mp3', chapter_number: 1, hadith_number: '2' },
  { filename: '003.mp3', chapter_number: 1, hadith_number: '3' },

  // ── Add production links here ─────────────────────────────────────
  // { filename: '004.mp3', chapter_number: 2, hadith_number: '1' },
];

export default audioLinks;
