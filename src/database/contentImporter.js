/**
 * contentImporter.js
 *
 * Imports chapter and hadith content into the SQLite database.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Validate first, insert second.
 *    All records are validated before any SQL runs.  A validation
 *    failure throws before the transaction opens.
 *
 * 2. Idempotent by chapter_number.
 *    If a chapter with the same chapter_number already exists it is
 *    SKIPPED (not overwritten).  Production content is never silently
 *    replaced.  Hadiths are skipped if the (chapter_id, hadith_number)
 *    pair already exists.
 *
 * 3. All-or-nothing transaction.
 *    Chapter and hadith inserts run inside a single transaction.
 *    If anything throws mid-way, SQLite rolls back and the database
 *    is left in its pre-import state.
 *
 * 4. Does not touch bookmarks, audios, or hadith_audio.
 *    Those are managed separately (by devSeed, AudioService, etc.).
 *    Foreign-key CASCADE rules ensure existing bookmarks survive as long
 *    as the hadiths they reference are not deleted.
 *
 * 5. Not called automatically at app startup.
 *    Call importContent() explicitly from a management screen or a
 *    one-off script.  It is never wired into initDatabase().
 *
 * USAGE
 * ─────
 *   import { importContent } from '@/database/contentImporter';
 *   import chapters from '@/database/content/chapters';
 *   import hadiths  from '@/database/content/hadiths';
 *
 *   const result = await importContent({ chapters, hadiths });
 *   console.log(result);
 *   // { chaptersInserted: 4, chaptersSkipped: 0, hadithsInserted: 200, hadithsSkipped: 0 }
 */

import { getDatabase } from './database';

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validates an array of chapter records.
 *
 * @param {Array} chapters
 * @throws {Error} with a descriptive message on the first invalid record.
 */
function validateChapters(chapters) {
  if (!Array.isArray(chapters)) {
    throw new Error('[ContentImporter] chapters must be an array.');
  }

  const seenNumbers = new Set();

  chapters.forEach((ch, idx) => {
    const pos = `chapters[${idx}]`;

    if (ch == null || typeof ch !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    // chapter_number
    if (ch.chapter_number == null) {
      throw new Error(`${pos}: missing required field "chapter_number".`);
    }
    if (!Number.isInteger(ch.chapter_number) || ch.chapter_number < 1) {
      throw new Error(
        `${pos}: "chapter_number" must be a positive integer, got ${JSON.stringify(ch.chapter_number)}.`
      );
    }
    if (seenNumbers.has(ch.chapter_number)) {
      throw new Error(
        `${pos}: duplicate "chapter_number" ${ch.chapter_number}. Each chapter must have a unique number.`
      );
    }
    seenNumbers.add(ch.chapter_number);

    // arabic_title
    if (!ch.arabic_title || typeof ch.arabic_title !== 'string' || !ch.arabic_title.trim()) {
      throw new Error(`${pos} (chapter ${ch.chapter_number}): missing or empty "arabic_title".`);
    }

    // english_title
    if (!ch.english_title || typeof ch.english_title !== 'string' || !ch.english_title.trim()) {
      throw new Error(`${pos} (chapter ${ch.chapter_number}): missing or empty "english_title".`);
    }

    // ordering
    if (ch.ordering == null) {
      throw new Error(`${pos} (chapter ${ch.chapter_number}): missing required field "ordering".`);
    }
    if (!Number.isInteger(ch.ordering) || ch.ordering < 0) {
      throw new Error(
        `${pos} (chapter ${ch.chapter_number}): "ordering" must be a non-negative integer.`
      );
    }
  });
}

/**
 * Validates an array of hadith records.
 * chapterNumbers is the Set of chapter_numbers present in the chapters array,
 * used to detect hadiths referencing chapters that don't exist in the dataset.
 *
 * @param {Array}  hadiths
 * @param {Set}    chapterNumbers
 * @throws {Error} with a descriptive message on the first invalid record.
 */
function validateHadiths(hadiths, chapterNumbers) {
  if (!Array.isArray(hadiths)) {
    throw new Error('[ContentImporter] hadiths must be an array.');
  }

  // Track (chapter_number, hadith_number) pairs for duplicate detection.
  const seenKeys = new Set();

  hadiths.forEach((h, idx) => {
    const pos = `hadiths[${idx}]`;

    if (h == null || typeof h !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    // chapter_number reference
    if (h.chapter_number == null) {
      throw new Error(`${pos}: missing required field "chapter_number".`);
    }
    if (!Number.isInteger(h.chapter_number) || h.chapter_number < 1) {
      throw new Error(
        `${pos}: "chapter_number" must be a positive integer, got ${JSON.stringify(h.chapter_number)}.`
      );
    }
    if (!chapterNumbers.has(h.chapter_number)) {
      throw new Error(
        `${pos}: references chapter_number ${h.chapter_number} which does not exist in the chapters array.`
      );
    }

    // hadith_number
    if (h.hadith_number == null || String(h.hadith_number).trim() === '') {
      throw new Error(
        `${pos} (chapter ${h.chapter_number}): missing or empty "hadith_number".`
      );
    }

    // Duplicate key
    const key = `${h.chapter_number}::${String(h.hadith_number).trim()}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `${pos}: duplicate hadith (chapter ${h.chapter_number}, number "${h.hadith_number}"). ` +
        'Each hadith must have a unique (chapter_number, hadith_number) combination.'
      );
    }
    seenKeys.add(key);

    // arabic_text
    if (!h.arabic_text || typeof h.arabic_text !== 'string' || !h.arabic_text.trim()) {
      throw new Error(
        `${pos} (chapter ${h.chapter_number}, hadith ${h.hadith_number}): missing or empty "arabic_text".`
      );
    }

    // english_text
    if (!h.english_text || typeof h.english_text !== 'string' || !h.english_text.trim()) {
      throw new Error(
        `${pos} (chapter ${h.chapter_number}, hadith ${h.hadith_number}): missing or empty "english_text".`
      );
    }

    // ordering
    if (h.ordering == null) {
      throw new Error(
        `${pos} (chapter ${h.chapter_number}, hadith ${h.hadith_number}): missing required field "ordering".`
      );
    }
    if (!Number.isInteger(h.ordering) || h.ordering < 0) {
      throw new Error(
        `${pos} (chapter ${h.chapter_number}, hadith ${h.hadith_number}): ` +
        '"ordering" must be a non-negative integer.'
      );
    }
  });
}

// ─── Importer ─────────────────────────────────────────────────────────────────

/**
 * Imports chapters and hadiths into the database.
 *
 * @param {{ chapters: Array, hadiths: Array }} content
 * @returns {Promise<{
 *   chaptersInserted : number,
 *   chaptersSkipped  : number,
 *   hadithsInserted  : number,
 *   hadithsSkipped   : number,
 * }>}
 *
 * @throws {Error} if validation fails or a database error occurs.
 *   On database error the transaction is rolled back automatically.
 */
export async function importContent({ chapters, hadiths }) {
  // ── 1. Validate ──────────────────────────────────────────────────────
  validateChapters(chapters);

  const chapterNumberSet = new Set(chapters.map((c) => c.chapter_number));
  validateHadiths(hadiths, chapterNumberSet);

  if (chapters.length === 0 && hadiths.length === 0) {
    console.log('[ContentImporter] Nothing to import — both arrays are empty.');
    return { chaptersInserted: 0, chaptersSkipped: 0, hadithsInserted: 0, hadithsSkipped: 0 };
  }

  // ── 2. Open DB ────────────────────────────────────────────────────────
  const db = getDatabase();

  let chaptersInserted = 0;
  let chaptersSkipped  = 0;
  let hadithsInserted  = 0;
  let hadithsSkipped   = 0;

  // ── 3. Import inside a single transaction ─────────────────────────────
  await db.withTransactionAsync(async () => {

    // ── 3a. Chapters ─────────────────────────────────────────────────
    // Build a chapter_number → db id map for hadith insertion.
    const chapterIdMap = {}; // { [chapter_number]: db_id }

    for (const ch of chapters) {
      // Check if this chapter_number already exists.
      const existing = await db.getFirstAsync(
        'SELECT id FROM chapters WHERE chapter_number = ?;',
        [ch.chapter_number]
      );

      if (existing) {
        // Skip — do not overwrite production content.
        chaptersSkipped += 1;
        chapterIdMap[ch.chapter_number] = existing.id;
        console.log(
          `[ContentImporter] Chapter ${ch.chapter_number} already exists — skipped.`
        );
        continue;
      }

      const result = await db.runAsync(
        `INSERT INTO chapters (chapter_number, arabic_title, english_title, ordering)
         VALUES (?, ?, ?, ?);`,
        [
          ch.chapter_number,
          ch.arabic_title.trim(),
          ch.english_title.trim(),
          ch.ordering,
        ]
      );
      chaptersInserted += 1;
      chapterIdMap[ch.chapter_number] = result.lastInsertRowId;
    }

    // ── 3b. Hadiths ──────────────────────────────────────────────────
    for (const h of hadiths) {
      const chapterId = chapterIdMap[h.chapter_number];

      if (!chapterId) {
        // This can only happen if a chapter was skipped AND the hadith
        // references that chapter.  In that case we need the existing id.
        const row = await db.getFirstAsync(
          'SELECT id FROM chapters WHERE chapter_number = ?;',
          [h.chapter_number]
        );
        if (!row) {
          throw new Error(
            `[ContentImporter] Cannot find chapter id for chapter_number ${h.chapter_number}. ` +
            'This is unexpected — please check your data.'
          );
        }
        chapterIdMap[h.chapter_number] = row.id;
      }

      const finalChapterId = chapterIdMap[h.chapter_number];
      const hadithNum = String(h.hadith_number).trim();

      // Check for existing (chapter_id, hadith_number) pair.
      const existing = await db.getFirstAsync(
        'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
        [finalChapterId, hadithNum]
      );

      if (existing) {
        hadithsSkipped += 1;
        continue;
      }

      await db.runAsync(
        `INSERT INTO hadiths (chapter_id, hadith_number, arabic_text, english_text, ordering)
         VALUES (?, ?, ?, ?, ?);`,
        [
          finalChapterId,
          hadithNum,
          h.arabic_text.trim(),
          h.english_text.trim(),
          h.ordering,
        ]
      );
      hadithsInserted += 1;
    }
  });

  const summary = { chaptersInserted, chaptersSkipped, hadithsInserted, hadithsSkipped };
  console.log('[ContentImporter] Import complete:', summary);
  return summary;
}

/**
 * Returns true if the content arrays are both empty.
 * Useful to skip calling importContent() at all.
 *
 * @param {{ chapters: Array, hadiths: Array }} content
 * @returns {boolean}
 */
export function isContentEmpty({ chapters, hadiths }) {
  return (
    (!Array.isArray(chapters) || chapters.length === 0) &&
    (!Array.isArray(hadiths)  || hadiths.length  === 0)
  );
}
