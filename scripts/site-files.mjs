import { readdir } from 'node:fs/promises';

// These directories and root files constitute the imported website.
// Add a directory here when introducing another public asset directory.
export const publicDirectories = new Set(['assets', 'backgrounds', 'daily', 'gallery-examples', 'memorial', 'collections']);
export const publicRootFiles = new Set(['_headers', '_routes.json', '_worker.js']);

export function isPublicPath(relativePath) {
  const parts = relativePath.split('/');
  if (relativePath.startsWith('qa-')) return false;
  if (parts.some(part => part.startsWith('.') || part === '..')) return false;
  if (parts.length > 1) return publicDirectories.has(parts[0]);
  return publicRootFiles.has(relativePath) || /\.(?:html|css|js|svg|png|jpe?g|webp|avif|gif|ico|woff2?|mp3|ogg|mp4)$/i.test(relativePath);
}

export async function listPublicEntries(root) {
  return (await readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() ? publicDirectories.has(entry.name) : isPublicPath(entry.name))
    .map(entry => entry.name).sort();
}
