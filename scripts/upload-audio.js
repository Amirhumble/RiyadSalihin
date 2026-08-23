#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const OBJECT_PREFIX = 'audio/';
const REGION = 'auto';
const SERVICE = 's3';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

const ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const BUCKET = (process.env.R2_BUCKET_NAME || 'audio').trim();
const PUBLIC_BASE = (process.env.EXPO_PUBLIC_AUDIO_BASE_URL || '').trim().replace(/\/+$/, '');

function fail(message) {
  console.error(`\n[upload-audio] ${message}\n`);
  process.exit(1);
}

if (typeof fetch !== 'function') {
  fail('Node 18+ is required (global fetch).');
}
if (!ACCOUNT_ID) fail('Missing R2_ACCOUNT_ID.');
if (!ACCESS_KEY) fail('Missing R2_ACCESS_KEY_ID. Never put this in src/.');
if (!SECRET_KEY) fail('Missing R2_SECRET_ACCESS_KEY. Never put this in src/.');
if (!BUCKET) fail('Missing R2_BUCKET_NAME.');

const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function canonicalUri(objectKey) {
  const parts = [BUCKET];
  if (objectKey) {
    for (const segment of objectKey.split('/')) {
      if (segment) parts.push(segment);
    }
  }
  return `/${parts.map(rfc3986).join('/')}`;
}

function canonicalQuery(query) {
  if (!query) return '';
  return Object.keys(query)
    .sort()
    .map((key) => `${rfc3986(key)}=${rfc3986(String(query[key]))}`)
    .join('&');
}

async function signedFetch({ method, objectKey, query, body, extraHeaders }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? sha256Hex(body) : sha256Hex('');

  const headers = {
    host: HOST,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(extraHeaders || {}),
  };

  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const headerLookup = {};
  for (const name of Object.keys(headers)) {
    headerLookup[name.toLowerCase()] = headers[name];
  }
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headerLookup[name]).trim()}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');
  const queryString = canonicalQuery(query);

  const canonicalRequest = [
    method,
    canonicalUri(objectKey),
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${HOST}${canonicalUri(objectKey)}${queryString ? `?${queryString}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: body || undefined,
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text, headers: res.headers };
}

async function listRemoteObjects() {
  const found = new Map();
  let token = null;

  while (true) {
    const query = {
      'list-type': '2',
      prefix: OBJECT_PREFIX,
    };
    if (token) query['continuation-token'] = token;

    const res = await signedFetch({ method: 'GET', query });
    if (!res.ok) {
      fail(`Could not list R2 objects: ${res.status} ${res.text}`);
    }

    const blocks = [...res.text.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
    for (const block of blocks) {
      const keyMatch = block[1].match(/<Key>([^<]+)<\/Key>/);
      const sizeMatch = block[1].match(/<Size>([^<]+)<\/Size>/);
      if (keyMatch) {
        found.set(keyMatch[1], sizeMatch ? Number(sizeMatch[1]) : NaN);
      }
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(res.text);
    if (!truncated) break;
    const next = res.text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!next) break;
    token = next[1];
  }

  return found;
}

async function uploadObject(objectKey, localPath) {
  const body = fs.readFileSync(localPath);
  return signedFetch({
    method: 'PUT',
    objectKey,
    body,
    extraHeaders: {
      'content-type': 'audio/mpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fail(`Audio folder not found: ${AUDIO_DIR}`);
  }

  const files = fs
    .readdirSync(AUDIO_DIR)
    .filter((name) => name.toLowerCase().endsWith('.mp3'))
    .sort();

  if (files.length === 0) {
    fail(`No .mp3 files found in ${AUDIO_DIR}`);
  }

  const publicHint = PUBLIC_BASE
    ? `${PUBLIC_BASE}/${OBJECT_PREFIX}`
    : `r2://${BUCKET}/${OBJECT_PREFIX}`;

  console.log(`[upload-audio] Found ${files.length} local MP3 file(s) in assets/audio/`);
  console.log(`[upload-audio] Bucket: ${BUCKET}`);
  console.log(`[upload-audio] Objects: ${OBJECT_PREFIX}001.mp3 …`);
  console.log(`[upload-audio] Public base: ${publicHint}`);
  console.log('[upload-audio] Local files are NOT deleted.\n');

  const remote = await listRemoteObjects();
  console.log(`[upload-audio] Remote objects currently in bucket: ${remote.size}\n`);

  let uploaded = 0;
  let skipped = 0;
  const failures = [];

  for (let i = 0; i < files.length; i += 1) {
    const name = files[i];
    const objectKey = `${OBJECT_PREFIX}${name}`;
    const localPath = path.join(AUDIO_DIR, name);
    const size = fs.statSync(localPath).size;
    const label = `[${String(i + 1).padStart(3, '0')}/${files.length}] ${objectKey} (${formatBytes(size)})`;

    const remoteSize = remote.get(objectKey);
    if (Number.isFinite(remoteSize) && remoteSize === size) {
      console.log(`${label} — skip (already uploaded, same size)`);
      skipped += 1;
      continue;
    }

    const replacing = remote.has(objectKey);
    process.stdout.write(`${label} — ${replacing ? 'replacing' : 'uploading'} … `);
    try {
      const res = await uploadObject(objectKey, localPath);
      if (!res.ok) {
        console.log(`FAIL (${res.status})`);
        failures.push({ name: objectKey, reason: `${res.status} ${res.text}` });
        continue;
      }
      console.log('ok');
      uploaded += 1;
    } catch (err) {
      console.log('FAIL');
      failures.push({ name: objectKey, reason: err.message || String(err) });
    }
  }

  console.log('\n[upload-audio] Done.');
  console.log(`  uploaded: ${uploaded}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  failed:   ${failures.length}`);

  if (failures.length) {
    console.log('\nFailures:');
    for (const item of failures) {
      console.log(`  - ${item.name}: ${item.reason}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  fail(err.message || String(err));
});
