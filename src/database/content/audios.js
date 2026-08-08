/**
 * audios.js — Riyad as-Salihin audio metadata.
 *
 * HOW TO USE
 * ──────────
 * Replace the placeholder array below with the real audio records.
 * Each object must match this shape:
 *
 *   {
 *     filename       : string   — bare filename, e.g. '001.mp3'
 *                                 Must match a file in assets/audio/
 *                                 and a key in audioAssets.js
 *     title          : string   — human-readable track title
 *     chapter_number : number   — optional; chapter this track belongs to
 *                                 Set to null if the track spans multiple chapters
 *     ordering       : number   — display ordering within its chapter (0-based ok)
 *   }
 *
 * IMPORTANT
 * ─────────
 * - Do NOT put SQL here.  This file contains DATA ONLY.
 * - Do NOT use database IDs here.  IDs are resolved at import time.
 * - chapter_number is optional (nullable).  Use it when a track belongs
 *   to exactly one chapter so getAudiosByChapter() can find it directly.
 * - duration_ms is intentionally absent — it is discovered at playback time.
 * - position_ms is intentionally absent — it is a user-state field.
 *
 * RUNTIME ASSET MAPPING
 * ─────────────────────
 * This file does NOT perform Metro require() calls.
 * The runtime mapping between filenames and bundled assets lives in:
 *   src/services/audioAssets.js
 * Add an entry there for each filename added here.
 *
 * CURRENT STATE
 * ─────────────
 * Three development entries match the existing devSeed.js and audioAssets.js.
 * When the real 40–50 production files are ready, replace these entries.
 */

/**
 * @type {Array<{
 *   filename       : string,
 *   title          : string,
 *   chapter_number : number | null,
 *   ordering       : number,
 * }>}
 */
const audios = [
  // ── Development tracks — matches devSeed.js and audioAssets.js ─────────
  // Remove or replace these when adding the real 40–50 production files.
  {
    filename: '001.mp3',
    title: '[DEV] Track 001',
    chapter_number: 1,
    ordering: 1,
  },
  {
    filename: '002.mp3',
    title: '[DEV] Track 002',
    chapter_number: 1,
    ordering: 2,
  },
  {
    filename: '003.mp3',
    title: '[DEV] Track 003',
    chapter_number: 1,
    ordering: 3,
  },

  // ── Production tracks will go here ─────────────────────────────────────
  // Example:
  // {
  //   filename: '004.mp3',
  //   title: 'Chapter 2 — Repentance',
  //   chapter_number: 2,
  //   ordering: 1,
  // },
];

export default audios;
