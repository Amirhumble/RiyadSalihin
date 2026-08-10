/**
 * DEV SEED — development only.
 *
 * Inserts a minimal set of clearly-labelled sample records so screens
 * have something to render during development.  Remove the call in
 * database.js (and this import) before shipping to production.
 *
 * Rules:
 *  - Only runs when the database is completely empty (no chapters).
 *  - Does NOT invent authentic hadith text.
 *  - 2 sample chapters, 4 sample hadiths, 3 dev audio tracks.
 *  - Audio tracks are linked through hadith_audio.
 *
 * DEPENDENCY DIRECTION
 * ────────────────────
 * database.js → devSeed.js (correct — one-way)
 *
 * devSeed.js intentionally does NOT import from database.js.
 * The already-open db instance is passed in as a parameter by database.js
 * after initDatabase() completes.  This breaks the circular dependency:
 *   database.js ↔ devSeed.js   ← was a cycle
 *   database.js → devSeed.js   ← correct, cycle-free
 */

/**
 * Seeds the database with development-only placeholder data.
 * Only runs when the chapters table is empty.
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db  — already-open DB instance
 * @returns {Promise<void>}
 */
export async function runDevSeed(db) {
  // Guard: skip if data already exists.
  const existing = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM chapters;'
  );
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  console.log('[DevSeed] Inserting sample development data …');

  await db.withTransactionAsync(async () => {
    // ── chapters ─────────────────────────────────────────────────────
    await db.runAsync(
      `INSERT INTO chapters (chapter_number, arabic_title, english_title, ordering)
       VALUES (?, ?, ?, ?);`,
      [1, '[DEV] الباب الأول', '[DEV] Chapter One — Intentions', 1]
    );
    await db.runAsync(
      `INSERT INTO chapters (chapter_number, arabic_title, english_title, ordering)
       VALUES (?, ?, ?, ?);`,
      [2, '[DEV] الباب الثاني', '[DEV] Chapter Two — Truthfulness', 2]
    );

    const ch1 = await db.getFirstAsync(
      'SELECT id FROM chapters WHERE chapter_number = 1;'
    );
    const ch2 = await db.getFirstAsync(
      'SELECT id FROM chapters WHERE chapter_number = 2;'
    );

    // ── hadiths ───────────────────────────────────────────────────────
    const hadiths = [
      {
        chapter_id: ch1.id,
        hadith_number: '1',
        arabic_text: '[DEV] نص الحديث الأول — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Sample hadith 1 — development placeholder text only.',
        ordering: 1,
      },
      {
        chapter_id: ch1.id,
        hadith_number: '2',
        arabic_text: '[DEV] نص الحديث الثاني — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Sample hadith 2 — development placeholder text only.',
        ordering: 2,
      },
      {
        chapter_id: ch1.id,
        hadith_number: '3',
        arabic_text: '[DEV] نص الحديث الثالث — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Sample hadith 3 — development placeholder text only.',
        ordering: 3,
      },
      {
        chapter_id: ch2.id,
        hadith_number: '1',
        arabic_text: '[DEV] نص الحديث الأول في الباب الثاني — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Chapter two, hadith 1 — development placeholder text only.',
        ordering: 1,
      },
    ];

    for (const h of hadiths) {
      await db.runAsync(
        `INSERT INTO hadiths (chapter_id, hadith_number, arabic_text, english_text, ordering)
         VALUES (?, ?, ?, ?, ?);`,
        [h.chapter_id, h.hadith_number, h.arabic_text, h.english_text, h.ordering]
      );
    }

    // Retrieve inserted hadith IDs for linking to audio.
    const hRow1 = await db.getFirstAsync(
      'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
      [ch1.id, '1']
    );
    const hRow2 = await db.getFirstAsync(
      'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
      [ch1.id, '2']
    );
    const hRow3 = await db.getFirstAsync(
      'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
      [ch1.id, '3']
    );

    // ── DEV audio records ─────────────────────────────────────────────
    // Use chapter_from / chapter_to instead of the old chapter_id FK.
    // Dev tracks all cover chapter 1 only (single-chapter range: from=1, to=1).
    await db.runAsync(
      `INSERT INTO audios (title, filename, chapter_from, chapter_to, ordering, pdf_page)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['[DEV] Track 001', '001.mp3', 1, 1, 1, 1]
    );
    await db.runAsync(
      `INSERT INTO audios (title, filename, chapter_from, chapter_to, ordering, pdf_page)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['[DEV] Track 002', '002.mp3', 1, 1, 2, 1]
    );
    await db.runAsync(
      `INSERT INTO audios (title, filename, chapter_from, chapter_to, ordering, pdf_page)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['[DEV] Track 003', '003.mp3', 1, 1, 3, 1]
    );

    const aRow1 = await db.getFirstAsync(
      "SELECT id FROM audios WHERE filename = '001.mp3';"
    );
    const aRow2 = await db.getFirstAsync(
      "SELECT id FROM audios WHERE filename = '002.mp3';"
    );
    const aRow3 = await db.getFirstAsync(
      "SELECT id FROM audios WHERE filename = '003.mp3';"
    );

    // ── hadith_audio links ────────────────────────────────────────────
    if (hRow1 && aRow1) {
      await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hRow1.id, aRow1.id]
      );
    }
    if (hRow2 && aRow2) {
      await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hRow2.id, aRow2.id]
      );
    }
    if (hRow3 && aRow3) {
      await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hRow3.id, aRow3.id]
      );
    }
  });

  console.log('[DevSeed] Sample data inserted (chapters, hadiths, audios, links).');
}
