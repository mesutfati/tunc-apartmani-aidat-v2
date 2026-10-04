const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const KNOWN_BRANDS = [
  ['PETROL OFİSİ', /petrol\s*of[iİ]s[iİ]/i],
  ['OPET', /\bopet\b/i],
  ['SHELL', /\bshell\b/i],
  ['BP', /\bbp\b/i],
  ['TOTALENERGIES', /total\s*energies|\btotal\b/i],
  ['MOİL', /mo[iİ]l/i],
  ['AYTEMİZ', /aytem[iİ]z/i],
  ['SUNPET', /sunpet/i],
];

const haversineKm = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

function findBrand(value) {
  const text = String(value || '');
  return KNOWN_BRANDS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const response = await fetch(url, { ...options, signal:controller.signal, cache:'no-store', headers:{ Accept:'application/json', 'User-Agent':'SurusCepte/0.1 station lookup', ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`İstasyon dizini HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function normalizeStation({ id, name, brand, latitude, longitude, street = '', city = '' }, center) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const knownBrand = findBrand(`${brand || ''} ${name || ''}`);
  if (!knownBrand) return null;
  return { id, name:name || knownBrand, brand:knownBrand, latitude, longitude, distanceKm:haversineKm(center, { latitude, longitude }), street, city };
}

function parseOverpass(payload, center) {
  const seen = new Set();
  return (payload.elements || []).map(element => {
    const tags = element.tags || {};
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    const key = `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return normalizeStation({ id:`osm-${element.type}-${element.id}`, name:tags.name || tags.brand || tags.operator, brand:tags.brand || tags.operator, latitude, longitude, street:tags['addr:street'] || '', city:tags['addr:city'] || '' }, center);
  }).filter(Boolean);
}

function parsePhoton(payload, center) {
  const seen = new Set();
  return (payload.features || []).map(feature => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    const isFuel = properties.osm_value === 'fuel' || properties.amenity === 'fuel' || properties.osm_key === 'amenity' && properties.osm_value === 'fuel';
    const brand = findBrand(`${properties.name || ''} ${properties.brand || ''} ${properties.operator || ''}`);
    if (!isFuel || !brand) return null;
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[0]);
    const key = `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return normalizeStation({ id:`photon-${properties.osm_type || 'poi'}-${properties.osm_id || key}`, name:properties.name || brand, brand, latitude, longitude, street:properties.street || '', city:properties.city || '' }, center);
  }).filter(Boolean);
}

export async function getNearbyStations({ latitude, longitude, limit = 8 } = {}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) throw new Error('Yakındaki istasyonlar için geçerli GPS koordinatı gerekli.');
  const center = { latitude:Number(latitude), longitude:Number(longitude) };
  const query = `[out:json][timeout:8];nwr[amenity=fuel](around:8000,${center.latitude},${center.longitude});out center tags;`;
  try {
    const payload = await fetchJson(OVERPASS_URL, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ data:query }) });
    return { ok:true, source:'OpenStreetMap / Overpass', checkedAt:new Date().toISOString(), center, stations:parseOverpass(payload, center).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit) };
  } catch (overpassError) {
    try {
      const results = await Promise.allSettled(KNOWN_BRANDS.slice(0, 5).map(([brand]) => fetchJson(`${PHOTON_URL}?q=${encodeURIComponent(brand)}&lat=${center.latitude}&lon=${center.longitude}&limit=8`)));
      const merged = results.flatMap(result => result.status === 'fulfilled' ? parsePhoton(result.value, center) : []).filter((station, index, all) => all.findIndex(item => item.id === station.id) === index);
      if (!merged.length) throw new Error('Yakın markalı fuel POI bulunamadı.');
      return { ok:true, source:'OpenStreetMap / Photon marka fallback', checkedAt:new Date().toISOString(), center, stations:merged.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit), fallbackReason:overpassError.message };
    } catch (photonError) {
      throw new Error(`İstasyon dizinleri yanıt vermedi: ${photonError.message}`);
    }
  }
}

export { KNOWN_BRANDS };
