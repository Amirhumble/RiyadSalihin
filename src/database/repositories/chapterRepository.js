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
