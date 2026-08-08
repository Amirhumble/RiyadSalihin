import { getDatabase } from '../database';

/**
 * Returns all hadiths ordered by chapter then display ordering.
 * @returns {Promise<Array>}
 */
export async function getAllHadiths() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM hadiths ORDER BY ordering ASC, id ASC;'
  );
}

/**
 * Returns a single hadith by its primary key, or null if not found.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getHadithById(id) {
  const db = getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM hadiths WHERE id = ?;',
    [id]
  );
}

/**
 * Returns all hadiths belonging to a given chapter, ordered for display.
 * @param {number} chapterId
 * @returns {Promise<Array>}
 */
export async function getHadithsByChapter(chapterId) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM hadiths WHERE chapter_id = ? ORDER BY ordering ASC, id ASC;',
    [chapterId]
  );
}

/**
 * Returns the total number of hadiths in the database.
 * @returns {Promise<number>}
 */
export async function getHadithCount() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM hadiths;'
  );
  return row?.count ?? 0;
}

/**
 * Returns all audio files linked to a given hadith via hadith_audio.
 * @param {number} hadithId
 * @returns {Promise<Array>}
 */
export async function getAudiosForHadith(hadithId) {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT a.*
       FROM audios a
       JOIN hadith_audio ha ON ha.audio_id = a.id
      WHERE ha.hadith_id = ?
      ORDER BY a.ordering ASC;`,
    [hadithId]
  );
}

/**
 * Returns the previous and next hadith within the same chapter
 * relative to the given hadith, based on ordering + id.
 * Either value may be null if there is no adjacent record.
 *
 * @param {number} hadithId
 * @returns {Promise<{prev: Object|null, next: Object|null}>}
 */
export async function getAdjacentHadiths(hadithId) {
  const db = getDatabase();

  const current = await db.getFirstAsync(
    'SELECT id, chapter_id, ordering FROM hadiths WHERE id = ?;',
    [hadithId]
  );
  if (!current) return { prev: null, next: null };

  const prev = await db.getFirstAsync(
    `SELECT * FROM hadiths
      WHERE chapter_id = ?
        AND (ordering < ? OR (ordering = ? AND id < ?))
      ORDER BY ordering DESC, id DESC
      LIMIT 1;`,
    [current.chapter_id, current.ordering, current.ordering, current.id]
  );

  const next = await db.getFirstAsync(
    `SELECT * FROM hadiths
      WHERE chapter_id = ?
        AND (ordering > ? OR (ordering = ? AND id > ?))
      ORDER BY ordering ASC, id ASC
      LIMIT 1;`,
    [current.chapter_id, current.ordering, current.ordering, current.id]
  );

  return { prev: prev ?? null, next: next ?? null };
}
