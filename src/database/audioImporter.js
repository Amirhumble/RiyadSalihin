// Syncs content/audios.js and content/audioLinks.js into SQLite on startup.
// Idempotent: safe to run every launch. Never overwrites position_ms.

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

function validateAudioLinks(audioLinks, filenameSet) {
  if (!Array.isArray(audioLinks)) {
    throw new Error('[AudioImporter] audioLinks must be an array.');
  }

  const seenKeys = new Set();

  audioLinks.forEach((link, idx) => {
    const pos = `audioLinks[${idx}]`;

    if (link == null || typeof link !== 'object') {
      throw new Error(`${pos}: must be an object.`);
    }

    if (!link.filename || typeof link.filename !== 'string' || !link.filename.trim()) {
      throw new Error(`${pos}: missing or empty "filename".`);
    }
    const fname = link.filename.trim();
    if (!filenameSet.has(fname)) {
      throw new Error(
        `${pos}: filename "${fname}" is not in audios.js. Add a matching entry first.`
      );
    }

    if (link.chapter_number == null) {
      throw new Error(`${pos} ("${fname}"): missing "chapter_number".`);
    }
    if (!Number.isInteger(link.chapter_number) || link.chapter_number < 1) {
      throw new Error(
        `${pos} ("${fname}"): "chapter_number" must be a positive integer, got ${JSON.stringify(link.chapter_number)}.`
      );
    }

    if (link.hadith_number == null || String(link.hadith_number).trim() === '') {
      throw new Error(
        `${pos} ("${fname}", chapter ${link.chapter_number}): missing "hadith_number".`
      );
    }

    const key = `${fname}::${link.chapter_number}::${String(link.hadith_number).trim()}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `${pos}: duplicate link (filename "${fname}", chapter ${link.chapter_number}, hadith "${link.hadith_number}").`
      );
    }
    seenKeys.add(key);
  });
}

// Called by database.js after migrations (and optional dev seed).
export async function syncAudioContent(db) {
  const { default: audios } = await import('./content/audios');
  const { default: audioLinks } = await import('./content/audioLinks');

  if (__DEV__) {
    console.log('[Content] Syncing audio metadata …');
  }

  if (
    (!Array.isArray(audios) || audios.length === 0) &&
    (!Array.isArray(audioLinks) || audioLinks.length === 0)
  ) {
    if (__DEV__) console.log('[Content] Nothing to sync — content arrays are empty.');
    return;
  }

  validateAudios(audios);
  const filenameSet = new Set(audios.map((a) => a.filename.trim()));
  validateAudioLinks(audioLinks, filenameSet);

  let audiosInserted = 0;
  let audiosUpdated = 0;
  let linksInserted = 0;
  let linksSkipped = 0;

  await db.withTransactionAsync(async () => {
    // 1. Upsert audio rows first so lessons always sync even if links fail
    const filenameToAudioId = {};

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
        filenameToAudioId[fname] = existing.id;
        if (__DEV__) console.log(`[Content] Updated:  "${fname}"`);
      } else {
        const result = await db.runAsync(
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
        filenameToAudioId[fname] = result.lastInsertRowId;
        if (__DEV__) console.log(`[Content] Inserted: "${fname}"`);
      }
    }

    // 2. Optional hadith_audio links (needs chapters/hadiths rows)
    if (audioLinks.length === 0) return;

    const chapterIdMap = {};
    const hadithIdMap = {};

    for (const link of audioLinks) {
      if (!chapterIdMap[link.chapter_number]) {
        const row = await db.getFirstAsync(
          'SELECT id FROM chapters WHERE chapter_number = ?;',
          [link.chapter_number]
        );
        if (!row) {
          if (__DEV__) {
            console.warn(
              `[Content] Skipping links — chapter ${link.chapter_number} not found.`
            );
          }
          return;
        }
        chapterIdMap[link.chapter_number] = row.id;
      }

      const mapKey = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      if (hadithIdMap[mapKey] === undefined) {
        const chapterId = chapterIdMap[link.chapter_number];
        const row = await db.getFirstAsync(
          'SELECT id FROM hadiths WHERE chapter_id = ? AND hadith_number = ?;',
          [chapterId, String(link.hadith_number).trim()]
        );
        if (!row) {
          if (__DEV__) {
            console.warn(
              `[Content] Skipping links — hadith not found: chapter ${link.chapter_number}, hadith_number "${link.hadith_number}".`
            );
          }
          return;
        }
        hadithIdMap[mapKey] = row.id;
      }
    }

    for (const link of audioLinks) {
      const fname = link.filename.trim();
      const audioId = filenameToAudioId[fname];
      const mapKey = `${link.chapter_number}::${String(link.hadith_number).trim()}`;
      const hadithId = hadithIdMap[mapKey];

      if (!audioId || hadithId == null) continue;

      const result = await db.runAsync(
        'INSERT OR IGNORE INTO hadith_audio (hadith_id, audio_id) VALUES (?, ?);',
        [hadithId, audioId]
      );
      if (result.changes === 0) linksSkipped += 1;
      else linksInserted += 1;
    }
  });

  if (__DEV__) {
    console.log(
      `[Content] Sync complete. ` +
      `Inserted: ${audiosInserted}, Updated: ${audiosUpdated}, ` +
      `Links inserted: ${linksInserted}, Links skipped: ${linksSkipped}.`
    );
  }
}
