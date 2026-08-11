// Replaces audios.chapter_id with chapter_from / chapter_to.
// SQLite has limited ALTER support, so the table is recreated.
export const version = 3;
export const description = 'Replace audios.chapter_id with chapter_from / chapter_to';

export async function up(db) {
  await db.execAsync(`
    CREATE TABLE audios_new (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      filename     TEXT    NOT NULL UNIQUE,
      chapter_from INTEGER,
      chapter_to   INTEGER,
      duration_ms  INTEGER,
      position_ms  INTEGER NOT NULL DEFAULT 0,
      ordering     INTEGER NOT NULL DEFAULT 0,
      pdf_page     INTEGER
    );
  `);

  await db.execAsync(`
    INSERT INTO audios_new
      (id, title, filename, chapter_from, chapter_to,
       duration_ms, position_ms, ordering, pdf_page)
    SELECT
      a.id,
      a.title,
      a.filename,
      c.chapter_number AS chapter_from,
      c.chapter_number AS chapter_to,
      a.duration_ms,
      a.position_ms,
      a.ordering,
      a.pdf_page
    FROM audios a
    LEFT JOIN chapters c ON c.id = a.chapter_id;
  `);

  await db.execAsync('DROP TABLE audios;');
  await db.execAsync('ALTER TABLE audios_new RENAME TO audios;');

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_audios_ordering     ON audios (ordering);
    CREATE INDEX IF NOT EXISTS idx_audios_chapter_from ON audios (chapter_from);
  `);
}
