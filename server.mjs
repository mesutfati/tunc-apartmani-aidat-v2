import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const safe = normalize(requested).replace(/^\.\.(\/|\\|$)/, '');
  let file = join(root, safe);
  if (!existsSync(file) && raw === '/manus-routes.json') file = join(root, 'public/manus-routes.json');
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Bulunamadı');
}).listen(port, '0.0.0.0', () => console.log(`Yakıt Alarmı preview: http://0.0.0.0:${port}`));
