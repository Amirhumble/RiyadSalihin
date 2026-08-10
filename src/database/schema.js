/**
 * Schema version — increment this when adding a new migration.
 * The migration runner compares this against the version stored in
 * the user_version PRAGMA and only runs missing migrations.
 */
export const SCHEMA_VERSION = 3;

/**
 * SQL statements grouped by table so they are easy to reference
 * when debugging or writing repositories.
 */
export const TABLES = {
  CHAPTERS: 'chapters',
  HADITHS: 'hadiths',
  AUDIOS: 'audios',
  HADITH_AUDIO: 'hadith_audio',
  BOOKMARKS: 'bookmarks',
};
