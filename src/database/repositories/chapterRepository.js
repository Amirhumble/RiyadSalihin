import { getDatabase } from '../database';

/**
 * Returns all chapters ordered by their display ordering.
 * @returns {Promise<Array>}
 */
export async function getAllChapters() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM chapters ORDER BY ordering ASC, chapter_number ASC;'
  );
}

/**
 * Returns a single chapter by its primary key, or null if not found.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getChapterById(id) {
  const db = getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM chapters WHERE id = ?;',
    [id]
  );
}

/**
 * Returns the total number of chapters in the database.
 * @returns {Promise<number>}
 */
export async function getChapterCount() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM chapters;'
  );
  return row?.count ?? 0;
}

/**
 * Returns all chapters with the hadith count for each chapter.
 * @returns {Promise<Array>}  Each row has all chapter columns + hadith_count.
 */
export async function getAllChaptersWithCounts() {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT c.*,
            COUNT(h.id) AS hadith_count
       FROM chapters c
       LEFT JOIN hadiths h ON h.chapter_id = c.id
      GROUP BY c.id
      ORDER BY c.ordering ASC, c.chapter_number ASC;`
  );
}
