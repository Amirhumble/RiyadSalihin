import * as SQLite from 'expo-sqlite';

import { syncAudioContent } from './audioImporter';
import { runDevSeed } from './devSeed';
import { up as migration001 } from './migrations/001_initial';
import { up as migration002 } from './migrations/002_add_pdf_page';
import { up as migration003 } from './migrations/003_audio_chapter_range';
import { up as migration004 } from './migrations/004_audio_hadith_range';
import { SCHEMA_VERSION } from './schema';

const DB_NAME = 'riyadus_salihin.db';

const MIGRATIONS = [
  { version: 1, up: migration001 },
  { version: 2, up: migration002 },
  { version: 3, up: migration003 },
  { version: 4, up: migration004 },
];

let _db = null;

export function getDatabase() {
  if (!_db) {
    throw new Error(
      '[Database] Database is not initialized. Call initDatabase() first.'
    );
  }
  return _db;
}

// Open DB, run migrations, seed (dev), sync audio content from content/*.js
export async function initDatabase() {
  if (_db) return;

  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(_db);

  if (__DEV__) {
    await runDevSeed(_db);
  }

  // Upserts lesson metadata; never overwrites position_ms (user progress)
  await syncAudioContent(_db);
}

async function runMigrations(db) {
  const result = await db.getFirstAsync('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) {
    console.log(`[Database] Schema is up to date (version ${currentVersion}).`);
    return;
  }

  console.log(
    `[Database] Running migrations ${currentVersion} → ${SCHEMA_VERSION} …`
  );

  await db.withTransactionAsync(async () => {
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[Database] Applying migration ${migration.version} …`);
        await migration.up(db);
      }
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });

  console.log(`[Database] Migrations complete. Schema version: ${SCHEMA_VERSION}.`);
}
