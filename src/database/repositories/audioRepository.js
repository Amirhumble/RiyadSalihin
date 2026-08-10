import { getDatabase } from '../database';

/**
 * Returns all audio tracks ordered for display.
 * Rows include hadith_number_from / hadith_number_to for range display.
 * @returns {Promise<Array>}
 */
export async function getAllAudiosWithChapterInfo() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM audios ORDER BY ordering ASC, id ASC;'
  );
}

/**
 * Returns all audio tracks ordered for display.
 * @returns {Promise<Array>}
 */
export async function getAllAudios() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM audios ORDER BY ordering ASC, id ASC;'
  );
}

/**
 * Returns a single audio track by its primary key.
 * Used by ReaderScreen.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAudioByIdWithChapterInfo(id) {
  const db = getDatabase();
  return db.getFirstAsync('SELECT * FROM audios WHERE id = ?;', [id]);
}

/**
 * Returns a single audio track by its primary key.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAudioById(id) {
  const db = getDatabase();
  return db.getFirstAsync('SELECT * FROM audios WHERE id = ?;', [id]);
}

/**
 * Returns all audio tracks whose hadith range overlaps with a given global
 * hadith number.  An audio overlaps if:
 *   hadith_number_from <= hadithNumber <= hadith_number_to
 * Introduction audios (0/0) are excluded from this query.
 *
 * @param {number} hadithNumber  — global hadith number
 * @returns {Promise<Array>}
 */
export async function getAudiosByHadithNumber(hadithNumber) {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT * FROM audios
      WHERE hadith_number_from <= ? AND hadith_number_to >= ?
        AND hadith_number_from > 0
      ORDER BY ordering ASC, id ASC;`,
    [hadithNumber, hadithNumber]
  );
}

/**
 * Returns the total number of audio tracks in the database.
 * @returns {Promise<number>}
 */
export async function getAudioCount() {
  const db = getDatabase();
  const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM audios;');
  return row?.count ?? 0;
}

/**
 * Persists the last-known playback position for a track.
 * @param {number} id
 * @param {number} positionMs
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
 * @param {number} id
 * @param {number} durationMs
 */
export async function saveDuration(id, durationMs) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE audios SET duration_ms = ? WHERE id = ?;',
    [durationMs, id]
  );
}
