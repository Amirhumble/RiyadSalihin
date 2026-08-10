/**
 * audios.js — Riyad as-Salihin audio metadata.
 *
 * SHAPE
 * ─────
 *   {
 *     filename     : string        — bare filename, e.g. '001.mp3'
 *     title        : string        — human-readable track title
 *     chapter_from : number | null — first chapter covered by this track
 *     chapter_to   : number | null — last chapter covered by this track
 *                                    (same as chapter_from for single-chapter tracks)
 *                                    Both must be null or both must be set.
 *     ordering     : number        — display order (used as track number in the UI)
 *     pdf_page     : number | null — 1-based PDF page where this track begins
 *   }
 *
 * SINGLE CHAPTER:   chapter_from: 5, chapter_to: 5   → displays "Chapter 5"
 * MULTI-CHAPTER:    chapter_from: 1, chapter_to: 4   → displays "Chapters 1–4"
 * NO CHAPTER:       chapter_from: null, chapter_to: null
 *
 * HOW TO ADD THE REAL 40–50 FILES
 * ────────────────────────────────
 * 1. Add the MP3 to assets/audio/
 * 2. Add one entry here
 * 3. Add the Metro mapping to src/services/audioAssets.js
 * 4. Run importAudioContent() once explicitly
 */

/** @type {Array<{filename:string, title:string, chapter_from:number|null, chapter_to:number|null, ordering:number, pdf_page:number|null}>} */
const audios = [
  {
    filename:     '001.mp3',
    title:        'ሙቀዲማ',
    chapter_from: 1,
    chapter_to:   1,
    ordering:     1,
    pdf_page:     7,  
  },
  {
    filename:     '002.mp3',
    title:        'ክፍል 002',
    chapter_from: 1,
    chapter_to:   1,
    ordering:     2,
    pdf_page:     1,   // PLACEHOLDER
  },
  {
    filename:     '003.mp3',
    title:        '[DEV] Track 003',
    chapter_from: 1,
    chapter_to:   1,
    ordering:     3,
    pdf_page:     1,   // PLACEHOLDER
  },

  // ── Production tracks go here ─────────────────────────────────────────────
  // Example single chapter:
  // { filename: '004.mp3', title: '...', chapter_from: 2, chapter_to: 2, ordering: 4, pdf_page: 35 },
  //
  // Example multi-chapter:
  // { filename: '005.mp3', title: '...', chapter_from: 1, chapter_to: 4, ordering: 5, pdf_page: 12 },
];

export default audios;
