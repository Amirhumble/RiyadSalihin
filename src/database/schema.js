/**
 * Schema version — increment this when adding a new migration file.
 * The migration runner compares this against the SQLite user_version PRAGMA
 * and only applies missing migrations.
 */
export const SCHEMA_VERSION = 4;

/** Table name constants — avoids magic strings in repository queries. */
export const TABLES = {
  AUDIOS:       'audios',
  HADITH_AUDIO: 'hadith_audio',
  // Historical tables created by migration 001. Still present in the DB
  // schema for data-safety; not actively used by the current 3-screen app.
  CHAPTERS:     'chapters',
  HADITHS:      'hadiths',
  BOOKMARKS:    'bookmarks',
};
