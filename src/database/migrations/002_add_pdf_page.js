/**
 * Migration 002 — add pdf_page to the audios table.
 *
 * pdf_page: the PDF page number where this audio track begins.
 * Nullable — populated via content/audios.js and the audioImporter,
 * or left null until the final page mapping is supplied.
 *
 * The reader screen reads audio.pdf_page and passes it to react-native-pdf
 * as the initial page.  This field is the single source of truth for the
 * audio → PDF position mapping.
 */

export const version = 2;
export const description = 'Add pdf_page column to audios table';

/** @param {import('expo-sqlite').SQLiteDatabase} db */
export async function up(db) {
  await db.execAsync(`
    ALTER TABLE audios ADD COLUMN pdf_page INTEGER;
  `);
}
