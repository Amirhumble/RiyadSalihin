import { getDatabase } from '../database';

/**
 * Returns all bookmarked hadiths, most recently bookmarked first.
 * Joins hadiths so callers get the full hadith row alongside bookmark metadata.
 * @returns {Promise<Array>}
 */
export async function getBookmarks() {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT b.id         AS bookmark_id,
            b.created_at,
            h.*
       FROM bookmarks b
       JOIN hadiths  h ON h.id = b.hadith_id
      ORDER BY b.created_at DESC;`
  );
}

/**
 * Returns true if the given hadith has been bookmarked.
 * @param {number} hadithId
 * @returns {Promise<boolean>}
 */
export async function isBookmarked(hadithId) {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT 1 FROM bookmarks WHERE hadith_id = ? LIMIT 1;',
    [hadithId]
  );
  return row !== null && row !== undefined;
}

/**
 * Adds a bookmark for the given hadith.
 * If the hadith is already bookmarked the call is a safe no-op (INSERT OR IGNORE).
 * @param {number} hadithId
 * @returns {Promise<void>}
 */
export async function addBookmark(hadithId) {
  const db = getDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO bookmarks (hadith_id) VALUES (?);',
    [hadithId]
  );
}

/**
 * Removes the bookmark for the given hadith.
 * Safe to call even if the hadith is not bookmarked.
 * @param {number} hadithId
 * @returns {Promise<void>}
 */
export async function removeBookmark(hadithId) {
  const db = getDatabase();
  await db.runAsync(
    'DELETE FROM bookmarks WHERE hadith_id = ?;',
    [hadithId]
  );
}

/**
 * Returns the total number of bookmarks.
 * @returns {Promise<number>}
 */
export async function getBookmarkCount() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM bookmarks;'
  );
  return row?.count ?? 0;
}
