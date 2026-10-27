import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { listPublicEntries } from './site-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const entries = await listPublicEntries(root);
if (!entries.includes('index.html')) throw new Error('Missing website index.html');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of entries) await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
console.log(`Copied ${entries.length} website entries to dist/. No source compilation was performed.`);
