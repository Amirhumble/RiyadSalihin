// Renames chapter_from/chapter_to → hadith_number_from/hadith_number_to.
// Existing rows get 0/0 (Introduction) as a safe placeholder.
// position_ms and audio ids are preserved.
export const version = 4;
export const description = 'Rename chapter_from/chapter_to to hadith_number_from/hadith_number_to';

export async function up(db) {
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

  await db.execAsync('DROP TABLE audios;');
  await db.execAsync('ALTER TABLE audios_new RENAME TO audios;');

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_audios_ordering            ON audios (ordering);
    CREATE INDEX IF NOT EXISTS idx_audios_hadith_number_from  ON audios (hadith_number_from);
  `);
}
