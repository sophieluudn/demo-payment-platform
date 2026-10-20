const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (!file.toLowerCase().startsWith((root + path.sep).toLowerCase()) || file.includes(path.sep + 'node_modules' + path.sep) || !types[path.extname(file)]) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, bytes) => { if (err) res.writeHead(404).end(); else { res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' }); res.end(bytes); } });
}).listen(4173, '127.0.0.1', () => console.log('金流平台 Demo：http://127.0.0.1:4173'));
