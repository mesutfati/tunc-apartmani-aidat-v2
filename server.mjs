import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { getFuelPrices } from './services/fuel-prices.js';
import { getEarlyWarningLive } from './services/early-warning.js';
import { collectFuelAlerts } from './services/fuel-alert-feed.js';
import { searchOnlineVehicleCatalog } from './services/vehicle-online.js';
import { fetchVehicleProfileTips } from './services/fulldepo-catalog.js';

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
  if (requestUrl.pathname === '/api/early-warning') {
    const city = requestUrl.searchParams.get('city') || 'İstanbul';
    const type = requestUrl.searchParams.get('type') || 'benzin';
    getEarlyWarningLive({ provinceCode:requestUrl.searchParams.get('province') || '34' })
      .then(async payload => {
        if (!payload.ok || !Number.isFinite(Number(payload.prices?.[type]))) {
          const rows = await getFuelPrices({ city, type });
          const selected = rows.find(row => row.live && row.district === (city === 'İstanbul' ? 'Kadıköy' : city)) || rows.find(row => row.live);
          if (selected?.price != null) payload = { ...payload, ok:true, fuelFallback:true, fuelSourceLabel:`Canlı dağıtıcı ortalaması (${selected.sourceCount} kaynak)`, fallbackUpdatedAt:selected.updatedAt, prices:{ ...payload.prices, [type]:selected.price }, fallbackCity:city };
        }
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(payload));
      })
      .catch(error => { res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok:false, error:error.message })); });
    return;
  }
  if (requestUrl.pathname === '/api/fuel-alerts') {
    collectFuelAlerts()
      .then(payload => { res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(payload)); })
      .catch(error => { res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify({ alerts:[], checks:[], error:error.message })); });
    return;
  }
  if (requestUrl.pathname === '/api/vehicle-catalog') {
    searchOnlineVehicleCatalog({
      make:requestUrl.searchParams.get('make') || '',
      model:requestUrl.searchParams.get('model') || '',
      year:requestUrl.searchParams.get('year') || '',
      vehicleType:requestUrl.searchParams.get('vehicleType') || 'otomobil'
    }, { direct:true })
      .then(payload => { res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(payload)); })
      .catch(error => { res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify({ ok:false, results:[], error:error.message })); });
    return;
  }
  if (requestUrl.pathname === '/api/vehicle-tips') {
    let profile = {};
    try { profile = JSON.parse(requestUrl.searchParams.get('profile') || '{}'); } catch {}
    fetchVehicleProfileTips({ ...profile, sourceKind:'fulldepo' })
      .then(result => { res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify({ ok:true, profile:result })); })
      .catch(error => { res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify({ ok:false, error:error.message })); });
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
