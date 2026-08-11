// Syncs content/audios.js into the audios table on every startup.
// Idempotent. Never overwrites position_ms or duration_ms (user/runtime data).

function validateHadithRange(from, to, pos, fname) {
  if (!Number.isInteger(from) || from < 0) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_from" must be a non-negative integer, got ${JSON.stringify(from)}.`
    );
  }
  if (!Number.isInteger(to) || to < 0) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_to" must be a non-negative integer, got ${JSON.stringify(to)}.`
    );
  }
  if (from === 0 && to === 0) return;
  if (from === 0 || to === 0) {
    throw new Error(
      `${pos} ("${fname}"): 0 is only valid when BOTH from and to are 0 (Introduction). Got from=${from}, to=${to}.`
    );
  }
  if (from > to) {
    throw new Error(
      `${pos} ("${fname}"): "hadith_number_from" (${from}) must not be greater than "hadith_number_to" (${to}).`
    );
  }
}

function validateAudios(audios) {
  if (!Array.isArray(audios)) {
    throw new Error('[AudioImporter] audios must be an array.');
  }

  const seenFilenames = new Set();

  audios.forEach((a, idx) => {
    const pos = `audios[${idx}]`;

    if (a == null || typeof a !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    if (!a.filename || typeof a.filename !== 'string' || !a.filename.trim()) {
      throw new Error(`${pos}: missing or empty "filename".`);
    }
    const fname = a.filename.trim();
    if (seenFilenames.has(fname)) {
      throw new Error(`${pos}: duplicate filename "${fname}".`);
    }
    seenFilenames.add(fname);

    if (!a.title || typeof a.title !== 'string' || !a.title.trim()) {
      throw new Error(`${pos} ("${fname}"): missing or empty "title".`);
    }

    if (a.hadith_number_from == null) {
      throw new Error(`${pos} ("${fname}"): missing "hadith_number_from".`);
    }
    if (a.hadith_number_to == null) {
      throw new Error(`${pos} ("${fname}"): missing "hadith_number_to".`);
    }
    validateHadithRange(a.hadith_number_from, a.hadith_number_to, pos, fname);

    if (a.ordering == null) {
      throw new Error(`${pos} ("${fname}"): missing "ordering".`);
    }
    if (!Number.isInteger(a.ordering) || a.ordering < 0) {
      throw new Error(`${pos} ("${fname}"): "ordering" must be a non-negative integer.`);
    }
  });
}

// Called by database.js after migrations.
export async function syncAudioContent(db) {
  const { default: audios } = await import('./content/audios');

  if (__DEV__) {
    console.log('[Content] Syncing audio metadata …');
  }

  if (!Array.isArray(audios) || audios.length === 0) {
    if (__DEV__) console.log('[Content] Nothing to sync — audios array is empty.');
    return;
  }

  validateAudios(audios);

  let audiosInserted = 0;
  let audiosUpdated = 0;

  await db.withTransactionAsync(async () => {
    for (const a of audios) {
      const fname = a.filename.trim();
      const existing = await db.getFirstAsync(
        'SELECT id FROM audios WHERE filename = ?;',
        [fname]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE audios
              SET title = ?,
                  hadith_number_from = ?,
                  hadith_number_to = ?,
                  ordering = ?,
                  pdf_page = ?
            WHERE filename = ?;`,
          [
            a.title.trim(),
            a.hadith_number_from,
            a.hadith_number_to,
            a.ordering,
            a.pdf_page ?? null,
            fname,
          ]
        );
        audiosUpdated += 1;
        if (__DEV__) console.log(`[Content] Updated:  "${fname}"`);
      } else {
        await db.runAsync(
          `INSERT INTO audios
             (title, filename, hadith_number_from, hadith_number_to, ordering, pdf_page)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            a.title.trim(),
            fname,
            a.hadith_number_from,
            a.hadith_number_to,
            a.ordering,
            a.pdf_page ?? null,
          ]
        );
        audiosInserted += 1;
        if (__DEV__) console.log(`[Content] Inserted: "${fname}"`);
      }
    }
  });

  if (__DEV__) {
    console.log(
      `[Content] Sync complete. Inserted: ${audiosInserted}, Updated: ${audiosUpdated}.`
    );
  }
}
