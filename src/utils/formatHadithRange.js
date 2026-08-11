// 0/0 = introduction; same numbers = one hadith; otherwise a range.
export function formatHadithRange(from, to) {
  if (from == null && to == null) return null;
  if (from === 0 && to === 0) return 'Introduction';
  if (from === to) return `Hadith ${from}`;
  return `Hadiths ${from}–${to}`;
}
