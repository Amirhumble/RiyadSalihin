import * as SQLite from 'expo-sqlite';

import { syncAudioContent } from './audioImporter';
import { runDevSeed } from './devSeed';
import { up as migration001 } from './migrations/001_initial';
import { up as migration002 } from './migrations/002_add_pdf_page';
import { up as migration003 } from './migrations/003_audio_chapter_range';
import { up as migration004 } from './migrations/004_audio_hadith_range';
import { SCHEMA_VERSION } from './schema';

const DB_NAME = 'riyadus_salihin.db';

/**
 * Ordered list of migrations.
 * Add future migrations here: { version, up }
 */
const MIGRATIONS = [
  { version: 1, up: migration001 },
  { version: 2, up: migration002 },
  { version: 3, up: migration003 },
  { version: 4, up: migration004 },
];

/** Singleton database handle — shared across the entire app. */
let _db = null;

/**
 * Returns the open database instance.
 * Throws if initDatabase() has not been called yet.
 */
export function getDatabase() {
  if (!_db) {
    throw new Error(
      '[Database] Database is not initialized. ' +
      'Call initDatabase() before using repositories.'
    );
  }
  return _db;
}

/**
 * Opens the SQLite database, enables foreign keys, and runs any
 * pending migrations.  Safe to call on every app start — already-run
 * migrations are skipped via the user_version PRAGMA.
 *
 * @returns {Promise<void>}
 */
export async function initDatabase() {
  if (_db) {
    // Already initialized — nothing to do.
    return;
  }

  _db = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL mode improves concurrent read performance.
  await _db.execAsync('PRAGMA journal_mode = WAL;');

  // Foreign-key enforcement is off by default in SQLite.
  await _db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(_db);

  // DEV ONLY: seed empty database with sample data for development.
  // Remove this call (or the devSeed.js import) before shipping.
  if (__DEV__) {
    await runDevSeed(_db);
  }

  // Sync bundled audio metadata into SQLite on every startup.
  // Idempotent — only updates rows whose metadata has changed.
  // position_ms (user progress) is never touched.
  await syncAudioContent(_db);
}

/**
 * Closes and resets the database handle.
 * Primarily useful in tests.
 */
export async function closeDatabase() {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}

// ─── private ────────────────────────────────────────────────────────────────

/**
 * Runs every migration whose version number exceeds the current
 * user_version PRAGMA value.
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db
 */
async function runMigrations(db) {
  // user_version is an integer PRAGMA SQLite reserves for app use.
  const result = await db.getFirstAsync('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) {
    console.log(
      `[Database] Schema is up to date (version ${currentVersion}).`
    );
    return;
  }

  console.log(
    `[Database] Running migrations ${currentVersion} → ${SCHEMA_VERSION} …`
  );

  // Run inside a single transaction so a partial failure leaves the
  // database in a consistent state.
  await db.withTransactionAsync(async () => {
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[Database] Applying migration ${migration.version} …`);
        await migration.up(db);
      }
    }

    // Update the stored version after all migrations succeed.
    // PRAGMA cannot be parameterised, but version is a trusted integer.
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });

  console.log(`[Database] Migrations complete. Schema version: ${SCHEMA_VERSION}.`);
}
