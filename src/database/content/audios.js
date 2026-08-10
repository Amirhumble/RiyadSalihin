/**
 * audios.js — Riyad as-Salihin audio metadata.
 *
 * SHAPE
 * ─────
 *   {
 *     filename           : string        — bare filename, e.g. '001.mp3'
 *     title              : string        — human-readable track title
 *     hadith_number_from : number        — first global hadith number covered
 *                                          Use 0 for an introduction (no hadith)
 *     hadith_number_to   : number        — last global hadith number covered
 *                                          Use 0 for an introduction (no hadith)
 *     ordering           : number        — display order (used as track number in the UI)
 *     pdf_page           : number | null — 1-based PDF page where this track begins
 *   }
 *
 * HADITH NUMBERING
 * ─────────────────
 * Hadith numbers are GLOBAL across the whole book — they do NOT reset
 * per chapter.  Example:
 *   Track covers hadiths 1–15  → hadith_number_from: 1,  hadith_number_to: 15
 *   Track covers hadiths 16–32 → hadith_number_from: 16, hadith_number_to: 32
 *
 * INTRODUCTION AUDIO
 * ───────────────────
 * The first audio is an introduction (no specific hadith).
 * Use: hadith_number_from: 0, hadith_number_to: 0
 * This displays as "Introduction" in the UI.
 *
 * DISPLAY EXAMPLES
 * ─────────────────
 *   0 / 0   → "Introduction"
 *   1 / 1   → "Hadith 1"
 *   1 / 15  → "Hadiths 1–15"
 *   16 / 32 → "Hadiths 16–32"
 *
 * HOW TO ADD THE REAL 40–50 FILES
 * ────────────────────────────────
 * 1. Add the MP3 to assets/audio/
 * 2. Add one entry here with correct hadith_number_from/to and pdf_page
 * 3. Add the Metro mapping to src/services/audioAssets.js
 * 4. Run importAudioContent() once explicitly
 */

/**
 * @type {Array<{
 *   filename           : string,
 *   title              : string,
 *   hadith_number_from : number,
 *   hadith_number_to   : number,
 *   ordering           : number,
 *   pdf_page           : number | null,
 * }>}
 */
const audios = [
  {
    filename:           '001.mp3',
    title:              'ሙቀዲማ',
    hadith_number_from: 0,
    hadith_number_to:   0,
    ordering:           1,
    pdf_page:           7,
  },
  {
    filename:           '002.mp3',
    title:              'ክፍል 002',
    hadith_number_from: 1,
    hadith_number_to:   5,
    ordering:           2,
    pdf_page:           11,   // PLACEHOLDER — replace with real page
  },
  {
    filename:           '003.mp3',
    title:              'ክፍል 003',
    hadith_number_from: 6,
    hadith_number_to:   10,
    ordering:           3,
    pdf_page:           13,   // PLACEHOLDER — replace with real page
  },

  // ── Production tracks go here ─────────────────────────────────────────────
  // Introduction:
  // { filename: '004.mp3', title: 'Introduction', hadith_number_from: 0, hadith_number_to: 0, ordering: 4, pdf_page: 1 },
  //
  // Single hadith:
  // { filename: '005.mp3', title: '...', hadith_number_from: 5, hadith_number_to: 5, ordering: 5, pdf_page: 22 },
  //
  // Range:
  // { filename: '006.mp3', title: '...', hadith_number_from: 6, hadith_number_to: 20, ordering: 6, pdf_page: 30 },
];

export default audios;
