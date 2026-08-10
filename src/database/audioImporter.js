/**
 * audioImporter.js
 *
 * Imports audio metadata and hadith-audio link records into SQLite.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Validate first, insert second — all checks run before any SQL write.
 * 2. Idempotent — existing audio rows (keyed by filename) are skipped;
 *    position_ms (user playback progress) is NEVER overwritten.
 * 3. All-or-nothing transaction — any failure rolls back completely.
 * 4. Does not touch chapters, hadiths, or bookmarks.
 * 5. Does not perform Metro require() calls (that is audioAssets.js).
 * 6. Not called automatically at app startup.
 *
 * HADITH RANGE
 * ────────────
 * Each audio record stores a global hadith number range:
 *   hadith_number_from : number  — first global hadith covered (0 = introduction)
 *   hadith_number_to   : number  — last  global hadith covered (0 = introduction)
 * Both must be provided (they are always integers, never null in valid data).
 * 0/0 is the special "Introduction" case — always valid.
 * For normal hadiths: 1 ≤ from ≤ to.
 * Numbers are global across the book — NOT chapter-relative.
 * The importer does NOT validate ranges against chapters.
 *
 * USAGE
 * ─────
 *   import { importAudioContent } from '@/database/audioImporter';
 *   import audios     from '@/database/content/audios';
 *   import audioLinks from '@/database/content/audioLinks';
 *   const result = await importAudioContent({ audios, audioLinks });
 *   // { audiosInserted: 3, audiosSkipped: 0, linksInserted: 3, linksSkipped: 0 }
 */

import { getDatabase } from './database';

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a single audio record's hadith range.
 * Throws with a clear message on any violation.
 *
 * Rules:
 *  - Both values must be non-negative integers.
 *  - 0/0 = Introduction — always valid.
 *  - Otherwise: from >= 1, to >= 1, from <= to.
 *  - One cannot be 0 while the other is non-zero.
 */
function validateHadithRange(from, to, pos, fname) {
  if (!Number.isInteger(from) || from < 0) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_from" must be a non-negative integer, ` +
      `got ${JSON.stringify(from)}.`
    );
  }
  if (!Number.isInteger(to) || to < 0) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_to" must be a non-negative integer, ` +
      `got ${JSON.stringify(to)}.`
    );
  }
  // Introduction case
  if (from === 0 && to === 0) return;
  // One is 0 but the other is not
  if (from === 0 || to === 0) {
    throw new Error(
      `${pos} ("${fname}"): 0 is only valid when BOTH hadith_number_from and ` +
      `hadith_number_to are 0 (Introduction). Got from=${from}, to=${to}.`
    );
  }
  // Normal range
  if (from > to) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_from" (${from}) must not be ` +
      `greater than "hadith_number_to" (${to}).`
    );
  }
}

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

    // hadith_number_from / hadith_number_to
    if (a.hadith_number_from == null) {
      throw new Error(`${pos} ("${fname}"): missing required field "hadith_number_from".`);
    }
    if (a.hadith_number_to == null) {
      throw new Error(`${pos} ("${fname}"): missing required field "hadith_number_to".`);
    }
    validateHadithRange(a.hadith_number_from, a.hadith_number_to, pos, fname);

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
 * Validates the audio-link array (structural only — no DB calls).
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
        `${pos}: filename "${fname}" is not in the audios array. ` +
        'Add a matching entry to audios.js first.'
      );
    }

    // chapter_number (audioLinks still identify hadith by chapter+number)
    if (link.chapter_number == null) {
      throw new Error(`${pos} ("${fname}"): missing "chapter_number".`);
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
        `${pos} ("${fname}", chapter ${link.chapter_number}): missing "hadith_number".`
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
 * @throws {Error} on validation failure or database error (auto-rollback).
 */
export async function importAudioContent({ audios, audioLinks }) {
  validateAudios(audios);
  const filenameSet = new Set(audios.map((a) => a.filename.trim()));
  validateAudioLinks(audioLinks, filenameSet);

  if (audios.length === 0 && audioLinks.length === 0) {
    console.log('[AudioImporter] Nothing to import — both arrays are empty.');
    return { audiosInserted: 0, audiosSkipped: 0, linksInserted: 0, linksSkipped: 0 };
  }

  const db = getDatabase();
  let audiosInserted = 0, audiosSkipped = 0, linksInserted = 0, linksSkipped = 0;

  await db.withTransactionAsync(async () => {

    // ── A. Resolve chapter/hadith references for audioLinks ──────────────
    const chapterIdMap = {};
    const hadithIdMap  = {};

    for (const link of audioLinks) {
      if (!chapterIdMap[link.chapter_number]) {
        const row = await db.getFirstAsync(
          'SELECT id FROM chapters WHERE chapter_number = ?;',
          [link.chapter_number]
        );
        if (!row) {
          throw new Error(
            `[AudioImporter] Chapter ${link.chapter_number} does not exist. ` +
            'Import chapters first.'
          );
        }
        chapterIdMap[link.chapter_number] = row.id;
      }

      const mapKey = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      if (hadithIdMap[mapKey] === undefined) {
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
    }

    // ── B. Insert audio records ───────────────────────────────────────────
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
           (title, filename, hadith_number_from, hadith_number_to, ordering, pdf_page)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          a.title.trim(),
          fname,
          a.hadith_number_from,
          a.hadith_number_to,
          a.ordering,
          a.pdf_page ?? null,
        ]
      );
      audiosInserted += 1;
      filenameToAudioId[fname] = result.lastInsertRowId;
    }

    // ── C. Insert hadith_audio links ──────────────────────────────────────
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
 */
export function isAudioContentEmpty({ audios, audioLinks }) {
  return (
    (!Array.isArray(audios)     || audios.length     === 0) &&
    (!Array.isArray(audioLinks) || audioLinks.length === 0)
  );
}
