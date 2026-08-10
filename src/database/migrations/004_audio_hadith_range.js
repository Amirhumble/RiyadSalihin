/**
 * Migration 004 — rename chapter_from/chapter_to → hadith_number_from/hadith_number_to.
 *
 * REASON
 * ──────
 * Hadith numbering in Riyad as-Salihin is GLOBAL across the entire book —
 * it does not reset per chapter.  An audio track therefore covers a range
 * of global hadith numbers, not a range of chapter numbers.
 *
 * The special case hadith_number_from = 0, hadith_number_to = 0 represents
 * an introduction / preamble audio that does not correspond to any hadith.
 *
 * APPROACH — table recreate
 * ─────────────────────────
 * SQLite does not support RENAME COLUMN on older engine versions.
 * We create a new table, copy the data, drop the old, and rename.
 *
 * DATA MAPPING
 * ────────────
 * The column semantics change from "chapter number range" to
 * "global hadith number range".  The old chapter_from / chapter_to values
 * on the current dev data (all = 1) are replaced by the dev seed the next
 * time it runs on a fresh database.  For any existing DB that has already
 * applied migration 003, we set hadith_number_from = 0, hadith_number_to = 0
 * (introduction placeholder) so the data is not misleading.
 *
 * PRESERVED
 * ─────────
 * id, title, filename, duration_ms, position_ms (user progress!),
 * ordering, pdf_page, all hadith_audio rows (audio.id unchanged).
 */

export const version = 4;
export const description = 'Rename chapter_from/chapter_to to hadith_number_from/hadith_number_to';

/** @param {import('expo-sqlite').SQLiteDatabase} db */
export async function up(db) {
  // ── 1. Create the new audios table ────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE audios_new (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT    NOT NULL,
      filename            TEXT    NOT NULL UNIQUE,
      hadith_number_from  INTEGER,
      hadith_number_to    INTEGER,
      duration_ms         INTEGER,
      position_ms         INTEGER NOT NULL DEFAULT 0,
      ordering            INTEGER NOT NULL DEFAULT 0,
      pdf_page            INTEGER
    );
  `);

  // ── 2. Copy all existing rows ─────────────────────────────────────────────
  // Map chapter_from/chapter_to → hadith_number_from/hadith_number_to.
  // Use 0/0 as a safe placeholder for existing rows so they display as
  // "Introduction" rather than showing misleading chapter numbers as hadith numbers.
  await db.execAsync(`
    INSERT INTO audios_new
      (id, title, filename,
       hadith_number_from, hadith_number_to,
       duration_ms, position_ms, ordering, pdf_page)
    SELECT
      id, title, filename,
      0 AS hadith_number_from,
      0 AS hadith_number_to,
      duration_ms, position_ms, ordering, pdf_page
    FROM audios;
  `);

  // ── 3. Drop old table ─────────────────────────────────────────────────────
  await db.execAsync('DROP TABLE audios;');

  // ── 4. Rename new → canonical ─────────────────────────────────────────────
  await db.execAsync('ALTER TABLE audios_new RENAME TO audios;');

  // ── 5. Recreate indexes ───────────────────────────────────────────────────
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_audios_ordering            ON audios (ordering);
    CREATE INDEX IF NOT EXISTS idx_audios_hadith_number_from  ON audios (hadith_number_from);
  `);
}
