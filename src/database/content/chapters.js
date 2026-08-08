/**
 * chapters.js — Riyad as-Salihin chapter data.
 *
 * HOW TO USE
 * ──────────
 * Replace the placeholder array below with the real chapter records.
 * Each object must match this shape:
 *
 *   {
 *     chapter_number : number   — unique, positive integer
 *     arabic_title   : string   — non-empty Arabic text
 *     english_title  : string   — non-empty English text
 *     ordering       : number   — display order (usually same as chapter_number)
 *   }
 *
 * The importer (contentImporter.js) will validate every record before
 * any SQL is executed.  You do not need to write INSERT statements here.
 *
 * CURRENT STATE
 * ─────────────
 * This file ships with an empty array.  The development seed (devSeed.js)
 * provides data while the app is in development mode.  Once the real
 * dataset is placed here and imported, devSeed.js can be disabled.
 */

/** @type {Array<{chapter_number: number, arabic_title: string, english_title: string, ordering: number}>} */
const chapters = [
  // ── Paste real chapters here ──────────────────────────────────────────
  // Example (remove before adding real data):
  //
  // {
  //   chapter_number: 1,
  //   arabic_title: 'بَابُ النِّيَّةِ وَإِخْلَاصِهَا',
  //   english_title: 'Chapter 1: Sincerity and Intention',
  //   ordering: 1,
  // },
];

export default chapters;
