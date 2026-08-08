/**
 * hadiths.js — Riyad as-Salihin hadith data.
 *
 * HOW TO USE
 * ──────────
 * Replace the placeholder array below with the real hadith records.
 * Each object must match this shape:
 *
 *   {
 *     chapter_number : number   — must match a chapter_number in chapters.js
 *     hadith_number  : string   — identifier within the chapter (e.g. "1", "2a")
 *     arabic_text    : string   — non-empty Arabic hadith text
 *     english_text   : string   — non-empty English translation
 *     ordering       : number   — display order within the chapter
 *   }
 *
 * chapter_number is used during import to look up the chapter's database
 * id.  All referenced chapter_numbers must exist in chapters.js.
 *
 * The importer (contentImporter.js) will validate every record before
 * any SQL is executed.
 *
 * CURRENT STATE
 * ─────────────
 * This file ships with an empty array.  The development seed (devSeed.js)
 * provides data while the app is in development mode.
 */

/**
 * @type {Array<{
 *   chapter_number : number,
 *   hadith_number  : string,
 *   arabic_text    : string,
 *   english_text   : string,
 *   ordering       : number
 * }>}
 */
const hadiths = [
  // ── Paste real hadiths here ───────────────────────────────────────────
  // Example (remove before adding real data):
  //
  // {
  //   chapter_number: 1,
  //   hadith_number: '1',
  //   arabic_text: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ...',
  //   english_text: 'Actions are judged by intentions...',
  //   ordering: 1,
  // },
];

export default hadiths;
