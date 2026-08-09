/**
 * audioImporter.js
 *
 * Imports audio metadata and hadith-audio relationships into the SQLite database.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Validate first, insert second.
 *    All records are validated (including cross-reference checks against the
 *    live database) before any SQL insert runs.
 *
 * 2. Idempotent by filename / relationship pair.
 *    - Audio records: keyed by filename (UNIQUE in the schema).
 *      If a row with that filename already exists it is SKIPPED.
 *      Existing metadata is NEVER overwritten — this protects user-owned
 *      fields like position_ms (playback progress).
 *    - hadith_audio rows: keyed by (hadith_id, audio_id).
 *      The table uses a composite PRIMARY KEY so duplicate inserts are
 *      handled with INSERT OR IGNORE.
 *
 * 3. All-or-nothing transaction.
 *    All audio inserts and all link inserts run in a single transaction.
 *    A failure at any point rolls everything back.
 *
 * 4. Does not touch chapters, hadiths, or bookmarks.
 *    Those are managed by contentImporter.js and the application.
 *
 * 5. Does not perform Metro require() calls.
 *    Runtime asset resolution remains in audioAssets.js.
 *
 * 6. Not called automatically at app startup.
 *    Call importAudioContent() explicitly (e.g. from a management screen).
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

// ─── Validation helpers ────────────────────────────────────────────────────

/**
 * Validates the audio metadata array.
 *
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
      throw new Error(
        `${pos}: duplicate filename "${fname}". ` +
        'Each audio entry must have a unique filename.'
      );
    }
    seenFilenames.add(fname);

    // title
    if (!a.title || typeof a.title !== 'string' || !a.title.trim()) {
      throw new Error(`${pos} ("${fname}"): missing or empty "title".`);
    }

    // chapter_number — optional but must be valid when present
    if (a.chapter_number != null) {
      if (!Number.isInteger(a.chapter_number) || a.chapter_number < 1) {
        throw new Error(
          `${pos} ("${fname}"): "chapter_number" must be a positive integer or null, ` +
          `got ${JSON.stringify(a.chapter_number)}.`
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
 * Validates the audio-link array (no DB calls — just structural checks).
 * Cross-reference against the DB happens inside the transaction.
 *
 * @param {Array}  audioLinks
 * @param {Set}    filenameSet  — filenames present in the audios input array.
 * @throws {Error} on first invalid record.
 */
function validateAudioLinks(audioLinks, filenameSet) {
  if (!Array.isArray(audioLinks)) {
    throw new Error('[AudioImporter] audioLinks must be an array.');
  }

  // Track (filename, chapter_number, hadith_number) for input-level duplicates.
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

    // chapter_number
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

    // Input-level duplicate check
    const key = `${fname}::${link.chapter_number}::${String(link.hadith_number).trim()}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `${pos}: duplicate link (filename "${fname}", chapter ${link.chapter_number}, ` +
        `hadith "${link.hadith_number}"). Each audio-hadith pair must be unique.`
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
 * @returns {Promise<{
 *   audiosInserted : number,
 *   audiosSkipped  : number,
 *   linksInserted  : number,
 *   linksSkipped   : number,
 * }>}
 *
 * @throws {Error} if validation fails or a database error occurs.
 *   On database error the transaction is rolled back automatically.
 */
export async function importAudioContent({ audios, audioLinks }) {
  // ── 1. Structural validation (no DB calls) ────────────────────────────
  validateAudios(audios);

  const filenameSet = new Set(audios.map((a) => a.filename.trim()));
  validateAudioLinks(audioLinks, filenameSet);

  if (audios.length === 0 && audioLinks.length === 0) {
    console.log('[AudioImporter] Nothing to import — both arrays are empty.');
    return { audiosInserted: 0, audiosSkipped: 0, linksInserted: 0, linksSkipped: 0 };
  }

  // ── 2. Open DB ────────────────────────────────────────────────────────
  const db = getDatabase();

  let audiosInserted = 0;
  let audiosSkipped  = 0;
  let linksInserted  = 0;
  let linksSkipped   = 0;

  // ── 3. Import inside a single transaction ─────────────────────────────
  await db.withTransactionAsync(async () => {

    // ── 3a. Resolve chapter_numbers → chapter_ids ─────────────────────
    // Collect the unique chapter_numbers referenced in both audios and links.
    const neededChapterNumbers = new Set();
    for (const a of audios) {
      if (a.chapter_number != null) neededChapterNumbers.add(a.chapter_number);
    }
    for (const link of audioLinks) {
      neededChapterNumbers.add(link.chapter_number);
    }

    const chapterIdMap = {}; // { [chapter_number]: db_id }
    for (const chNum of neededChapterNumbers) {
      const row = await db.getFirstAsync(
        'SELECT id FROM chapters WHERE chapter_number = ?;',
        [chNum]
      );
      if (!row) {
        throw new Error(
          `[AudioImporter] Chapter with chapter_number ${chNum} does not exist in the database. ` +
          'Import chapters first using contentImporter.js.'
        );
      }
      chapterIdMap[chNum] = row.id;
    }

    // ── 3b. Resolve (chapter_number, hadith_number) → hadith_ids ─────
    // Only needed for links.
    const hadithIdMap = {}; // { [`${chapter_number}::${hadith_number}`]: db_id }
    for (const link of audioLinks) {
      const mapKey = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      if (hadithIdMap[mapKey] !== undefined) continue; // already resolved

      const chapterId = chapterIdMap[link.chapter_number];
      const row = await db.getFirstAsync(
        'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
        [chapterId, String(link.hadith_number).trim()]
      );
      if (!row) {
        throw new Error(
          `[AudioImporter] Hadith not found: chapter ${link.chapter_number}, ` +
          `hadith_number "${link.hadith_number}". ` +
          'Import hadith content first using contentImporter.js.'
        );
      }
      hadithIdMap[mapKey] = row.id;
    }

    // ── 3c. Insert audio records ─────────────────────────────────────
    const filenameToAudioId = {}; // { [filename]: db_id }

    for (const a of audios) {
      const fname = a.filename.trim();

      // Idempotency check — skip if filename already exists.
      const existing = await db.getFirstAsync(
        'SELECT id, position_ms FROM audios WHERE filename = ?;',
        [fname]
      );

      if (existing) {
        // Reuse existing id. Never overwrite — position_ms is user data.
        audiosSkipped += 1;
        filenameToAudioId[fname] = existing.id;
        console.log(`[AudioImporter] Audio "${fname}" already exists — skipped.`);
        continue;
      }

      // Resolve chapter_id (null is valid — track can be chapter-independent).
      const chapterId = a.chapter_number != null
        ? chapterIdMap[a.chapter_number]
        : null;

      const result = await db.runAsync(
        `INSERT INTO audios (title, filename, chapter_id, ordering, pdf_page)
         VALUES (?, ?, ?, ?, ?);`,
        [a.title.trim(), fname, chapterId ?? null, a.ordering, a.pdf_page ?? null]
      );
      audiosInserted += 1;
      filenameToAudioId[fname] = result.lastInsertRowId;
    }

    // ── 3d. Insert hadith_audio links ─────────────────────────────────
    for (const link of audioLinks) {
      const fname      = link.filename.trim();
      const audioId    = filenameToAudioId[fname];
      const mapKey     = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      const hadithId   = hadithIdMap[mapKey];

      if (!audioId) {
        // Shouldn't happen — means audios step above missed this filename.
        throw new Error(
          `[AudioImporter] Internal: no audio_id found for filename "${fname}".`
        );
      }
      if (!hadithId) {
        // Shouldn't happen — resolved above.
        throw new Error(
          `[AudioImporter] Internal: no hadith_id found for key "${mapKey}".`
        );
      }

      // INSERT OR IGNORE handles the composite PK — duplicate = skip.
      const result = await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hadithId, audioId]
      );

      // SQLite: changes = 0 means the row already existed and was ignored.
      if (result.changes === 0) {
        linksSkipped += 1;
      } else {
        linksInserted += 1;
      }
    }
  });

  const summary = { audiosInserted, audiosSkipped, linksInserted, linksSkipped };
  console.log('[AudioImporter] Import complete:', summary);
  return summary;
}

/**
 * Returns true if both arrays are empty (nothing to import).
 *
 * @param {{ audios: Array, audioLinks: Array }} content
 * @returns {boolean}
 */
export function isAudioContentEmpty({ audios, audioLinks }) {
  return (
    (!Array.isArray(audios)      || audios.length      === 0) &&
    (!Array.isArray(audioLinks)  || audioLinks.length  === 0)
  );
}
