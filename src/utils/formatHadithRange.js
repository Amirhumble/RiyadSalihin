/**
 * formatHadithRange — human-readable hadith range label.
 *
 * Hadith numbering in Riyad as-Salihin is GLOBAL across the whole book.
 * 0/0 is the special "Introduction" case.
 *
 * @param {number|null} from
 * @param {number|null} to
 * @returns {string|null}  null when both are null (no range info)
 *
 * Examples:
 *   formatHadithRange(0,   0)   → "Introduction"
 *   formatHadithRange(1,   1)   → "Hadith 1"
 *   formatHadithRange(1,  15)   → "Hadiths 1–15"
 *   formatHadithRange(100, 125) → "Hadiths 100–125"
 *   formatHadithRange(null, null) → null
 */
export function formatHadithRange(from, to) {
  if (from == null && to == null) return null;
  // Introduction
  if (from === 0 && to === 0) return 'Introduction';
  // Single hadith
  if (from === to) return `Hadith ${from}`;
  // Range
  return `Hadiths ${from}–${to}`;
}
