// Match a typed hadith number to a lesson already loaded via getAllAudios().
// A lesson matches when hadith_number_from <= n <= hadith_number_to.
// Overlapping ranges resolve to the first lesson in list order.

export function parseHadithNumber(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: 'invalid' };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, value };
}

export function findLessonByHadithNumber(audios, hadithNumber) {
  if (!Array.isArray(audios) || !Number.isInteger(hadithNumber) || hadithNumber <= 0) {
    return null;
  }
  for (const audio of audios) {
    const from = Number(audio?.hadith_number_from);
    const to = Number(audio?.hadith_number_to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (from <= hadithNumber && hadithNumber <= to) return audio;
  }
  return null;
}
