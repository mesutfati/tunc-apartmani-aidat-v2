import { FULLDEPO_FIREBASE_API_KEY as BUILD_FULLDEPO_FIREBASE_API_KEY, FULLDEPO_PROJECT_ID as BUILD_FULLDEPO_PROJECT_ID } from '../runtime-config.js';

const DEFAULT_PROJECT_ID = 'fullldepo-ogmedya';
const projectId = () => (typeof process !== 'undefined' && process.env?.FULLDEPO_PROJECT_ID) || BUILD_FULLDEPO_PROJECT_ID || DEFAULT_PROJECT_ID;
const apiKey = () => (typeof process !== 'undefined' && process.env?.FULLDEPO_FIREBASE_API_KEY) || BUILD_FULLDEPO_FIREBASE_API_KEY || '';
const sourceUrl = 'https://fulldepo.goclickdigital.com/';
const metadataCache = new Map();
const metadataTtl = 15 * 60 * 1000;
const clean = value => String(value ?? '').trim();
const normal = value => clean(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const unique = values => [...new Set((values || []).filter(value => value !== '' && value != null))];
const slug = value => normal(value).replace(/[()]/g, '_').replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
const fuelLabel = value => {
  const text = normal(value);
  if (text === 'dizel' || text === 'diesel' || text === 'motorin' || text === 'mazot') return 'Motorin';
  if (text === 'benzin' || text === 'gasoline') return 'Benzin';
  if (text === 'lpg' || text === 'otogaz') return 'LPG';
  if (text === 'hibrit' || text === 'hybrid') return 'Hibrit';
  if (text === 'elektrik' || text === 'electric') return 'Elektrik';
  return clean(value) || 'Belirtilmedi';
};
const typeLabel = value => value === 'motosiklet' ? 'Motosiklet' : value === 'hafif-ticari' ? 'Hafif ticari' : 'Otomobil';

function firestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(firestoreValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, entry]) => [key, firestoreValue(entry)]));
  return value;
}
function firestoreDocument(document) {
  return Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
}
function firestoreBase() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents`;
}
function encodedPath(path) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}
async function firestoreFetch(url, options = {}) {
  const key = apiKey();
  if (!key) throw new Error('Fulldepo çevrimiçi katalog anahtarı yapılandırılmadı.');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, {
      ...options,
      signal: controller?.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`Fulldepo Firestore HTTP ${response.status}`);
    return response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function readDocument(path) {
  try {
    const payload = await firestoreFetch(`${firestoreBase()}/${encodedPath(path)}`);
    return payload?.name ? { ...firestoreDocument(payload), _updateTime: payload.updateTime || payload.createTime || null } : null;
  } catch (error) {
    if (String(error?.message || '').includes('HTTP 404')) return null;
    throw error;
  }
}
async function runQuery(collection, filters, limit = 80) {
  const whereFilters = filters.filter(([, value]) => clean(value));
  const filter = whereFilters.length === 1
    ? { fieldFilter: { field: { fieldPath: whereFilters[0][0] }, op: 'EQUAL', value: { stringValue: String(whereFilters[0][1]) } } }
    : { compositeFilter: { op: 'AND', filters: whereFilters.map(([field, value]) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: String(value) } } })) } };
  const payload = await firestoreFetch(`${firestoreBase()}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: filter, limit } }),
  });
  return (Array.isArray(payload) ? payload : []).filter(row => row.document).map(row => ({ ...firestoreDocument(row.document), _name: row.document.name, _updateTime: row.document.updateTime || row.readTime || null }));
}
async function readMetadata(kind) {
  const path = kind === 'motosiklet' ? 'metadata/dropdowns_moto' : 'metadata/dropdowns';
  const cached = metadataCache.get(path);
  if (cached && Date.now() - cached.checkedAt < metadataTtl) return cached.value;
  const value = await readDocument(path);
  if (!value) throw new Error(`Fulldepo ${path} verisi bulunamadı.`);
  const result = { ...value };
  delete result._updateTime;
  metadataCache.set(path, { checkedAt: Date.now(), value: result });
  return result;
}
function matchKey(keys, query) {
  const wanted = normal(query);
  return keys.find(key => normal(key) === wanted) || keys.find(key => normal(key).includes(wanted) || wanted.includes(normal(key))) || null;
}
function matchModels(value, query) {
  const wanted = normal(query);
  const entries = Array.isArray(value) ? value.map(item => [item, item]) : Object.entries(value || {});
  if (!wanted) return entries.slice(0, 6);
  const tokens = wanted.split(/\s+/).filter(token => token.length > 1);
  return entries.filter(([name]) => {
    const candidate = normal(name);
    return candidate.includes(wanted) || wanted.includes(candidate) || tokens.some(token => candidate.includes(token));
  }).slice(0, 8);
}
function yearsFrom(value) {
  return unique((Array.isArray(value) ? value : []).map(number).filter(year => year >= 1886 && year <= 2100)).sort((a, b) => a - b);
}
function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
}
function profileId(parts) {
  return `fulldepo-${parts.map(slug).filter(Boolean).join('-')}`.replace(/-+/g, '-');
}
function baseDetails({ type, fuel, tank, years, sourceUpdatedAt, sampleCount }) {
  return [
    `Araç türü: ${typeLabel(type)}`,
    `Yakıt: ${fuel}`,
    tank != null ? `Kaynak depo kapasitesi: ${tank} L` : 'Depo kapasitesi bu varyantta belirtilmedi',
    years.length ? `Kaynak model yılları: ${years.join(', ')}` : 'Model yılı kaynağın bu kaydında belirtilmedi',
    sampleCount != null ? `Teknik veri örnek sayısı: ${sampleCount}` : '',
    sourceUpdatedAt ? `Kaynak kayıt zamanı: ${dateLabel(sourceUpdatedAt)}` : '',
    'Tüketim değeri bu kayıtta yok; menzil hesabı için kullanıcı doğrulaması gerekir',
  ].filter(Boolean);
}
function mapCarDocument(record, query, generationName) {
  const years = yearsFrom(record.available_years);
  const requestedYear = number(query.year);
  const brand = clean(record.brand || query.make);
  const model = clean(record.model || query.model);
  const display = clean(record.display_label || record.display_name || generationName || model);
  const fuelTypes = record.fuel_types || {};
  const profiles = [];
  for (const [rawFuel, fuelData] of Object.entries(fuelTypes)) {
    const fuel = fuelLabel(rawFuel);
    const commonTank = number(fuelData?.common_tank);
    const engines = Array.isArray(fuelData?.engines) && fuelData.engines.length ? fuelData.engines : [{}];
    for (let index = 0; index < engines.length; index += 1) {
      const engine = engines[index] || {};
      const engineYears = yearsFrom(engine.available_years);
      const availableYears = engineYears.length ? engineYears : years;
      if (requestedYear && availableYears.length && !availableYears.includes(requestedYear)) continue;
      const tank = number(engine.tank_liters) ?? commonTank;
      const engineName = clean(engine.name);
      const sampleCount = number(engine.sample_count);
      const variantParts = [display, fuel, engineName].filter(Boolean);
      profiles.push({
        id: profileId(['fulldepo', brand, model, record.kasa_id || display, rawFuel, engineName || index]),
        brand,
        model,
        modelYear: requestedYear ? String(requestedYear) : '',
        availableYears,
        variant: variantParts.join(' · '),
        fuel,
        fuelSource: clean(rawFuel),
        tank,
        consumption: null,
        engine: engineName,
        transmission: '',
        generation: clean(record.kasa_id || generationName),
        vehicleType: query.vehicleType === 'hafif-ticari' ? 'hafif-ticari' : 'otomobil',
        sourceKind: 'fulldepo',
        sourceLabel: `Fulldepo çevrimiçi araç kataloğu${dateLabel(record._updateTime) ? ` · ${dateLabel(record._updateTime)}` : ''}`,
        sourceUrl,
        sourceConfidence: 'Fulldepo veri kaydı · motor/yakıt/depo alanı bu varyantın kaydından gelir; Türkiye ruhsat/trim eşleşmesi ayrıca doğrulanmalıdır.',
        details: baseDetails({ type:query.vehicleType === 'hafif-ticari' ? 'hafif-ticari' : 'otomobil', fuel, tank, years:availableYears, sourceUpdatedAt:record._updateTime, sampleCount }),
        tip: '',
        tipLabel: 'Model ipucu',
        tipScope: 'pending',
        online: true,
        sourceKey: `${brand}|${model}|${display}|${fuel}|${engineName}`,
        tipKeyCandidates: [
          `${slug(brand)}_${slug(display)}_${slug(rawFuel)}`,
          `${slug(brand)}_${slug(display)}__${slug(rawFuel)}`,
          `${slug(brand)}_${slug(record.display_name || display)}_${slug(rawFuel)}`,
          `${slug(brand)}_${slug(model)}_${slug(rawFuel)}`,
        ],
      });
    }
  }
  return profiles;
}
function mapMotorcycleDocument(record) {
  const brand = clean(record.brand);
  const model = clean(record.model);
  const display = clean(record.display_name || `${brand} ${model}`);
  const fuel = fuelLabel(record.fuel_type || 'Benzin');
  const tank = number(record.tank_liters);
  return {
    id: profileId(['fulldepo-moto', brand, model, display]),
    brand,
    model,
    modelYear: '',
    availableYears: [],
    variant: `${display} · ${fuel}${tank != null ? ` · ${tank} L depo` : ''}`,
    fuel,
    fuelSource: clean(record.fuel_type || fuel),
    tank,
    consumption: null,
    engine: '',
    transmission: '',
    generation: '',
    vehicleType: 'motosiklet',
    sourceKind: 'fulldepo',
    sourceLabel: `Fulldepo çevrimiçi motosiklet kataloğu${dateLabel(record._updateTime) ? ` · ${dateLabel(record._updateTime)}` : ''}`,
    sourceUrl,
    sourceConfidence: 'Fulldepo motosiklet kaydı · model, yakıt ve depo alanları kaynak kaydından gelir; model yılı/trim ayrıca doğrulanmalıdır.',
    details: baseDetails({ type:'motosiklet', fuel, tank, years:[], sourceUpdatedAt:record._updateTime }),
    tip: '',
    tipLabel: 'Model ipucu',
    tipScope: 'pending',
    online: true,
    sourceKey: `${brand}|${model}|${display}|${fuel}`,
        tipKeyCandidates: [
          `moto_${slug(brand)}_${slug(display)}_${slug(record.fuel_type || fuel)}`,
          `moto_${slug(brand)}_${slug(model)}_${slug(record.fuel_type || fuel)}`,
      `${slug(brand)}_${slug(model)}_${slug(record.fuel_type || fuel)}`,
    ],
  };
}
function cleanTip(value) {
  return clean(value).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}
function tipsFromDocument(document) {
  if (!document || document.status !== 'ready' || !Array.isArray(document.tips)) return null;
  const tips = document.tips.map(item => ({
    title: cleanTip(item?.title),
    body: cleanTip(item?.body),
    category: cleanTip(item?.category),
    saving: cleanTip(item?.saving),
  })).filter(item => item.title || item.body);
  if (!tips.length) return null;
  return tips;
}
async function findTipDocumentByModel(profile) {
  const brand = clean(profile?.brand);
  if (!brand) return null;
  const fuel = profile?.fuel === 'Motorin' ? 'dizel' : normal(profile?.fuel);
  const rows = await runQuery('ai_content', [['marka', brand], ['yakitTipi', fuel]], 220).catch(() => []);
  const modelTokens = (profile?.vehicleType === 'motosiklet' ? [profile?.model, profile?.variant?.split(' · ')[0]] : [profile?.variant?.split(' · ')[0], profile?.generation]).map(slug).filter(Boolean);
  return rows.find(row => {
    const id = clean(row._name).split('/').pop() || '';
    const nesil = normal(row.nesil);
    return modelTokens.some(token => id.includes(token) || (nesil && (normal(token.replace(/_/g, ' ')) === nesil || normal(token.replace(/_/g, ' ')).includes(nesil))));
  }) || null;
}
export async function fetchVehicleProfileTips(profile) {
  if (!profile || profile.sourceKind !== 'fulldepo') return profile;
  if (typeof window !== 'undefined' && !apiKey()) {
    const query = encodeURIComponent(JSON.stringify({
      brand:profile.brand,
      model:profile.model,
      variant:profile.variant,
      generation:profile.generation,
      fuel:profile.fuel,
      vehicleType:profile.vehicleType,
      tipKeyCandidates:profile.tipKeyCandidates || [],
    }));
    const response = await fetch(`/api/vehicle-tips?profile=${query}`, { headers:{ Accept:'application/json' } }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.profile?.tip) return { ...profile, ...payload.profile };
    }
  }
  const candidates = unique(profile.tipKeyCandidates || []);
  for (const key of candidates) {
    const document = await readDocument(`ai_content/${key}`).catch(() => null);
    const tips = tipsFromDocument(document);
    if (tips?.length) {
      return { ...profile, tip: tips[0].body || tips[0].title, tipTitle: tips[0].title, tips, tipLabel: 'Model ipucu', tipScope: 'model', tipSourceLabel: 'Fulldepo ai_content model ipuçları' };
    }
  }
  const fallbackDocument = await findTipDocumentByModel(profile);
  const fallbackTips = tipsFromDocument(fallbackDocument);
  if (fallbackTips?.length) return { ...profile, tip: fallbackTips[0].body || fallbackTips[0].title, tipTitle: fallbackTips[0].title, tips:fallbackTips, tipLabel: 'Model ipucu', tipScope: 'model', tipSourceLabel: 'Fulldepo ai_content model ipuçları' };
  const fallbackKey = profile.vehicleType === 'motosiklet' ? 'genel_moto' : profile.fuel === 'Motorin' ? 'genel_dizel' : profile.fuel === 'LPG' ? 'genel_lpg' : '';
  if (fallbackKey) {
    const document = await readDocument(`ai_content/${fallbackKey}`).catch(() => null);
    const tips = tipsFromDocument(document);
    if (tips?.length) return { ...profile, tip: tips[0].body || tips[0].title, tipTitle: tips[0].title, tips, tipLabel: 'Genel kullanım ipucu', tipScope: 'general', tipSourceLabel: 'Fulldepo ai_content genel ipucu' };
  }
  return { ...profile, tip: 'Bu varyant için Fulldepo ipucu kaydı bulunamadı. Kullanım kılavuzundaki motor, lastik basıncı ve bakım aralıklarını esas alın.', tipLabel: 'Kaynakta ipucu yok', tipScope: 'unavailable', tipSourceLabel: 'Fulldepo model kaydı' };
}
async function decorateTips(profiles) {
  const selected = profiles.slice(0, 12);
  const decorated = await Promise.all(selected.map(profile => fetchVehicleProfileTips(profile).catch(() => profile)));
  const byId = new Map(decorated.map(profile => [profile.id, profile]));
  return profiles.map(profile => byId.get(profile.id) || profile);
}
export async function searchFulldepoCatalog(query = {}) {
  if (!apiKey()) return { ok:false, configured:false, source:'Fulldepo', results:[], note:'Fulldepo anahtarı yapılandırılmadı.' };
  const vehicleType = query.vehicleType === 'motosiklet' ? 'motosiklet' : query.vehicleType === 'hafif-ticari' ? 'hafif-ticari' : 'otomobil';
  const metadata = await readMetadata(vehicleType);
  const brand = matchKey(Object.keys(metadata), query.make);
  if (!brand) return { ok:true, configured:true, source:'Fulldepo', sourceKind:'fulldepo', checkedAt:new Date().toISOString(), results:[], note:'Fulldepo kaynağında bu marka bulunamadı.' };
  const modelEntries = matchModels(metadata[brand], query.model);
  if (!modelEntries.length) return { ok:true, configured:true, source:'Fulldepo', sourceKind:'fulldepo', checkedAt:new Date().toISOString(), results:[], note:'Fulldepo kaynağında bu model bulunamadı.' };
  const records = [];
  for (const [model] of modelEntries) {
    const found = await runQuery(vehicleType === 'motosiklet' ? 'motorcycles' : 'vehicles', [['brand', brand], ['model', model]], 80);
    records.push(...found);
  }
  let results;
  if (vehicleType === 'motosiklet') results = records.map(mapMotorcycleDocument);
  else results = records.flatMap(record => mapCarDocument(record, { ...query, vehicleType }, record.kasa_id || record.display_name || record.display_label || query.model));
  results = results.filter(profile => profile.brand && profile.model);
  results = [...new Map(results.map(profile => [profile.sourceKey || profile.id, profile])).values()].slice(0, 48);
  results = await decorateTips(results);
  return {
    ok:true,
    configured:true,
    source:'Fulldepo çevrimiçi araç kataloğu',
    sourceKind:'fulldepo',
    checkedAt:new Date().toISOString(),
    results,
    note:`Fulldepo kaynağından ${results.length} varyant getirildi. Motor, yakıt ve depo alanları kaynak kaydıyla birlikte gösterilir; Türkiye ruhsatı ve kesin trim eşleşmesi kullanıcı tarafından doğrulanmalıdır. Tüketim verisi bu katalog yanıtında yoktur.`,
  };
}
export function isFulldepoConfigured() {
  return Boolean(apiKey());
}
export function fulldepoSourceInfo() {
  return { name:'Fulldepo çevrimiçi araç ve motosiklet kataloğu', url:sourceUrl, projectId:projectId() };
}
