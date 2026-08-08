import { getDatabase } from '../database';

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
 * Returns all audio tracks for a given chapter.
 * Matches both via the direct chapter_id column on audios AND via hadiths
 * that belong to the chapter (through hadith_audio), returning a deduplicated
 * result set.
 *
 * @param {number} chapterId
 * @returns {Promise<Array>}
 */
export async function getAudiosByChapter(chapterId) {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT DISTINCT a.*
       FROM audios a
      WHERE a.chapter_id = ?
      UNION
     SELECT DISTINCT a.*
       FROM audios a
       JOIN hadith_audio ha ON ha.audio_id = a.id
       JOIN hadiths       h  ON h.id = ha.hadith_id
      WHERE h.chapter_id = ?
      ORDER BY ordering ASC, id ASC;`,
    [chapterId, chapterId]
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
