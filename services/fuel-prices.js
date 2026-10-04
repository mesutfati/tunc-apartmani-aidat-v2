import { districts, provinces } from '../data/fixtures.js';

export const FUEL_SOURCES = {
  epdk: {
    name: 'EPDK resmi akaryakıt fiyatları',
    role: 'Resmi otorite ve bayi fiyatı referansı',
    url: 'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat',
    serviceUrl: 'https://lisansws.epdk.gov.tr/services/bildirimPetrolAkaryakitFiyatlari?wsdl',
  },
  petrolOfisi: {
    name: 'Petrol Ofisi',
    role: 'Tarih damgalı ticari pompa karşılaştırması',
    url: 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari',
  },
  aytemiz: {
    name: 'Aytemiz',
    role: 'Tarih damgalı tavsiye edilen pompa fiyatı',
    url: 'https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari',
  },
  sunpet: {
    name: 'Sunpet',
    role: 'Tarih damgalı tavsiye edilen pompa fiyatı',
    url: 'https://www.sunpettr.com.tr/yakit-fiyatlari',
  },
  opet: {
    name: 'Opet',
    role: 'Resmi tavsiye edilen pompa fiyatı sayfası; API erişimi hazır olduğunda eklenir',
    url: 'https://www.opet.com.tr/akaryakit-fiyatlari',
  },
};

const ANADOLU = new Set(['Adalar','Ataşehir','Beykoz','Çekmeköy','Kadıköy','Kartal','Maltepe','Pendik','Sancaktepe','Sultanbeyli','Şile','Tuzla','Ümraniye','Üsküdar']);
const slug = value => String(value || 'istanbul').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[çğıöşü]/g, letter => ({ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}[letter] || letter)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalize = value => String(value || '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/İ/g, 'I').replace(/[^A-Z0-9()\/ ]/g, ' ').replace(/\s+/g, ' ').trim();
const numberPattern = /\b(\d{1,3})[.,](\d{2})\b/g;
const numberList = value => [...String(value || '').matchAll(numberPattern)].map(match => Number(`${match[1]}.${match[2]}`));
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => Math.round(value * 100) / 100;

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&uuml;/gi, 'ü').replace(/&Uuml;/g, 'Ü').replace(/&ouml;/gi, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&ccedil;/gi, 'ç').replace(/&Ccedil;/g, 'Ç').replace(/&scedil;/gi, 'ş').replace(/&Scedil;/g, 'Ş')
    .replace(/&nbsp;/gi, ' ');
}
function cleanHtml(value) {
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function canonicalKey(value) {
  const key = normalize(value).replace(/\s*\/\s*/g, ' / ');
  if (key.includes('ISTANBUL') && key.includes('ANADOLU')) return 'ISTANBUL (ANADOLU)';
  if (key.includes('ISTANBUL') && key.includes('AVRUPA')) return 'ISTANBUL (AVRUPA)';
  return key;
}
function regionFor(city, district) {
  if (normalize(city) !== 'ISTANBUL') return canonicalKey(city);
  return canonicalKey(`İstanbul (${ANADOLU.has(district) ? 'Anadolu' : 'Avrupa'})`);
}
function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('tr-TR', { dateStyle:'short', timeStyle:'short', timeZone:'Europe/Istanbul' });
}
function sourceDate(html) {
  const match = String(html).match(/(?:Son Güncelleme(?: Tarihi)?|Güncelleme Tarihi|Tarihi\s*:|last-update-time)[^\d]*(\d{1,2}[./-]\d{1,2}[./-]\d{4}(?:\s+\d{1,2}:\d{2})?)/i);
  return match?.[1] || null;
}
function sourceInfo(resource) {
  const published = sourceDate(resource.text);
  const lastModified = resource.lastModified ? formatDateTime(resource.lastModified) : null;
  return {
    sourceDate: published || null,
    checkedAt: resource.checkedAt,
    dateLabel: published ? `Kaynak tarihi: ${published}` : lastModified ? `HTTP son değişiklik: ${lastModified}` : 'Kaynak tarihi yayınlanmıyor',
  };
}
function tableRows(html) {
  const rows = [];
  for (const row of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(match => cleanHtml(match[1]));
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}
function parseAytemiz(html, kind = 'base') {
  const prices = {};
  const rows = [...String(html).matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr\b|<\/tbody>|<\/table>)/gi)];
  for (const row of rows) {
    const label = row[1].match(/<td[^>]*>(?:<span[^>]*>)?\s*([^<]+)\s*(?:<\/span>)?/i)?.[1];
    const key = canonicalKey(cleanHtml(label));
    const values = numberList(cleanHtml(row[1]));
    if (!key || !values.length || /^(IL|İL|SEHIR|ŞEHİR|CITY)$/i.test(key)) continue;
    if (kind === 'lpg') prices[key] = { lpg: values[0] };
    else if (values.length >= 2) prices[key] = { benzin: values[0], motorin: values[1] };
  }
  return prices;
}
function parseSunpet(html) {
  const prices = {};
  for (const cells of tableRows(html)) {
    const key = canonicalKey(cells[0]);
    const values = numberList(cells.slice(1).join(' '));
    if (!key || values.length < 2 || /^(IL|İL|SEHIR|ŞEHİR|CITY)$/i.test(key)) continue;
    prices[key] = { benzin: values[0], motorin: values[1] };
  }
  return prices;
}
function parsePetrolOfisi(html) {
  const prices = {};
  for (const row of String(html).matchAll(/<tr[^>]*data-disctrict-name="([^"]+)"[\s\S]*?<\/tr>/gi)) {
    const values = [...row[0].matchAll(/class="with-tax"[^>]*>\s*([\d.,]+)/gi)].map(match => Number(match[1].replace(',', '.')));
    if (values.length >= 6) prices[canonicalKey(row[1])] = { benzin: values[0], motorin: values[1], lpg: values[5] };
  }
  return prices;
}
async function fetchResource(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 18000) : null;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller?.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), lastModified: response.headers.get('last-modified'), checkedAt: formatDateTime() };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function cityUrl(city, type, source) {
  const citySlug = slug(city);
  if (source === 'aytemiz') return type === 'lpg' ? `https://www.aytemiz.com.tr/akaryakit-fiyatlari/lpg-fiyatlari/${citySlug}-lpg-fiyati.html` : `https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari/${citySlug}-benzin-fiyati.html`;
  if (source === 'sunpet') return `https://www.sunpettr.com.tr/yakit-fiyatlari-${citySlug}`;
  return null;
}
function sunpetUrls(city) {
  return normalize(city) === 'ISTANBUL'
    ? ['https://www.sunpettr.com.tr/yakit-fiyatlari-istanbul-anadolu', 'https://www.sunpettr.com.tr/yakit-fiyatlari-istanbul-avrupa']
    : [cityUrl(city, 'base', 'sunpet')];
}
async function loadProviders(city) {
  const jobs = [
    { id: 'petrolOfisi', source: FUEL_SOURCES.petrolOfisi, run: async () => { const page = await fetchResource(FUEL_SOURCES.petrolOfisi.url); return { prices: parsePetrolOfisi(page.text), ...sourceInfo(page), url: FUEL_SOURCES.petrolOfisi.url }; } },
    { id: 'aytemiz', source: FUEL_SOURCES.aytemiz, run: async () => { const [baseResult, lpgResult] = await Promise.allSettled([fetchResource(cityUrl(city, 'base', 'aytemiz')), fetchResource(cityUrl(city, 'lpg', 'aytemiz'))]); const basePage = baseResult.status === 'fulfilled' ? baseResult.value : null; const lpgPage = lpgResult.status === 'fulfilled' ? lpgResult.value : null; const prices = parseAytemiz(basePage?.text || '', 'base'); Object.assign(prices, mergeMaps(prices, parseAytemiz(lpgPage?.text || '', 'lpg'))); if (!Object.keys(prices).length) throw new Error('Aytemiz tablosu okunamadı'); const info = sourceInfo(basePage || lpgPage); if (!info.sourceDate && lpgPage) Object.assign(info, sourceInfo(lpgPage)); return { prices, ...info, url: FUEL_SOURCES.aytemiz.url }; } },
    { id: 'sunpet', source: FUEL_SOURCES.sunpet, run: async () => { const responses = await Promise.all(sunpetUrls(city).map(async url => ({ url, page: await fetchResource(url) }))); const prices = responses.reduce((all, item) => mergeMaps(all, parseSunpet(item.page.text)), {}); if (!Object.keys(prices).length) throw new Error('Sunpet tablosu okunamadı'); const info = sourceInfo(responses[0].page); const dated = responses.map(item => sourceInfo(item.page)).find(item => item.sourceDate); if (!info.sourceDate && dated) Object.assign(info, dated); return { prices, ...info, url: responses[0].url }; } },
  ];
  const settled = await Promise.all(jobs.map(async job => { try { return { ...job, result: await job.run(), ok: true }; } catch (error) { return { ...job, ok: false, error: error instanceof Error ? error.message : String(error) }; } }));
  return settled;
}
function mergeMaps(left, right) {
  const merged = { ...left };
  for (const [key, value] of Object.entries(right || {})) merged[key] = { ...(merged[key] || {}), ...value };
  return merged;
}
function resolveSourcePrice(provider, district, city, type) {
  const keys = [canonicalKey(district), regionFor(city, district), canonicalKey(city)];
  for (const key of keys) {
    const value = finite(provider.result?.prices?.[key]?.[type]);
    if (value != null) return value;
  }
  return null;
}
function formatFetchedAt() {
  return new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}
function rowsFromProviders({ city, type, providers }) {
  const locationItems = city === 'İstanbul' ? districts : [{ name:city }];
  const rows = locationItems.map(item => {
    const sourceValues = providers.filter(provider => provider.ok).map(provider => {
      const price = resolveSourcePrice(provider, item.name, city, type);
      return price == null ? null : { id: provider.id, name: provider.source.name, price, url: provider.result.url, sourceDate: provider.result.sourceDate || null, dateLabel: provider.result.dateLabel || 'Kaynak tarihi yayınlanmıyor', checkedAt: provider.result.checkedAt || null };
    }).filter(Boolean);
    const price = sourceValues.length ? round(sourceValues.reduce((sum, record) => sum + record.price, 0) / sourceValues.length) : null;
    const dateLabels = [...new Set(sourceValues.map(record => record.dateLabel).filter(Boolean))];
    const checkedAt = sourceValues.map(record => record.checkedAt).filter(Boolean).sort().at(-1);
    const updatedAt = sourceValues.length ? `${dateLabels.join(' · ')}${checkedAt ? ` · Kontrol: ${checkedAt}` : ''}` : 'Canlı veri alınamadı';
    return { city, district: item.name, price, updatedAt, source: sourceValues.map(record => record.name).join(' + ') || 'Gösterim yok', sourceCount: sourceValues.length, sourceValues, live: price != null, trusted: sourceValues.length >= 2, cityReference: sourceValues.some(record => record.id === 'petrolOfisi'), sourceUrl: sourceValues[0]?.url || FUEL_SOURCES.epdk.url, type };
  });
  return rows;
}
async function directPrices({ city, type }) {
  const providers = await loadProviders(city);
  const rows = rowsFromProviders({ city, type, providers });
  const sourceSummary = providers.map(provider => ({ id: provider.id, name: provider.source.name, url: provider.result?.url || provider.source.url, ok: provider.ok, sourceDate: provider.result?.sourceDate || null, dateLabel: provider.result?.dateLabel || (provider.ok ? 'Kaynak tarihi yayınlanmıyor' : null), checkedAt: provider.result?.checkedAt || null, error: provider.error || null }));
  const maxSources = Math.max(0, ...rows.map(row => row.sourceCount));
  rows.meta = {
    live: rows.some(row => row.live),
    trusted: rows.some(row => row.trusted),
    sourceCount: maxSources,
    average: maxSources >= 2,
    sources: sourceSummary,
    authority: FUEL_SOURCES.epdk,
    checkedAt: formatDateTime(),
    note: maxSources >= 2 ? `Aynı ilçe/il referansına ait ${maxSources} birinci taraf dağıtıcı verisinin basit aritmetik ortalaması gösteriliyor.` : maxSources === 1 ? 'Yalnızca tek canlı kaynak okunabildi; ortalama iddiası yapılmıyor.' : 'Kaynaklara erişilemediği için sahte veya eski rakam gösterilmiyor.',
  };
  return rows;
}
export async function getFuelPrices({ city = 'İstanbul', type = 'benzin' } = {}) {
  if (typeof window !== 'undefined') {
    try {
      const proxy = await fetch(`/api/fuel-prices?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`, { cache: 'no-store' });
      if (proxy.ok) {
        const payload = await proxy.json();
        if (Array.isArray(payload.rows)) { payload.rows.meta = payload.meta; return payload.rows; }
      }
    } catch (error) { /* Native APK veya statik preview doğrudan kaynakları dener. */ }
  }
  return directPrices({ city, type });
}
