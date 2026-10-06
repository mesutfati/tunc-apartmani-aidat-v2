const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

const clean = value => String(value || '').trim();
const normal = value => clean(value).toLocaleLowerCase('tr-TR');
const safeType = value => value === 'motosiklet' ? 'motosiklet' : value === 'hafif-ticari' ? 'hafif-ticari' : 'otomobil';
const currentYear = new Date().getFullYear();

function mapResult(item, query) {
  const make = clean(item.Make_Name || query.make);
  const model = clean(item.Model_Name || query.model);
  const year = Number(query.year) >= 1886 ? Number(query.year) : null;
  const type = safeType(query.vehicleType);
  const id = `online-${make}-${model}-${year || 'all'}-${type}`
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id,
    brand: make,
    model,
    modelYear: year ? String(year) : '',
    variant: `${year ? `${year} · ` : ''}Çevrimiçi model sonucu`,
    fuel: 'Belirtilmedi',
    tank: null,
    consumption: null,
    engine: '',
    transmission: '',
    generation: '',
    vehicleType: type,
    sourceLabel: 'NHTSA vPIC çevrimiçi model kataloğu',
    sourceUrl: `${VPIC_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year || currentYear}?format=json`,
    sourceConfidence: 'Çevrimiçi keşif · Türkiye trim/depo doğrulaması değil',
    tip: 'Motor, yakıt, depo ve tüketim değerlerini ruhsat/kullanım kılavuzuyla doğrulayın; bu sonuç model keşfi içindir.',
    details: [
      `Araç türü: ${type === 'motosiklet' ? 'Motosiklet' : type === 'hafif-ticari' ? 'Hafif ticari' : 'Otomobil'}`,
      year ? `Model yılı: ${year}` : 'Model yılı: belirtilmedi',
      'Motor/yakıt/depo/tüketim: bu çevrimiçi model sonucunda doğrulanmadı; elle tamamlanmalı'
    ],
    online: true,
    makeId: item.Make_ID || null,
    modelId: item.Model_ID || null
  };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${normal(item.brand)}|${normal(item.model)}|${item.modelYear || ''}|${item.vehicleType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Çevrimiçi katalog HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchVpic(query) {
  const make = clean(query.make);
  const model = normal(query.model);
  const year = Number(query.year);
  if (!make) throw new Error('Çevrimiçi arama için marka girin.');
  const url = year >= 1886 && year <= 2100
    ? `${VPIC_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
    : `${VPIC_BASE}/GetModelsForMake/make/${encodeURIComponent(make)}?format=json`;
  const payload = await fetchJson(url);
  const results = Array.isArray(payload.Results) ? payload.Results : [];
  const filtered = model ? results.filter(item => normal(item.Model_Name).includes(model)) : results;
  return dedupe(filtered.slice(0, 60).map(item => mapResult(item, query))).slice(0, 24);
}

export async function searchOnlineVehicleCatalog(query = {}, options = {}) {
  const params = new URLSearchParams();
  if (query.make) params.set('make', query.make);
  if (query.model) params.set('model', query.model);
  if (query.year) params.set('year', query.year);
  params.set('vehicleType', safeType(query.vehicleType));

  if (!options.direct) {
    try {
      const response = await fetch(`/api/vehicle-catalog?${params.toString()}`, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.ok && Array.isArray(payload.results)) return payload;
      }
    } catch {
      // Native APK and offline preview fall back to the public vPIC endpoint below.
    }
  }

  const results = await searchVpic(query);
  return {
    ok: true,
    source: 'NHTSA vPIC',
    checkedAt: new Date().toISOString(),
    results,
    note: 'Model/yıl keşfi yapıldı. Türkiye trim, motor, yakıt, depo ve tüketim doğrulaması ayrıca gerekir.'
  };
}

export function onlineVehicleSummary(profile) {
  if (!profile?.online) return '';
  return `${profile.modelYear ? `${profile.modelYear} · ` : ''}NHTSA vPIC model keşfi · teknik alanlar elle doğrulanmalı`;
}
