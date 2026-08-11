// Creates chapters, hadiths, audios, hadith_audio, bookmarks.
export const version = 1;
export const description = 'Initial schema: chapters, hadiths, audios, bookmarks';

export async function up(db) {
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
