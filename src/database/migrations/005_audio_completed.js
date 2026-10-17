// Completion is its own flag. position_ms stays the resume point, including 0
// after a lesson ends, and must not be the only record that a lesson was heard.
export const version = 5;
export const description = 'Add audios.completed and backfill lessons already heard to the end';

export async function up(db) {
  await db.execAsync(`
    ALTER TABLE audios ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
  `);
  await db.execAsync(`
    UPDATE audios
       SET completed = 1
     WHERE duration_ms > 0
       AND position_ms * 1.0 >= duration_ms * 0.98;
  `);
}
