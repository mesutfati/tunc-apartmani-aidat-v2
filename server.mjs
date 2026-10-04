import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { getFuelPrices } from './services/fuel-prices.js';

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/api/fuel-prices') {
    getFuelPrices({ city:requestUrl.searchParams.get('city') || 'İstanbul', type:requestUrl.searchParams.get('type') || 'benzin' })
      .then(rows => { const payload = { rows:[...rows], meta:rows.meta }; res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(payload)); })
      .catch(error => { res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify({ error:error.message })); });
    return;
  }
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
