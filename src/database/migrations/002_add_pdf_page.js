// Adds audios.pdf_page — starting PDF page for each lesson.
export const version = 2;
export const description = 'Add pdf_page column to audios table';

export async function up(db) {
  await db.execAsync(`
    ALTER TABLE audios ADD COLUMN pdf_page INTEGER;
  `);
}
