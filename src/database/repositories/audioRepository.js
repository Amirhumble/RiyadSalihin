import { getDatabase } from '../database';

/**
 * Returns all audio tracks ordered for display.
 * The returned rows include the chapter range (chapter_from, chapter_to)
 * directly from the audios table — no JOIN needed for the range itself.
 * @returns {Promise<Array>}
 */
export async function getAllAudiosWithChapterInfo() {
  const db = getDatabase();
  // chapter_from and chapter_to are already on the audios row.
  // No chapter table JOIN is required for the range display.
  return db.getAllAsync(
    `SELECT a.*
       FROM audios a
      ORDER BY a.ordering ASC, a.id ASC;`
  );
}

/**
 * Returns all audio tracks ordered for display (no extra joins).
 * @returns {Promise<Array>}
 */
export async function getAllAudios() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM audios ORDER BY ordering ASC, id ASC;'
  );
}

/**
 * Returns a single audio track by its primary key including chapter range.
 * Used by ReaderScreen.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAudioByIdWithChapterInfo(id) {
  const db = getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM audios WHERE id = ?;',
    [id]
  );
}

/**
 * Returns a single audio track by its primary key, or null if not found.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAudioById(id) {
  const db = getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM audios WHERE id = ?;',
    [id]
  );
}

/**
 * Returns all audio tracks whose chapter range overlaps with a given chapter number.
 * An audio overlaps if chapter_from <= chapterNumber <= chapter_to.
 * @param {number} chapterNumber  — the chapter_number value (not the DB id)
 * @returns {Promise<Array>}
 */
export async function getAudiosByChapterNumber(chapterNumber) {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT a.*
       FROM audios a
      WHERE a.chapter_from <= ? AND a.chapter_to >= ?
      ORDER BY a.ordering ASC, a.id ASC;`,
    [chapterNumber, chapterNumber]
  );
}

/**
 * Returns the total number of audio tracks in the database.
 * @returns {Promise<number>}
 */
export async function getAudioCount() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM audios;'
  );
  return row?.count ?? 0;
}

/**
 * Persists the last-known playback position for a track so it can be resumed.
 * @param {number} id          - audio primary key
 * @param {number} positionMs  - position in milliseconds
 * @returns {Promise<void>}
 */
export async function savePlaybackPosition(id, positionMs) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE audios SET position_ms = ? WHERE id = ?;',
    [positionMs, id]
  );
}

/**
 * Stores the duration of a track after it has been loaded by the player.
 * @param {number} id         - audio primary key
 * @param {number} durationMs - duration in milliseconds
 * @returns {Promise<void>}
 */
export async function saveDuration(id, durationMs) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE audios SET duration_ms = ? WHERE id = ?;',
    [durationMs, id]
  );
}
