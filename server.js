/* Zero-dependency local preview server.
   GitHub Pages serves these exact files statically — there is no server-side
   code in Section 1, so nothing needs installing to run this. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3100;
const PREFIX = process.env.BASE_PATH || '';   // e.g. /shohoj-bazar to simulate GitHub Pages

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (PREFIX && url.startsWith(PREFIX)) url = url.slice(PREFIX.length) || '/';

  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err2, buf) => {
      if (err2) {
        if (path.extname(url)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
        fs.readFile(path.join(ROOT, 'index.html'), (e3, index) => {
          if (e3) { res.writeHead(404).end('Not found'); return; }
          res.writeHead(200, { 'content-type': TYPES['.html'] }).end(index);
        });
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-cache',
      }).end(buf);
    });
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Virtual shop on http://0.0.0.0:${PORT}${PREFIX || '/'}`);
});
