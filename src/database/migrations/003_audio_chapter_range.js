/**
 * Migration 003 — replace audios.chapter_id with chapter_from / chapter_to.
 *
 * WHY A TABLE RECREATE?
 * ─────────────────────
 * SQLite does not support DROP COLUMN or RENAME COLUMN on older engines.
 * The standard safe approach is:
 *   1. Create a new table with the desired schema.
 *   2. Copy all existing rows, mapping old → new columns.
 *   3. Drop the old table.
 *   4. Rename the new table.
 *   5. Recreate any indexes.
 *
 * DATA PRESERVATION
 * ─────────────────
 * For any existing row that has chapter_id = N:
 *   chapter_from = N
 *   chapter_to   = N
 * (i.e. a single-chapter audio is represented as a range where from == to)
 *
 * All other columns (id, title, filename, duration_ms, position_ms,
 * ordering, pdf_page) are copied verbatim.  position_ms (user playback
 * progress) is fully preserved.
 *
 * hadith_audio rows are untouched — they reference audio.id which does
 * not change.
 */

export const version = 3;
export const description = 'Replace audios.chapter_id with chapter_from / chapter_to';

/** @param {import('expo-sqlite').SQLiteDatabase} db */
export async function up(db) {
  // ── 1. Create the new audios table ──────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE audios_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      filename    TEXT    NOT NULL UNIQUE,
      chapter_from INTEGER,
      chapter_to   INTEGER,
      duration_ms INTEGER,
      position_ms INTEGER NOT NULL DEFAULT 0,
      ordering    INTEGER NOT NULL DEFAULT 0,
      pdf_page    INTEGER
    );
  `);

  // ── 2. Copy all existing rows ────────────────────────────────────────────
  // chapter_id is looked up in the chapters table to obtain chapter_number.
  // For rows where chapter_id IS NULL, both chapter_from and chapter_to stay NULL.
  await db.execAsync(`
    INSERT INTO audios_new
      (id, title, filename, chapter_from, chapter_to,
       duration_ms, position_ms, ordering, pdf_page)
    SELECT
      a.id,
      a.title,
      a.filename,
      c.chapter_number  AS chapter_from,
      c.chapter_number  AS chapter_to,
      a.duration_ms,
      a.position_ms,
      a.ordering,
      a.pdf_page
    FROM audios a
    LEFT JOIN chapters c ON c.id = a.chapter_id;
  `);

  // ── 3. Drop the old table ────────────────────────────────────────────────
  await db.execAsync('DROP TABLE audios;');

  // ── 4. Rename new → canonical ─────────────────────────────────────────────
  await db.execAsync('ALTER TABLE audios_new RENAME TO audios;');

  // ── 5. Recreate indexes ───────────────────────────────────────────────────
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_audios_ordering     ON audios (ordering);
    CREATE INDEX IF NOT EXISTS idx_audios_chapter_from ON audios (chapter_from);
  `);
}
