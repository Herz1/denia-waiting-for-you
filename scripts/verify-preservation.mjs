#!/usr/bin/env node
// Read-only, offline preservation audit. Data scripts are parsed as JSON, never executed.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const args = process.argv.slice(2);
const usage = 'Usage: node scripts/verify-preservation.mjs [--root DIRECTORY] [--json]';
let root = fileURLToPath(new URL('../', import.meta.url));
let jsonOutput = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === '--json') jsonOutput = true;
  else if (argument === '--root' && args[index + 1] && !args[index + 1].startsWith('--')) root = resolve(args[++index]);
  else if (argument === '--help') { console.log(usage); process.exit(0); }
  else { console.error(`${usage}\nUnknown argument or missing value: ${argument}`); process.exit(2); }
}

const failures = [];
const notes = [];
const counts = { baselineFiles: 0, unchangedFiles: 0, archivedHTML: 0, dailyVideos: 0, exactDailyCovers: 0, galleryImages: 0, galleryWorks: 0 };
function fail(location, reason) { failures.push({ location, reason }); }
function check(condition, location, reason) { if (!condition) fail(location, reason); return Boolean(condition); }
function hash(value, algorithm = 'sha256') { return createHash(algorithm).update(value).digest('hex'); }
function describe(value) {
  if (value === undefined) return '(missing)';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length > 240) return `value length ${text.length}, SHA-256 ${hash(text)}`;
  return JSON.stringify(value);
}
function compare(actual, expected, location) {
  if (isDeepStrictEqual(actual, expected)) return true;
  fail(location, `expected ${describe(expected)}; received ${describe(actual)}`);
  return false;
}
async function read(relativePath, encoding = null) {
  try { return await readFile(resolve(root, relativePath), encoding); }
  catch (error) { fail(relativePath, `cannot read file (${error.code || error.message})`); return null; }
}
async function readJSON(relativePath) {
  const text = await read(relativePath, 'utf8');
  if (text === null) return null;
  try { return JSON.parse(text); }
  catch (error) { fail(relativePath, `invalid JSON: ${error.message.slice(0, 240)}`); return null; }
}

// Accept only comments, the named window assignment, and one JSON value. Trailing code fails JSON.parse.
async function readDataScript(relativePath, globalName) {
  const text = await read(relativePath, 'utf8');
  if (text === null) return null;
  const escapedName = globalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = new RegExp(`^(?:(?:\\s+)|(?:/\\*[\\s\\S]*?\\*/)|(?://[^\\r\\n]*(?:\\r?\\n|$)))*window\\.${escapedName}\\s*=\\s*`);
  const match = prefix.exec(text);
  if (!match) { fail(relativePath, `expected only comments followed by window.${globalName} = JSON`); return null; }
  const serialized = text.slice(match[0].length).trim().replace(/;\s*$/, '');
  try {
    const data = JSON.parse(serialized);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('data root must be an object');
    return data;
  } catch (error) {
    fail(relativePath, `not a standalone JSON assignment; no code was executed (${error.message.slice(0, 240)})`);
    return null;
  }
}

function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !/[\\\0:]/.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..');
}

async function verifyManifest() {
  const manifest = await readJSON('docs/import-manifest.json');
  if (!manifest) return;
  if (!check(Array.isArray(manifest.files), 'manifest.files', 'expected an array')) return;
  compare(manifest.file_count, 71, 'manifest.file_count');
  compare(manifest.files.length, 71, 'manifest.files.length');
  compare(manifest.total_bytes, 19236169, 'manifest.total_bytes');
  const paths = new Set();
  let totalBytes = 0;
  for (const entry of manifest.files) {
    if (!check(entry && safePath(entry.path), 'manifest.files', `unsafe or missing relative path: ${describe(entry?.path)}`)) continue;
    const location = entry.path;
    if (!check(!paths.has(location), location, 'duplicate path in import manifest')) continue;
    paths.add(location);
    counts.baselineFiles += 1;
    if (Number.isSafeInteger(entry.bytes) && entry.bytes >= 0) totalBytes += entry.bytes;
    else fail(location, 'manifest bytes must be a nonnegative safe integer');
    check(typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256), location, 'manifest SHA-256 is missing or invalid');
    const isHTML = /\.html$/i.test(location);
    const preservedPath = isHTML ? `legacy/${location}` : location;
    const data = await read(preservedPath);
    if (data === null) continue;
    let valid = compare(data.byteLength, entry.bytes, `${preservedPath}: bytes`);
    valid = compare(hash(data), entry.sha256, `${preservedPath}: SHA-256`) && valid;
    if (entry.git_blob_sha) {
      const blobHash = createHash('sha1').update(`blob ${data.byteLength}\0`).update(data).digest('hex');
      valid = compare(blobHash, entry.git_blob_sha, `${preservedPath}: Git blob SHA`) && valid;
    }
    if (valid) { counts.unchangedFiles += 1; if (isHTML) counts.archivedHTML += 1; }
  }
  compare(totalBytes, manifest.total_bytes, 'manifest.files byte total');
  compare(counts.archivedHTML, 8, 'legacy HTML count');
}

function decodeHTML(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const codePoint = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' }[entity.toLowerCase()];
  });
}
function textContent(html) { return decodeHTML(html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')).trim(); }
function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1].toLowerCase(), decodeHTML(match[2] ?? match[3])]));
}
function element(html, tag, className) {
  const expression = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  for (const match of html.matchAll(expression)) {
    const attrs = attributes(match[1]);
    if (!className || (attrs.class || '').split(/\s+/).includes(className)) return { attrs, html: match[2], text: textContent(match[2]) };
  }
  return null;
}

async function verifyDaily() {
  const [data, html] = await Promise.all([
    readDataScript('memorial/original-data.js', 'DENIA_ORIGINAL'),
    read('legacy/daily/index.html', 'utf8')
  ]);
  if (!data || html === null) return;
  if (!check(Array.isArray(data.videos), 'DENIA_ORIGINAL.videos', 'expected an array')) return;
  compare(data.videos.length, 49, 'DENIA_ORIGINAL.videos.length');
  counts.dailyVideos = data.videos.length;
  const sourceArticles = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)];
  compare(sourceArticles.length, 49, 'legacy/daily/index.html article count');
  const articles = new Map();
  for (const match of sourceArticles) {
    const id = attributes(match[1]).id;
    if (!check(Boolean(id) && !articles.has(id), 'legacy/daily/index.html', `missing or duplicate article id ${describe(id)}`)) continue;
    articles.set(id, match[2]);
  }
  const seen = new Set();
  for (const [index, video] of data.videos.entries()) {
    if (!check(video && typeof video.id === 'string', `videos[${index}]`, 'missing video id')) continue;
    const location = `videos[${video.id}]`;
    check(!seen.has(video.id), location, 'duplicate video id');
    seen.add(video.id);
    const article = articles.get(video.id);
    if (!check(typeof article === 'string', location, 'no matching article in preserved daily HTML')) continue;
    compare(video.order, index + 1, `${location}.order`);
    const heading = element(article, 'h3');
    const titleLink = heading ? element(heading.html, 'a') : null;
    const author = element(article, 'a', 'author');
    const coverLink = element(article, 'a', 'cover');
    const coverImage = coverLink?.html.match(/<img\b([^>]*)>/i);
    const cover = coverImage ? attributes(coverImage[1]) : {};
    const required = { titleLink, author, coverLink, coverImage };
    for (const [name, value] of Object.entries(required)) check(Boolean(value), location, `original article is missing ${name}`);
    compare(video.title, heading?.text, `${location}.title`);
    compare(video.href, titleLink?.attrs.href, `${location}.href`);
    compare(video.href, coverLink?.attrs.href, `${location}.cover href`);
    compare(video.author, author?.text, `${location}.author`);
    compare(video.authorUrl, author?.attrs.href, `${location}.authorUrl`);
    if (compare(video.cover, cover.src, `${location}.cover data URI`)) counts.exactDailyCovers += 1;
    compare(video.coverAlt, cover.alt, `${location}.coverAlt`);
    compare(video.duration, element(article, 'span', 'duration')?.text, `${location}.duration`);
    compare(video.published, element(article, 'p', 'time')?.text, `${location}.published`);
    const kicker = element(article, 'div', 'kicker');
    if (kicker) compare(video.category, textContent(kicker.html.replace(/<span\b[^>]*>[\s\S]*?<\/span>/i, '')), `${location}.category`);
    const details = element(article, 'details');
    const description = details ? element(details.html, 'p') : null;
    compare(video.description, description?.text || '', `${location}.description`);
    const tagsBlock = element(article, 'div', 'tags');
    const originalTags = tagsBlock ? [...tagsBlock.html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(match => textContent(match[1])) : [];
    compare(video.originalTags, originalTags, `${location}.originalTags`);
    const stats = Object.fromEntries([...article.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)].map(match => [textContent(match[1]), textContent(match[2])]));
    compare(video.stats, stats, `${location}.stats`);
  }
  for (const id of articles.keys()) check(seen.has(id), `videos[${id}]`, 'preserved daily article missing from extracted data');
}

function compareSourceFields(actual, expected, location) {
  if (!actual || typeof actual !== 'object') { fail(location, 'missing source record'); return; }
  for (const [field, value] of Object.entries(expected)) compare(actual[field], value, `${location}.${field}`);
}

async function verifyGallery() {
  const [data, snapshot] = await Promise.all([
    readDataScript('memorial/gallery-data.js', 'DENIA_GALLERY'),
    readJSON('docs/live-gallery-snapshot-20261027.json')
  ]);
  if (!data || !snapshot) return;
  if (!check(Array.isArray(data.items) && Array.isArray(data.works), 'DENIA_GALLERY', 'items and works must be arrays')) return;
  if (!check(Array.isArray(snapshot.items) && Array.isArray(snapshot.works), 'gallery snapshot', 'items and works must be arrays')) return;
  if (!check([...snapshot.items, ...snapshot.works].every(item => item && typeof item === 'object' && typeof item.id === 'string'), 'gallery snapshot', 'every item and work must have a string id')) return;
  compare(data.items.length, 87, 'DENIA_GALLERY.items.length');
  compare(data.works.length, 67, 'DENIA_GALLERY.works.length');
  compare(snapshot.items.length, 87, 'snapshot.items.length');
  compare(snapshot.works.length, 67, 'snapshot.works.length');
  compare(data.meta?.imageTotal, 87, 'DENIA_GALLERY.meta.imageTotal');
  compare(data.meta?.workTotal, 67, 'DENIA_GALLERY.meta.workTotal');
  compare(data.meta?.source, snapshot.source, 'DENIA_GALLERY.meta.source');
  compare(data.meta?.capturedAt, snapshot.capturedAt, 'DENIA_GALLERY.meta.capturedAt');
  counts.galleryImages = data.items.length;
  counts.galleryWorks = data.works.length;
  const seenImages = new Set();
  const seenWorks = new Set();
  const groupedImages = new Map();
  for (const [index, original] of snapshot.items.entries()) {
    const item = data.items[index];
    const location = `gallery.items[${index}, ${original.id}]`;
    compareSourceFields(item, original, location);
    if (item?.id) { check(!seenImages.has(item.id), location, 'duplicate image id'); seenImages.add(item.id); }
  }
  for (const [index, original] of snapshot.works.entries()) {
    const work = data.works[index];
    const location = `gallery.works[${index}, ${original.id}]`;
    compareSourceFields(work, original, location);
    if (!work) continue;
    check(!seenWorks.has(work.id), location, 'duplicate work id');
    seenWorks.add(work.id);
    if (!check(Array.isArray(work.images), `${location}.images`, 'expected an array')) continue;
    const originalImages = original.count > 1 && original.group?.id ? snapshot.groups?.[original.group.id]?.items : [original];
    if (!check(Array.isArray(originalImages), location, 'snapshot lacks group members')) continue;
    compare(work.images.length, originalImages.length, `${location}.images.length`);
    compare(work.images.length, original.count, `${location}.count`);
    for (const [imageIndex, image] of work.images.entries()) {
      const expected = originalImages[imageIndex];
      if (expected) compareSourceFields(image, expected, `${location}.images[${imageIndex}]`);
      else fail(`${location}.images[${imageIndex}]`, 'image not found in the original group');
      if (image?.id) groupedImages.set(image.id, (groupedImages.get(image.id) || 0) + 1);
    }
    for (const field of ['author', 'authorUrl', 'sourceUrl']) check(typeof work[field] === 'string', `${location}.${field}`, 'use a string; keep unknown attribution explicitly empty');
  }
  compare(groupedImages.size, 87, 'gallery grouped unique image count');
  for (const item of snapshot.items) compare(groupedImages.get(item.id), 1, `gallery grouped image ${item.id}: occurrence count`);
  const missingAttribution = data.works.filter(work => !work?.author || !work?.sourceUrl).length;
  if (missingAttribution) notes.push(`${missingAttribution} gallery works retain unresolved author/source fields; preservation passing does not mean attribution is complete.`);
  notes.push('Remote gallery image bytes, API availability, visual layout, accessibility and browser interactions are outside this offline audit.');
}

await verifyManifest();
await verifyDaily();
await verifyGallery();
const report = { passed: failures.length === 0, root, counts, failures, notes };
if (jsonOutput) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${report.passed ? 'PASS' : 'FAIL'} — offline preservation audit`);
  console.log(`Original files: ${counts.unchangedFiles}/${counts.baselineFiles}; archived HTML: ${counts.archivedHTML}/8.`);
  console.log(`Daily records: ${counts.dailyVideos}/49; exact embedded covers: ${counts.exactDailyCovers}/49.`);
  console.log(`Gallery records: ${counts.galleryImages}/87 images, ${counts.galleryWorks}/67 works.`);
  for (const failure of failures) console.error(`FAIL ${failure.location}: ${failure.reason}`);
  for (const note of notes) console.log(`NOTE ${note}`);
}
process.exitCode = report.passed ? 0 : 1;
