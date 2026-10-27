/* ============================================================================
 * server.js —— 零依赖静态服务器（Node ≥ 18，无任何 npm 包）
 * 用法：node server/server.js   或   npm start
 * 端口：PORT 环境变量，默认 4173；监听 0.0.0.0 便于预览环境代理。
 * 站点为纯静态：本文件只做静态托管 + 目录回落 + 合理缓存头 + 安全头。
 * ==========================================================================*/
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer-when-downgrade'
  }, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://local.invalid').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }
  if (urlPath === '/') urlPath = '/index.html';

  let file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (err2, buf) => {
      if (err2) {
        /* 无扩展名回落 .html（/gallery → /gallery.html） */
        if (!path.extname(file)) {
          return fs.readFile(file + '.html', (err3, buf3) => {
            if (err3) return notFound(res);
            ok(res, file + '.html', buf3);
          });
        }
        return notFound(res);
      }
      ok(res, file, buf);
    });
  });

  function ok(res2, f, buf) {
    const ext = path.extname(f).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    send(res2, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  }
  function notFound(res2) {
    const body = '<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>404 · До свидания</title>' +
      '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fbf6f3;color:#382e3f">' +
      '<div style="text-align:center"><h1 style="font-size:2rem">404</h1><p>这个泡泡是空的。<a href="/index.html">回首页</a></p></div></body></html>';
    send(res2, 404, body, { 'Content-Type': 'text/html; charset=utf-8' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('До свидания · static server on http://' + HOST + ':' + PORT);
});
