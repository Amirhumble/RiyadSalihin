/**
 * audioImporter.js
 *
 * Imports audio metadata and hadith-audio relationships into the SQLite database.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Validate first, insert second.
 * 2. Idempotent — existing rows (keyed by filename) are skipped, never overwritten.
 *    position_ms (user playback progress) is always preserved.
 * 3. All-or-nothing transaction — any failure rolls back completely.
 * 4. Does not touch chapters, hadiths, or bookmarks.
 * 5. Does not perform Metro require() calls.
 * 6. Not called automatically at app startup.
 *
 * CHAPTER RANGE
 * ─────────────
 * Each audio record now stores a chapter range instead of a single chapter_id:
 *   chapter_from : number | null — first chapter number covered
 *   chapter_to   : number | null — last chapter number covered
 * Both must be null or both must be set.  chapter_from <= chapter_to.
 * Every chapter number in [chapter_from, chapter_to] must exist in the DB.
 *
 * USAGE
 * ─────
 *   import { importAudioContent } from '@/database/audioImporter';
 *   import audios     from '@/database/content/audios';
 *   import audioLinks from '@/database/content/audioLinks';
 *
 *   const result = await importAudioContent({ audios, audioLinks });
 *   // { audiosInserted: 3, audiosSkipped: 0, linksInserted: 3, linksSkipped: 0 }
 */

import { getDatabase } from './database';

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates the audio metadata array.
 * @param {Array} audios
 * @throws {Error} on first invalid record.
 */
function validateAudios(audios) {
  if (!Array.isArray(audios)) {
    throw new Error('[AudioImporter] audios must be an array.');
  }

  const seenFilenames = new Set();

  audios.forEach((a, idx) => {
    const pos = `audios[${idx}]`;

    if (a == null || typeof a !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    // filename
    if (!a.filename || typeof a.filename !== 'string' || !a.filename.trim()) {
      throw new Error(`${pos}: missing or empty "filename".`);
    }
    const fname = a.filename.trim();
    if (seenFilenames.has(fname)) {
      throw new Error(`${pos}: duplicate filename "${fname}".`);
    }
    seenFilenames.add(fname);

    // title
    if (!a.title || typeof a.title !== 'string' || !a.title.trim()) {
      throw new Error(`${pos} ("${fname}"): missing or empty "title".`);
    }

    // chapter_from / chapter_to — both null OR both set
    const hasFrom = a.chapter_from != null;
    const hasTo   = a.chapter_to   != null;
    if (hasFrom !== hasTo) {
      throw new Error(
        `${pos} ("${fname}"): "chapter_from" and "chapter_to" must both be ` +
        'provided or both be null.'
      );
    }
    if (hasFrom) {
      if (!Number.isInteger(a.chapter_from) || a.chapter_from < 1) {
        throw new Error(
          `${pos} ("${fname}"): "chapter_from" must be a positive integer, ` +
          `got ${JSON.stringify(a.chapter_from)}.`
        );
      }
      if (!Number.isInteger(a.chapter_to) || a.chapter_to < 1) {
        throw new Error(
          `${pos} ("${fname}"): "chapter_to" must be a positive integer, ` +
          `got ${JSON.stringify(a.chapter_to)}.`
        );
      }
      if (a.chapter_from > a.chapter_to) {
        throw new Error(
          `${pos} ("${fname}"): "chapter_from" (${a.chapter_from}) must not be ` +
          `greater than "chapter_to" (${a.chapter_to}).`
        );
      }
    }

    // ordering
    if (a.ordering == null) {
      throw new Error(`${pos} ("${fname}"): missing required field "ordering".`);
    }
    if (!Number.isInteger(a.ordering) || a.ordering < 0) {
      throw new Error(
        `${pos} ("${fname}"): "ordering" must be a non-negative integer.`
      );
    }
  });
}

/**
 * Validates the audio-link array (structural checks only — no DB calls).
 * @param {Array} audioLinks
 * @param {Set}   filenameSet
 * @throws {Error} on first invalid record.
 */
function validateAudioLinks(audioLinks, filenameSet) {
  if (!Array.isArray(audioLinks)) {
    throw new Error('[AudioImporter] audioLinks must be an array.');
  }

  const seenKeys = new Set();

  audioLinks.forEach((link, idx) => {
    const pos = `audioLinks[${idx}]`;

    if (link == null || typeof link !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    // filename
    if (!link.filename || typeof link.filename !== 'string' || !link.filename.trim()) {
      throw new Error(`${pos}: missing or empty "filename".`);
    }
    const fname = link.filename.trim();
    if (!filenameSet.has(fname)) {
      throw new Error(
        `${pos}: filename "${fname}" is not present in the audios array. ` +
        'Add a matching entry to audios.js first.'
      );
    }

    // chapter_number (in audioLinks this is still a single chapter reference)
    if (link.chapter_number == null) {
      throw new Error(`${pos} ("${fname}"): missing required field "chapter_number".`);
    }
    if (!Number.isInteger(link.chapter_number) || link.chapter_number < 1) {
      throw new Error(
        `${pos} ("${fname}"): "chapter_number" must be a positive integer, ` +
        `got ${JSON.stringify(link.chapter_number)}.`
      );
    }

    // hadith_number
    if (link.hadith_number == null || String(link.hadith_number).trim() === '') {
      throw new Error(
        `${pos} ("${fname}", chapter ${link.chapter_number}): ` +
        'missing or empty "hadith_number".'
      );
    }

    const key = `${fname}::${link.chapter_number}::${String(link.hadith_number).trim()}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `${pos}: duplicate link (filename "${fname}", chapter ${link.chapter_number}, ` +
        `hadith "${link.hadith_number}").`
      );
    }
    seenKeys.add(key);
  });
}

// ─── Importer ─────────────────────────────────────────────────────────────────

/**
 * Imports audio metadata and hadith-audio relationships into the database.
 *
 * @param {{ audios: Array, audioLinks: Array }} content
 * @returns {Promise<{ audiosInserted, audiosSkipped, linksInserted, linksSkipped }>}
 * @throws {Error} if validation fails or a database error occurs.
 */
export async function importAudioContent({ audios, audioLinks }) {
  // 1. Structural validation (no DB calls)
  validateAudios(audios);
  const filenameSet = new Set(audios.map((a) => a.filename.trim()));
  validateAudioLinks(audioLinks, filenameSet);

  if (audios.length === 0 && audioLinks.length === 0) {
    console.log('[AudioImporter] Nothing to import — both arrays are empty.');
    return { audiosInserted: 0, audiosSkipped: 0, linksInserted: 0, linksSkipped: 0 };
  }

  const db = getDatabase();

  let audiosInserted = 0;
  let audiosSkipped  = 0;
  let linksInserted  = 0;
  let linksSkipped   = 0;

  await db.withTransactionAsync(async () => {

    // ── A. Verify all chapter numbers referenced actually exist ──────────
    const allChapterNumbers = new Set();
    for (const a of audios) {
      if (a.chapter_from != null) {
        // Verify every chapter in the range [chapter_from, chapter_to]
        for (let n = a.chapter_from; n <= a.chapter_to; n++) {
          allChapterNumbers.add(n);
        }
      }
    }
    for (const link of audioLinks) {
      allChapterNumbers.add(link.chapter_number);
    }

    for (const chNum of allChapterNumbers) {
      const row = await db.getFirstAsync(
        'SELECT id FROM chapters WHERE chapter_number = ?;',
        [chNum]
      );
      if (!row) {
        throw new Error(
          `[AudioImporter] Chapter ${chNum} does not exist in the database. ` +
          'Import chapters first using contentImporter.js.'
        );
      }
    }

    // ── B. Resolve chapter_number → chapter_id map for audioLinks ────────
    const chapterIdMap = {};
    for (const chNum of allChapterNumbers) {
      const row = await db.getFirstAsync(
        'SELECT id FROM chapters WHERE chapter_number = ?;',
        [chNum]
      );
      chapterIdMap[chNum] = row.id;
    }

    // ── C. Resolve hadith references for audioLinks ───────────────────────
    const hadithIdMap = {};
    for (const link of audioLinks) {
      const mapKey = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      if (hadithIdMap[mapKey] !== undefined) continue;

      const chapterId = chapterIdMap[link.chapter_number];
      const row = await db.getFirstAsync(
        'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
        [chapterId, String(link.hadith_number).trim()]
      );
      if (!row) {
        throw new Error(
          `[AudioImporter] Hadith not found: chapter ${link.chapter_number}, ` +
          `hadith_number "${link.hadith_number}".`
        );
      }
      hadithIdMap[mapKey] = row.id;
    }

    // ── D. Insert audio records ───────────────────────────────────────────
    const filenameToAudioId = {};

    for (const a of audios) {
      const fname = a.filename.trim();

      const existing = await db.getFirstAsync(
        'SELECT id FROM audios WHERE filename = ?;',
        [fname]
      );
      if (existing) {
        audiosSkipped += 1;
        filenameToAudioId[fname] = existing.id;
        console.log(`[AudioImporter] Audio "${fname}" already exists — skipped.`);
        continue;
      }

      const result = await db.runAsync(
        `INSERT INTO audios
           (title, filename, chapter_from, chapter_to, ordering, pdf_page)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          a.title.trim(),
          fname,
          a.chapter_from ?? null,
          a.chapter_to   ?? null,
          a.ordering,
          a.pdf_page ?? null,
        ]
      );
      audiosInserted += 1;
      filenameToAudioId[fname] = result.lastInsertRowId;
    }

    // ── E. Insert hadith_audio links ──────────────────────────────────────
    for (const link of audioLinks) {
      const fname    = link.filename.trim();
      const audioId  = filenameToAudioId[fname];
      const mapKey   = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      const hadithId = hadithIdMap[mapKey];

      if (!audioId)  throw new Error(`[AudioImporter] Internal: no audio_id for "${fname}".`);
      if (!hadithId) throw new Error(`[AudioImporter] Internal: no hadith_id for "${mapKey}".`);

      const result = await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hadithId, audioId]
      );
      if (result.changes === 0) linksSkipped += 1;
      else                       linksInserted += 1;
    }
  });

  const summary = { audiosInserted, audiosSkipped, linksInserted, linksSkipped };
  console.log('[AudioImporter] Import complete:', summary);
  return summary;
}

/**
 * Returns true if both arrays are empty (nothing to import).
 * @param {{ audios: Array, audioLinks: Array }} content
 * @returns {boolean}
 */
export function isAudioContentEmpty({ audios, audioLinks }) {
  return (
    (!Array.isArray(audios)     || audios.length     === 0) &&
    (!Array.isArray(audioLinks) || audioLinks.length === 0)
  );
}
