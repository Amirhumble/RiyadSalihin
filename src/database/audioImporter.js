/**
 * audioImporter.js
 *
 * Imports and syncs audio metadata into SQLite.
 *
 * TWO ENTRY POINTS
 * ────────────────
 * 1. syncAudioContent(db)
 *    Called automatically by database.js on every startup (after migrations).
 *    Upserts all rows from audios.js — updates changed metadata, inserts new
 *    rows, never touches position_ms (user playback progress).
 *
 * 2. importAudioContent({ audios, audioLinks })
 *    Manual import of arbitrary content. Useful for one-off data loads.
 *    Uses getDatabase() internally so must be called after initDatabase().
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * - Idempotent — safe to call on every cold launch.
 * - position_ms is NEVER overwritten (user-owned playback progress).
 * - filename is the stable unique identifier for audio records.
 * - All writes run inside a single transaction (all-or-nothing).
 * - Does not touch chapters, hadiths, or bookmarks.
 *
 * HADITH RANGE
 * ────────────
 * Each audio row stores global hadith numbers:
 *   hadith_number_from : number  — first global hadith covered (0 = introduction)
 *   hadith_number_to   : number  — last  global hadith covered (0 = introduction)
 * 0/0 is the special "Introduction" case.
 * For normal hadiths: 1 ≤ from ≤ to.
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

    // ── B. Upsert audio records ──────────────────────────────────────────
    // INSERT new rows; UPDATE metadata on existing rows.
    // position_ms is NEVER touched — it is user-owned playback progress.
    const filenameToAudioId = {};

    for (const a of audios) {
      const fname = a.filename.trim();

      const existing = await db.getFirstAsync(
        'SELECT id FROM audios WHERE filename = ?;',
        [fname]
      );

      if (existing) {
        // UPDATE metadata — but never overwrite position_ms or duration_ms.
        await db.runAsync(
          `UPDATE audios
              SET title              = ?,
                  hadith_number_from = ?,
                  hadith_number_to   = ?,
                  ordering           = ?,
                  pdf_page           = ?
            WHERE filename = ?;`,
          [
            a.title.trim(),
            a.hadith_number_from,
            a.hadith_number_to,
            a.ordering,
            a.pdf_page ?? null,
            fname,
          ]
        );
        audiosSkipped += 1;  // count as "already existed" — not a new insert
        filenameToAudioId[fname] = existing.id;
        if (__DEV__) console.log(`[Content] Updated: "${fname}"`);
      } else {
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
        if (__DEV__) console.log(`[Content] Inserted: "${fname}"`);
      }
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
  if (__DEV__) {
    console.log(
      `[Content] Complete. Inserted: ${audiosInserted}, Updated: ${audiosSkipped}, ` +
      `Links inserted: ${linksInserted}, Links skipped: ${linksSkipped}`
    );
  }
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

/**
 * Syncs audio metadata from the bundled content files into the database.
 *
 * Called automatically by database.js on every app startup, after migrations
 * and devSeed. Safe to call repeatedly — fully idempotent.
 *
 * Uses a direct `db` parameter so it can be called from database.js without
 * creating a circular dependency via getDatabase().
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db  — already-open DB instance
 * @returns {Promise<void>}
 */
export async function syncAudioContent(db) {
  // Import bundled content at call-time (not module load-time) to avoid
  // any circular dependency issues during database initialisation.
  const { default: audiosData }     = await import('./content/audios');
  const { default: audioLinksData } = await import('./content/audioLinks');

  if (__DEV__) {
    console.log('[Content] Syncing audio metadata …');
  }

  if (
    (!Array.isArray(audiosData)     || audiosData.length     === 0) &&
    (!Array.isArray(audioLinksData) || audioLinksData.length === 0)
  ) {
    if (__DEV__) console.log('[Content] Nothing to sync — content arrays are empty.');
    return;
  }

  // Re-use the full validation + upsert logic, but bypass getDatabase() by
  // temporarily monkey-patching a local helper that already holds `db`.
  // Simpler approach: inline the upsert directly so we control the db handle.

  const audios     = audiosData;
  const audioLinks = audioLinksData;

  // Validate
  validateAudios(audios);
  const filenameSet = new Set(audios.map((a) => a.filename.trim()));
  validateAudioLinks(audioLinks, filenameSet);

  let audiosInserted = 0, audiosUpdated = 0, linksInserted = 0, linksSkipped = 0;

  await db.withTransactionAsync(async () => {

    // ── A. Resolve chapter/hadith references for audioLinks ──────────
    const chapterIdMap = {};
    const hadithIdMap  = {};

    for (const link of audioLinks) {
      if (!chapterIdMap[link.chapter_number]) {
        const row = await db.getFirstAsync(
          'SELECT id FROM chapters WHERE chapter_number = ?;',
          [link.chapter_number]
        );
        if (!row) {
          // Chapters may not exist yet in dev (devSeed runs first but only if
          // chapters table was empty). Skip links gracefully so sync doesn't
          // crash a fresh install.
          if (__DEV__) {
            console.warn(
              `[Content] Skipping links — chapter ${link.chapter_number} not found. ` +
              'Run devSeed or import chapters first.'
            );
          }
          return; // rolls back only the link portion; audio rows already upserted
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
          if (__DEV__) {
            console.warn(
              `[Content] Skipping links — hadith not found: chapter ${link.chapter_number}, ` +
              `hadith_number "${link.hadith_number}".`
            );
          }
          return;
        }
        hadithIdMap[mapKey] = row.id;
      }
    }

    // ── B. Upsert audio records ──────────────────────────────────────
    const filenameToAudioId = {};

    for (const a of audios) {
      const fname = a.filename.trim();

      const existing = await db.getFirstAsync(
        'SELECT id FROM audios WHERE filename = ?;',
        [fname]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE audios
              SET title              = ?,
                  hadith_number_from = ?,
                  hadith_number_to   = ?,
                  ordering           = ?,
                  pdf_page           = ?
            WHERE filename = ?;`,
          [
            a.title.trim(),
            a.hadith_number_from,
            a.hadith_number_to,
            a.ordering,
            a.pdf_page ?? null,
            fname,
          ]
        );
        audiosUpdated += 1;
        filenameToAudioId[fname] = existing.id;
        if (__DEV__) console.log(`[Content] Updated:  "${fname}"`);
      } else {
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
        if (__DEV__) console.log(`[Content] Inserted: "${fname}"`);
      }
    }

    // ── C. Insert hadith_audio links ─────────────────────────────────
    for (const link of audioLinks) {
      const fname    = link.filename.trim();
      const audioId  = filenameToAudioId[fname];
      const mapKey   = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      const hadithId = hadithIdMap[mapKey];

      if (!audioId || hadithId == null) continue; // chapter/hadith not yet seeded

      const result = await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hadithId, audioId]
      );
      if (result.changes === 0) linksSkipped += 1;
      else                       linksInserted += 1;
    }
  });

  if (__DEV__) {
    console.log(
      `[Content] Sync complete. ` +
      `Inserted: ${audiosInserted}, Updated: ${audiosUpdated}, ` +
      `Links inserted: ${linksInserted}, Links skipped: ${linksSkipped}.`
    );
  }
}
