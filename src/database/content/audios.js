/**
 * audios.js — Riyad as-Salihin audio metadata.
 *
 * HOW TO USE
 * ──────────
 * Each object must match this shape:
 *
 *   {
 *     filename       : string        — bare filename, e.g. '001.mp3'
 *     title          : string        — human-readable track title
 *     chapter_number : number | null — chapter this track belongs to
 *     ordering       : number        — display ordering (used as track number)
 *     pdf_page       : number | null — PDF page where this track begins
 *                                      Set to null until the real mapping
 *                                      is confirmed.
 *   }
 *
 * HOW TO MAP AUDIO → PDF PAGE
 * ───────────────────────────
 * Set pdf_page to the page number in the PDF where that audio section starts.
 * Example:
 *   { filename: '001.mp3', ..., pdf_page: 18 }
 *   { filename: '002.mp3', ..., pdf_page: 24 }
 *
 * The ReaderScreen reads audio.pdf_page and opens the PDF at that page.
 * You do NOT need to change any UI code — only update this file.
 *
 * HOW TO ADD THE REAL 40–50 FILES
 * ────────────────────────────────
 * 1. Add the MP3 to assets/audio/
 * 2. Add one entry here (with the real pdf_page when known)
 * 3. Add the Metro mapping to src/services/audioAssets.js
 * 4. Run the audioImporter (one-time, explicit call)
 *
 * CURRENT STATE
 * ─────────────
 * Three development entries. pdf_page values are test placeholders only.
 */

const audios = [
  {
    filename:       '001.mp3',
    title:          '[DEV] Track 001',
    chapter_number: 1,
    ordering:       1,
    pdf_page:       1,   // PLACEHOLDER — replace with real page number
  },
  {
    filename:       '002.mp3',
    title:          '[DEV] Track 002',
    chapter_number: 1,
    ordering:       2,
    pdf_page:       1,   // PLACEHOLDER — replace with real page number
  },
  {
    filename:       '003.mp3',
    title:          '[DEV] Track 003',
    chapter_number: 1,
    ordering:       3,
    pdf_page:       1,   // PLACEHOLDER — replace with real page number
  },

  // ── Production tracks ─────────────────────────────────────────────────
  // { filename: '004.mp3', title: '...', chapter_number: 2, ordering: 1, pdf_page: 35 },
];

export default audios;
