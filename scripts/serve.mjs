import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPublicPath } from './site-files.mjs';

const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(projectRoot, option('--root', '.'));
const host = option('--host', process.env.HOST || '0.0.0.0');
const port = Number(option('--port', process.env.PORT || '5173'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
await stat(resolve(root, 'index.html'));
const { default: worker } = await import(pathToFileURL(resolve(root, '_worker.js')).href);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.avif': 'image/avif', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4'
};

async function serveAsset(request) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); }
  catch { return new Response('Bad request', { status: 400 }); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const relative = pathname.replace(/^\/+/, '');
  const filename = resolve(root, relative);
  if (!filename.startsWith(root + sep) || !isPublicPath(relative)) return new Response('Not found', { status: 404 });
  try {
    const bytes = await readFile(filename);
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: { 'Content-Type': mime[extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': String(bytes.length), 'Cache-Control': 'no-cache' }
    });
  } catch (error) {
    if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return new Response('Not found', { status: 404 });
    throw error;
  }
}

http.createServer(async (incoming, outgoing) => {
  try {
    if (!['GET', 'HEAD'].includes(incoming.method)) {
      outgoing.writeHead(405, { Allow: 'GET, HEAD' });
      outgoing.end('Method not allowed');
      return;
    }
    const url = new URL(incoming.url || '/', `http://127.0.0.1:${port}`);
    const request = new Request(url, { method: incoming.method, headers: incoming.headers });
    const env = { ASSETS: { fetch: serveAsset }, GALLERY_ARCHIVE_ORIGIN: process.env.GALLERY_ARCHIVE_ORIGIN };
    const response = await worker.fetch(request, env, { waitUntil: promise => promise.catch(console.error) });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(incoming.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error.message);
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    outgoing.end('Preview server error');
  }
}).listen(port, host, () => console.log(`Denia preview: http://${host}:${port}/ (${root})`));
