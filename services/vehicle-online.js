const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
import { searchFulldepoCatalog, isFulldepoConfigured } from './fulldepo-catalog.js';

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
    sourceKind: 'vpic',
    tipScope: 'verification',
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
  const hasRequestedYear = year >= 1886 && year <= 2100;
  const lookupYear = hasRequestedYear ? year : currentYear;
  const yearUrl = `${VPIC_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${lookupYear}?format=json`;
  let payload;
  let resultQuery = query;
  try {
    payload = await fetchJson(yearUrl);
  } catch (error) {
    if (!hasRequestedYear) throw error;
    payload = await fetchJson(`${VPIC_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${currentYear}?format=json`);
    resultQuery = { ...query, year:'' };
  }
  const results = Array.isArray(payload.Results) ? payload.Results : [];
  const makeToken = normal(make).replace(/[^a-z0-9çğıöşü]+/gi, ' ').trim();
  const modelTokens = model
    .replace(makeToken, ' ')
    .split(/[^a-z0-9çğıöşü]+/i)
    .filter(token => token.length >= 2 && !['sedan', 'hatchback', 'hybrid', 'suv', 'wagon', 'touring'].includes(token));
  const filtered = model ? results.filter(item => {
    const candidate = normal(item.Model_Name);
    if (candidate.includes(model)) return true;
    return modelTokens.length > 0 && modelTokens.some(token => candidate.includes(token));
  }) : results;
  return dedupe(filtered.slice(0, 60).map(item => mapResult(item, resultQuery))).slice(0, 24);
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

  if (isFulldepoConfigured()) {
    try {
      const fulldepo = await searchFulldepoCatalog(query);
      if (fulldepo.ok && fulldepo.results?.length) return fulldepo;
      if (fulldepo.ok && query.vehicleType === 'motosiklet') return fulldepo;
    } catch (error) {
      if (options.fulldepoOnly) throw error;
      // Fulldepo erişilemezse aşağıdaki resmi vPIC model keşfi yedeği çalışır.
    }
  }

  const results = await searchVpic(query);
  return {
    ok: true,
    source: 'NHTSA vPIC model keşfi (Fulldepo yedeği)',
    sourceKind: 'vpic',
    checkedAt: new Date().toISOString(),
    results,
    note: 'Model/yıl keşfi yapıldı. Türkiye trim, motor, yakıt, depo ve tüketim doğrulaması ayrıca gerekir.'
  };
}

export function onlineVehicleSummary(profile) {
  if (!profile?.online) return '';
  if (profile.sourceKind === 'fulldepo') {
    const details = [profile.fuel && profile.fuel !== 'Belirtilmedi' ? profile.fuel : '', profile.engine || '', profile.tank != null ? `${profile.tank} L depo` : ''].filter(Boolean).join(' · ');
    return `${profile.modelYear ? `${profile.modelYear} · ` : ''}Fulldepo kaynak kaydı${details ? ` · ${details}` : ''}`;
  }
  return `${profile.modelYear ? `${profile.modelYear} · ` : ''}NHTSA vPIC model keşfi · teknik alanlar elle doğrulanmalı`;
}
