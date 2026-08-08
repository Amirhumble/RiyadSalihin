/**
 * Migration 001 – initial schema
 *
 * Relationship model:
 *   Chapter (1) ──< Hadith (many)
 *   Audio   (1) ──< hadith_audio (many) >── Hadith
 *
 * One audio file can cover multiple hadiths (e.g. a short chapter recited
 * as a single track).  hadith_audio is the join table.
 *
 * The audios table stores only the local filename / asset identifier so the
 * app never embeds absolute paths.  Playback position and duration are
 * nullable so they can be populated lazily at runtime.
 */

export const version = 1;
export const description = 'Initial schema: chapters, hadiths, audios, bookmarks';

/** @param {import('expo-sqlite').SQLiteDatabase} db */
export async function up(db) {
  // ── chapters ────────────────────────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chapters (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_number  INTEGER NOT NULL UNIQUE,
      arabic_title    TEXT    NOT NULL,
      english_title   TEXT    NOT NULL,
      ordering        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_chapters_ordering ON chapters (ordering);
  `);

  // ── hadiths ─────────────────────────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS hadiths (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id      INTEGER NOT NULL,
      hadith_number   TEXT    NOT NULL,
      arabic_text     TEXT    NOT NULL,
      english_text    TEXT    NOT NULL,
      ordering        INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hadiths_chapter_id ON hadiths (chapter_id);
    CREATE INDEX IF NOT EXISTS idx_hadiths_ordering    ON hadiths (ordering);
  `);

  // ── audios ───────────────────────────────────────────────────────────────
  // filename: the bare filename stored in assets/audio/ (e.g. "001.mp3").
  //           Never store absolute paths — the app reconstructs the full
  //           URI at runtime using Asset.fromModule() or a known prefix.
  // duration_ms: nullable; populated when the player loads the file.
  // position_ms: last-known playback position for resume support.
  // chapter_id: optional — lets you query all tracks for a chapter without
  //             going through hadith_audio when a whole chapter is one track.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS audios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      filename    TEXT    NOT NULL UNIQUE,
      chapter_id  INTEGER,
      duration_ms INTEGER,
      position_ms INTEGER NOT NULL DEFAULT 0,
      ordering    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audios_chapter_id ON audios (chapter_id);
    CREATE INDEX IF NOT EXISTS idx_audios_ordering    ON audios (ordering);
  `);

  // ── hadith_audio (join table) ─────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS hadith_audio (
      hadith_id  INTEGER NOT NULL,
      audio_id   INTEGER NOT NULL,
      PRIMARY KEY (hadith_id, audio_id),
      FOREIGN KEY (hadith_id) REFERENCES hadiths (id) ON DELETE CASCADE,
      FOREIGN KEY (audio_id)  REFERENCES audios  (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hadith_audio_audio_id ON hadith_audio (audio_id);
  `);

  // ── bookmarks ────────────────────────────────────────────────────────────
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      hadith_id  INTEGER NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (hadith_id) REFERENCES hadiths (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_hadith_id  ON bookmarks (hadith_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks (created_at);
  `);
}
