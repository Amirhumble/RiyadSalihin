import { createSerializedProgressStore } from '@/services/lessonProgress';

import { getDatabase } from '../database';

const progressStore = createSerializedProgressStore({
  async savePosition(id, positionMs) {
    const db = getDatabase();
    await db.runAsync(
      'UPDATE audios SET position_ms = ? WHERE id = ?;',
      [positionMs, id]
    );
  },
  async markCompleted(id, positionMs) {
    const db = getDatabase();
    if (positionMs == null) {
      await db.runAsync('UPDATE audios SET completed = 1 WHERE id = ?;', [id]);
      return;
    }
    await db.runAsync(
      'UPDATE audios SET completed = 1, position_ms = ? WHERE id = ?;',
      [positionMs, id]
    );
  },
  async saveDuration(id, durationMs) {
    const db = getDatabase();
    await db.runAsync(
      'UPDATE audios SET duration_ms = ? WHERE id = ?;',
      [durationMs, id]
    );
  },
});

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

export function savePlaybackPosition(id, positionMs) {
  return progressStore.savePosition(id, positionMs);
}

export function markAudioCompleted(id, positionMs = null) {
  return progressStore.markCompleted(id, positionMs);
}

export function saveDuration(id, durationMs) {
  return progressStore.saveDuration(id, durationMs);
}
