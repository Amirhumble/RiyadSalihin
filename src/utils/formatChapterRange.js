/**
 * formatChapterRange — human-readable chapter range label.
 *
 * @param {number|null} chapterFrom
 * @param {number|null} chapterTo
 * @returns {string|null}  null if both are null (no chapter info)
 *
 * Examples:
 *   formatChapterRange(5,  5)  → "Chapter 5"
 *   formatChapterRange(1,  4)  → "Chapters 1–4"
 *   formatChapterRange(null,null) → null
 */
export function formatChapterRange(chapterFrom, chapterTo) {
  if (chapterFrom == null && chapterTo == null) return null;
  if (chapterFrom === chapterTo) return `Chapter ${chapterFrom}`;
  return `Chapters ${chapterFrom}–${chapterTo}`;
}
