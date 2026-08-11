import { getDatabase } from '../database';

export async function getAllAudios() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM audios ORDER BY ordering ASC, id ASC;'
  );
}

export async function getAudioById(id) {
  const db = getDatabase();
  return db.getFirstAsync('SELECT * FROM audios WHERE id = ?;', [id]);
}

export async function savePlaybackPosition(id, positionMs) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE audios SET position_ms = ? WHERE id = ?;',
    [positionMs, id]
  );
}

export async function saveDuration(id, durationMs) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE audios SET duration_ms = ? WHERE id = ?;',
    [durationMs, id]
  );
}
