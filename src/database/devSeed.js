/**
 * DEV SEED — development only.
 *
 * Inserts a minimal set of clearly-labelled sample records so screens
 * have something to render during development.  This module must be
 * removed (or the call in database.js commented out) before shipping.
 *
 * Rules:
 *  - Only runs when the database is completely empty (no chapters).
 *  - Does NOT invent authentic hadith text.  Arabic and English strings
 *    are placeholder labels that make it obvious this is test data.
 *  - 2 sample chapters, 4 sample hadiths.
 */

import { getDatabase } from './database';

export async function runDevSeed() {
  const db = getDatabase();

  // Guard: skip if real (or previously seeded) data already exists.
  const existing = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM chapters;'
  );
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  console.log('[DevSeed] Inserting sample development data …');

  await db.withTransactionAsync(async () => {
    // ── chapters ──────────────────────────────────────────────────────
    await db.runAsync(
      `INSERT INTO chapters
         (chapter_number, arabic_title, english_title, ordering)
       VALUES (?, ?, ?, ?);`,
      [1, '[DEV] الباب الأول', '[DEV] Chapter One — Intentions', 1]
    );
    await db.runAsync(
      `INSERT INTO chapters
         (chapter_number, arabic_title, english_title, ordering)
       VALUES (?, ?, ?, ?);`,
      [2, '[DEV] الباب الثاني', '[DEV] Chapter Two — Truthfulness', 2]
    );

    // Retrieve the inserted IDs.
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
        english_text: '[DEV] Sample hadith 1 — this is development placeholder text only.',
        ordering: 1,
      },
      {
        chapter_id: ch1.id,
        hadith_number: '2',
        arabic_text: '[DEV] نص الحديث الثاني — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Sample hadith 2 — this is development placeholder text only.',
        ordering: 2,
      },
      {
        chapter_id: ch1.id,
        hadith_number: '3',
        arabic_text: '[DEV] نص الحديث الثالث — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Sample hadith 3 — this is development placeholder text only.',
        ordering: 3,
      },
      {
        chapter_id: ch2.id,
        hadith_number: '1',
        arabic_text: '[DEV] نص الحديث الأول في الباب الثاني — هذا نموذج للتطوير فقط.',
        english_text: '[DEV] Chapter two hadith 1 — this is development placeholder text only.',
        ordering: 1,
      },
    ];

    for (const h of hadiths) {
      await db.runAsync(
        `INSERT INTO hadiths
           (chapter_id, hadith_number, arabic_text, english_text, ordering)
         VALUES (?, ?, ?, ?, ?);`,
        [h.chapter_id, h.hadith_number, h.arabic_text, h.english_text, h.ordering]
      );
    }
  });

  console.log('[DevSeed] Sample data inserted.');
}
