import { districts, provinces } from '../data/fixtures.js';
import { provinceCoordinates } from '../data/province-coordinates.js';
import { moilCityIds } from '../data/moil-city-ids.js';
import { provinceCodes } from '../data/province-codes.js';
import { NSOFT_FUEL_API_KEY as BUILD_NSOFT_FUEL_API_KEY } from '../runtime-config.js';

export const FUEL_SOURCES = {
  epdk: {
    name: 'EPDK resmi akaryakıt fiyatları',
    role: 'Resmi otorite; fiili pompa fiyatı, illere göre rapor ve web servis referansı',
    url: 'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat',
    serviceUrl: 'https://lisansws.epdk.gov.tr/services/bildirimPetrolAkaryakitFiyatlari?wsdl',
    authority: true,
  },
  petrolOfisi: { name: 'Petrol Ofisi', role: 'Tarih damgalı ticari pompa karşılaştırması', url: 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari' },
  aytemiz: { name: 'Aytemiz', role: 'Tarih damgalı tavsiye edilen pompa fiyatı', url: 'https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari' },
  sunpet: { name: 'Sunpet', role: 'Tarih damgalı tavsiye edilen pompa fiyatı', url: 'https://www.sunpettr.com.tr/yakit-fiyatlari' },
  moil: { name: 'M Oil', role: 'Tarih damgalı ilçe pompa fiyatı', url: 'https://moil.com.tr/akaryakit-fiyatlari' },
  lukoil: { name: 'Lukoil Türkiye', role: 'Tarih damgalı pompa ve LPG fiyatı', url: 'https://www.lukoil.com.tr/akaryakit-fiyatlari' },
  nsoft: { name: 'NSoft Yakıt Alarmı API', role: 'APK’da kullanılan toplu fiyat API’si; BP ürün alanları ve ilçe referansı', url: 'https://api.nsoft.com.tr/fuel/prices' },
  opet: { name: 'Opet', role: 'Fiyat oluşumu ve serbest fiyatlandırma açıklaması', url: 'https://www.opet.com.tr/akaryakit-fiyatlari-nasil-olusur', referenceOnly: true },
};

const ANADOLU = new Set(['Adalar','Ataşehir','Beykoz','Çekmeköy','Kadıköy','Kartal','Maltepe','Pendik','Sancaktepe','Sultanbeyli','Şile','Tuzla','Ümraniye','Üsküdar']);
const TURKISH_MONTHS = { ocak:'01', şubat:'02', mart:'03', nisan:'04', mayıs:'05', haziran:'06', temmuz:'07', ağustos:'08', eylül:'09', ekim:'10', kasım:'11', aralık:'12' };
const slug = value => String(value || 'istanbul').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\u0307/g, '').replace(/[çğıöşü]/g, letter => ({ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}[letter] || letter)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const upperSlug = value => slug(value).replace(/-/g, '_').toUpperCase();
const nsoftApiKey = () => (typeof process !== 'undefined' && process.env?.NSOFT_FUEL_API_KEY) || BUILD_NSOFT_FUEL_API_KEY || '';
const normalize = value => String(value || '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/İ/g, 'I').replace(/[^A-Z0-9()/_ ]/g, ' ').replace(/\s+/g, ' ').trim();
const numberPattern = /\b(\d{1,3})[.,](\d{2})\b/g;
const numberList = value => [...String(value || '').matchAll(numberPattern)].map(match => Number(`${match[1]}.${match[2]}`));
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => Math.round(value * 100) / 100;
const canonicalKey = value => {
  const key = normalize(value).replace(/\s*\/\s*/g, ' / ');
  if (key.includes('ISTANBUL') && key.includes('ANADOLU')) return 'ISTANBUL (ANADOLU)';
  if (key.includes('ISTANBUL') && key.includes('AVRUPA')) return 'ISTANBUL (AVRUPA)';
  return key;
};
const cityAliases = { AFYONKARAHISAR: 'AFYON', MERSIN: 'ICEL' };
const cityKey = value => cityAliases[canonicalKey(value).replace(/[() ]/g, '')] || canonicalKey(value);

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&uuml;/gi, 'ü').replace(/&Uuml;/g, 'Ü').replace(/&ouml;/gi, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&ccedil;/gi, 'ç').replace(/&Ccedil;/g, 'Ç').replace(/&scedil;/gi, 'ş').replace(/&Scedil;/g, 'Ş');
}
function cleanHtml(value) {
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('tr-TR', { dateStyle:'short', timeStyle:'short', timeZone:'Europe/Istanbul' });
}
function normalizeSourceDate(value) {
  if (!value) return null;
  const text = cleanHtml(value);
  const numeric = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (numeric) return `${numeric[1].padStart(2,'0')}.${numeric[2].padStart(2,'0')}.${numeric[3]}`;
  const named = text.match(/(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})/i);
  if (named) return `${named[1].padStart(2,'0')}.${TURKISH_MONTHS[named[2].toLocaleLowerCase('tr-TR')]}.${named[3]}`;
  return null;
}
function sourceDateKey(value) {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
}
function sourceDate(html) {
  const text = cleanHtml(html);
  const documented = [...text.matchAll(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(?:tarihli|tarihinde|tarihli fiyat)/gi)].map(match => normalizeSourceDate(match[1])).filter(Boolean).at(-1);
  const labeled = [...text.matchAll(/(?:Son Güncelleme(?: Tarihi)?|Güncelleme Tarihi|Fiyat Tarihi|Geçerlilik Tarihi|Tarih|Fiyatlar\s*\()[^\d]{0,100}((?:\d{1,2}[./-]\d{1,2}[./-]\d{4})|(?:\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+\d{4}))/gi)];
  const labeledDate = labeled.map(match => normalizeSourceDate(match[1])).filter(Boolean).at(-1);
  return documented || labeledDate || normalizeSourceDate(text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/)?.[0]);
}
function sourceInfo(resource) {
  const published = sourceDate(resource.text);
  const lastModified = resource.lastModified ? formatDateTime(resource.lastModified) : null;
  return { sourceDate: published || null, checkedAt: resource.checkedAt, dateLabel: published ? `Kaynak tarihi: ${published}` : lastModified ? `HTTP son değişiklik: ${lastModified}` : 'Kaynak tarihi yayınlanmıyor' };
}
function apiDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : normalizeSourceDate(text);
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
function parseMoil(html) {
  const prices = {};
  for (const cells of tableRows(html)) {
    const key = canonicalKey(cells[0]);
    const values = numberList(cells.slice(1).join(' '));
    if (!key || values.length < 3 || /^(IL|İL|ILCE|İLÇE|SEHIR|ŞEHİR)$/i.test(key)) continue;
    prices[key] = { benzin: values[0], motorin: values[2] };
  }
  return prices;
}
function parseLukoil(html, kind = 'base') {
  const prices = {};
  for (const cells of tableRows(html)) {
    const key = canonicalKey(cells[0]);
    const values = numberList(cells.slice(1).join(' '));
    if (!key || !values.length || /^(IL|İL|ILCE|İLÇE|SEHIR|ŞEHİR|CITY)$/i.test(key)) continue;
    if (kind === 'lpg') prices[key] = { lpg: values[0] };
    else if (values.length >= 3) prices[key] = { benzin: values[0], motorin: values[2] };
  }
  return prices;
}
function productPrice(products, keys) {
  const values = keys.map(key => products?.[key]).map(value => {
    if (value && typeof value === 'object') return finite(value.price_incl_tax ?? value.kdv_dahil ?? value.price);
    return finite(String(value || '').replace(',', '.'));
  }).filter(value => value != null && value > 0);
  return values.length ? Math.min(...values) : null;
}
function parseNsoft(payload, type = 'benzin') {
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : Array.isArray(payload?.data) ? payload.data[0] : payload;
  const districts = data?.districts || data?.ilceler || [];
  const keys = type === 'motorin' ? ['bp_diesel','bp_ultimate_diesel','motorin','diesel'] : type === 'lpg' ? ['otogaz','lpg'] : ['bp_kursunsuz','bp_ultimate_kursunsuz','kursunsuz','benzin'];
  const prices = {};
  for (const district of districts) {
    const name = district?.name || district?.ilce_adi || district?.ilce || district?.adi;
    const products = district?.products || district?.fiyatlar || district?.prices || district;
    const price = productPrice(products, keys);
    if (name && price != null) prices[canonicalKey(name)] = { [type]: round(price) };
  }
  return { prices, sourceDate: apiDate(data?.price_date || payload?.meta?.price_date), generatedAt: payload?.meta?.generated_at || null, cityName: data?.name || null, districtCount: districts.length };
}
function averageMap(prices, city) {
  const result = {};
  const totals = {};
  for (const values of Object.values(prices || {})) {
    for (const type of ['benzin','motorin','lpg']) {
      const number = finite(values?.[type]);
      if (number == null) continue;
      totals[type] ||= { sum:0, count:0 };
      totals[type].sum += number;
      totals[type].count += 1;
    }
  }
  const avg = {};
  for (const [type, item] of Object.entries(totals)) avg[type] = round(item.sum / item.count);
  if (Object.keys(avg).length) result[cityKey(city)] = avg;
  return result;
}
function mergeMaps(left, right) {
  const merged = { ...left };
  for (const [key, value] of Object.entries(right || {})) merged[key] = { ...(merged[key] || {}), ...value };
  return merged;
}
async function fetchResource(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 18000) : null;
  try {
    const response = await fetch(url, { cache:'no-store', signal:controller?.signal, headers:{ 'User-Agent':'YakitAlarmi/1.0 live-price-reader' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), lastModified: response.headers.get('last-modified'), checkedAt: formatDateTime() };
  } finally { if (timer) clearTimeout(timer); }
}
function cityUrl(city, type, source) {
  const citySlug = slug(city);
  if (source === 'aytemiz') return type === 'lpg' ? `https://www.aytemiz.com.tr/akaryakit-fiyatlari/lpg-fiyatlari/${citySlug}-lpg-fiyati.html` : `https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari/${citySlug}-benzin-fiyati.html`;
  if (source === 'sunpet') return `https://www.sunpettr.com.tr/yakit-fiyatlari-${citySlug}`;
  if (source === 'lukoil') return `https://www.lukoil.com.tr/akaryakit-fiyatlari?priceType=${type === 'lpg' ? 'lpg' : 'pompa'}&priceDate=${new Date().toISOString().slice(0,10)}&cityName=${upperSlug(city)}`;
  if (source === 'moil') {
    const alias = cityKey(city) === 'ICEL' ? 'İçel' : city;
    const entry = Object.entries(moilCityIds).find(([name]) => cityKey(name) === cityKey(alias) || (cityKey(city) === 'AFYONKARAHISAR' && cityKey(name) === 'AFYON'));
    return entry ? `https://moil.com.tr/akaryakit-fiyatlari?il=${entry[1]}` : null;
  }
  return null;
}
function sunpetUrls(city) { return normalize(city) === 'ISTANBUL' ? ['https://www.sunpettr.com.tr/yakit-fiyatlari-istanbul-anadolu','https://www.sunpettr.com.tr/yakit-fiyatlari-istanbul-avrupa'] : [cityUrl(city, 'base', 'sunpet')]; }
function moilUrl(city) { return cityUrl(city, 'base', 'moil'); }
function lukoilUrl(city, type) { return cityUrl(city, type, 'lukoil'); }

async function loadProviders(city, type = 'benzin') {
  const jobs = [
    { id:'nsoft', source:FUEL_SOURCES.nsoft, run:async()=>{
      const key=nsoftApiKey();
      if(!key) throw new Error('NSoft API anahtarı yapılandırılmadı');
      const controller=typeof AbortController!=='undefined'?new AbortController():null;
      const timer=controller?setTimeout(()=>controller.abort(),18000):null;
      try {
        const cityCode=provinceCodes[city];
        if(!cityCode) throw new Error('NSoft için seçili ilin plaka kodu bulunamadı');
        const response=await fetch(`https://api.nsoft.com.tr/fuel/prices?city=${encodeURIComponent(cityCode)}`,{cache:'no-store',signal:controller?.signal,headers:{Accept:'application/json','X-Api-Key':key,'User-Agent':'YakitAlarmi/1.0 live-price-reader'}});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload=await response.json();
        if(payload?.success!==true) throw new Error(payload?.error || 'NSoft API başarısız yanıt verdi');
        const parsed=parseNsoft(payload,type);
        if(!Object.keys(parsed.prices).length) throw new Error('NSoft API’de seçili yakıt türü için fiyat satırı yok');
        return { prices:parsed.prices, averages:averageMap(parsed.prices,city), sourceDate:parsed.sourceDate, checkedAt:formatDateTime(), dateLabel:parsed.sourceDate?`Kaynak tarihi: ${parsed.sourceDate}`:'Kaynak tarihi yayınlanmıyor', url:`https://api.nsoft.com.tr/fuel/prices?city=${encodeURIComponent(cityCode)}`, generatedAt:parsed.generatedAt, cityName:parsed.cityName, districtCount:parsed.districtCount };
      } finally { if(timer) clearTimeout(timer); }
    } },
    { id:'petrolOfisi', source:FUEL_SOURCES.petrolOfisi, run:async()=>{ const page=await fetchResource(FUEL_SOURCES.petrolOfisi.url); const prices=parsePetrolOfisi(page.text); return { prices, averages:averageMap(prices,city), ...sourceInfo(page), url:FUEL_SOURCES.petrolOfisi.url }; } },
    { id:'aytemiz', source:FUEL_SOURCES.aytemiz, run:async()=>{ const urls=[cityUrl(city,'base','aytemiz'),cityUrl(city,'lpg','aytemiz')].filter(Boolean); const results=await Promise.allSettled(urls.map(fetchResource)); const base=results[0]?.status==='fulfilled'?results[0].value:null; const lpg=results[1]?.status==='fulfilled'?results[1].value:null; const prices=mergeMaps(parseAytemiz(base?.text || '','base'),parseAytemiz(lpg?.text || '','lpg')); if(!Object.keys(prices).length) throw new Error('Aytemiz tablosu okunamadı'); const relevant=type==='lpg'?lpg:base; const info=sourceInfo(relevant||base||lpg); return { prices, averages:averageMap(prices,city), ...info, url:(type==='lpg'?urls[1]:urls[0]) || FUEL_SOURCES.aytemiz.url }; } },
    { id:'sunpet', source:FUEL_SOURCES.sunpet, run:async()=>{ const responses=await Promise.all(sunpetUrls(city).map(async url=>({url,page:await fetchResource(url)}))); const prices=responses.reduce((all,item)=>mergeMaps(all,parseSunpet(item.page.text)),{}); if(!Object.keys(prices).length) throw new Error('Sunpet tablosu okunamadı'); const info=sourceInfo(responses.find(item=>item.page)?.page); const dated=responses.map(item=>sourceInfo(item.page)).find(item=>item.sourceDate); if(!info.sourceDate&&dated)Object.assign(info,dated); return { prices, averages:averageMap(prices,city), ...info, url:responses[0].url }; } },
    { id:'moil', source:FUEL_SOURCES.moil, run:async()=>{ const url=moilUrl(city); if(!url) throw new Error('MOIL il kodu bulunamadı'); const page=await fetchResource(url); const prices=parseMoil(page.text); if(!Object.keys(prices).length) throw new Error('M Oil tablosu okunamadı'); return { prices, averages:averageMap(prices,city), ...sourceInfo(page), url }; } },
    { id:'lukoil', source:FUEL_SOURCES.lukoil, run:async()=>{ const urls=[lukoilUrl(city,'base'),lukoilUrl(city,'lpg')]; const results=await Promise.allSettled(urls.map(fetchResource)); const base=results[0]?.status==='fulfilled'?results[0].value:null; const lpg=results[1]?.status==='fulfilled'?results[1].value:null; const prices=mergeMaps(parseLukoil(base?.text || '','base'),parseLukoil(lpg?.text || '','lpg')); if(!Object.keys(prices).length) throw new Error('Lukoil tablosu okunamadı'); const relevant=type==='lpg'?lpg:base; const info=sourceInfo(relevant||base||lpg); return { prices, averages:averageMap(prices,city), ...info, url:(type==='lpg'?urls[1]:urls[0]) || FUEL_SOURCES.lukoil.url }; } },
  ];
  return Promise.all(jobs.map(async job => { try { return { ...job, result:await job.run(), ok:true }; } catch (error) { return { ...job, ok:false, error:error instanceof Error?error.message:String(error) }; } }));
}
function regionFor(city, district) { if (normalize(city) !== 'ISTANBUL') return canonicalKey(city); return canonicalKey(`İstanbul (${ANADOLU.has(district) ? 'Anadolu' : 'Avrupa'})`); }
function resolveSourcePrice(provider, district, city, type) {
  const keys=[canonicalKey(district),regionFor(city,district),canonicalKey(city),cityKey(city)];
  for(const key of keys) { const value=finite(provider.result?.prices?.[key]?.[type]); if(value!=null)return value; }
  if (normalize(city) !== 'ISTANBUL' && canonicalKey(district) === canonicalKey(city)) return finite(provider.result?.averages?.[cityKey(city)]?.[type]);
  return null;
}
function providerRecord(provider, price) { return { id:provider.id, name:provider.source.name, price, url:provider.result.url, sourceDate:provider.result.sourceDate||null, dateLabel:provider.result.dateLabel||'Kaynak tarihi yayınlanmıyor', checkedAt:provider.result.checkedAt||null }; }
function locationItems(city) { return city === 'İstanbul' ? districts : [{ name:city }]; }
function rowsFromProviders({ city, type, providers, referenceCity=null }) {
  const rows = locationItems(city).map(item => {
    const sourceValues=providers.filter(provider=>provider.ok).map(provider=>{ const price=resolveSourcePrice(provider,item.name,referenceCity||city,type); return price==null?null:providerRecord(provider,price); }).filter(Boolean);
    const dated=sourceValues.map(record=>record.sourceDate).filter(Boolean);
    const currentDate=dated.slice().sort((a,b)=>sourceDateKey(b)-sourceDateKey(a))[0] || null;
    const strictDateSet=dated.length >= 2;
    const todayDate=normalizeSourceDate(formatDateTime());
    const sourceDateIsStale=Boolean(currentDate && todayDate && sourceDateKey(currentDate)<sourceDateKey(todayDate));
    const activeDate=sourceDateIsStale && !strictDateSet ? null : currentDate;
    const aligned=activeDate ? strictDateSet ? sourceValues.filter(record=>record.sourceDate===activeDate) : sourceValues.filter(record=>!record.sourceDate || record.sourceDate===activeDate) : sourceDateIsStale && !strictDateSet ? sourceValues.filter(record=>!record.sourceDate) : sourceValues;
    const excluded=activeDate ? sourceValues.filter(record=>strictDateSet ? record.sourceDate!==activeDate : Boolean(record.sourceDate && record.sourceDate!==activeDate)).map(record=>({ ...record, exclusionReason:record.sourceDate ? 'Eski tarihli' : 'Kaynak tarihi doğrulanamadı' })) : sourceDateIsStale && !strictDateSet ? sourceValues.filter(record=>record.sourceDate).map(record=>({ ...record, exclusionReason:'Eski tarihli' })) : [];
    const price=aligned.length?round(aligned.reduce((sum,record)=>sum+record.price,0)/aligned.length):null;
    const dateLabels=[...new Set(aligned.map(record=>record.dateLabel).filter(Boolean))];
    const checkedAt=aligned.map(record=>record.checkedAt).filter(Boolean).sort().at(-1);
    const staleNote=excluded.length?` · Eski tarihli kaynak dışarıda: ${excluded.map(record=>record.name).join(', ')}`:'';
    const dateAligned=Boolean(activeDate && !sourceDateIsStale && strictDateSet && aligned.length>=2 && aligned.every(record=>record.sourceDate===activeDate));
    return { city, district:item.name, price, updatedAt:aligned.length?`${dateLabels.join(' · ')}${checkedAt?` · Kontrol: ${checkedAt}`:''}${staleNote}`:'Canlı veri alınamadı', source:aligned.map(record=>record.name).join(' + ')||'Gösterim yok', sourceCount:aligned.length, sourceValues:aligned, excludedSourceValues:excluded, sourceDate:activeDate, dateAligned, live:price!=null, trusted:aligned.length>=2 && dateAligned, cityReference:Boolean(referenceCity||aligned.some(record=>record.id==='petrolOfisi')), referenceCity:referenceCity||null, sourceUrl:aligned[0]?.url||FUEL_SOURCES.epdk.url, type };
  });
  return rows;
}
function sourceSummary(providers) { return providers.map(provider=>({ id:provider.id, name:provider.source.name, url:provider.result?.url||provider.source.url, ok:provider.ok, sourceDate:provider.result?.sourceDate||null, dateLabel:provider.result?.dateLabel||(provider.ok?'Kaynak tarihi yayınlanmıyor':null), checkedAt:provider.result?.checkedAt||null, error:provider.error||null })); }
export function nearbyProvinces(city, limit=3) {
  const target=provinceCoordinates[city];
  if(!target) return [];
  const distance=(a,b)=>{ const rad=Math.PI/180; const dLat=(b[0]-a[0])*rad; const dLon=(b[1]-a[1])*rad; const h=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2; return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); };
  return provinces.filter(name=>name!==city&&provinceCoordinates[name]).map(name=>({name,km:distance(target,provinceCoordinates[name])})).sort((a,b)=>a.km-b.km).slice(0,limit).map(item=>item.name);
}
async function directPrices({city,type}) {
  const providers=await loadProviders(city,type);
  let rows=rowsFromProviders({city,type,providers});
  let usedNearby=[];
  if(!rows.some(row=>row.live)) {
    for(const nearby of nearbyProvinces(city,3)) {
      const nearbyProviders=await loadProviders(nearby,type);
      const nearbyRows=rowsFromProviders({city,type,providers:nearbyProviders,referenceCity:nearby});
      const live=nearbyRows.find(row=>row.live);
      if(live) { rows=locationItems(city).map(item=>({...live,district:item.name,city,cityReference:true,referenceCity:nearby,updatedAt:`${live.updatedAt} · Çevre il referansı: ${nearby}`})); usedNearby=[nearby]; break; }
    }
  }
  const maxSources=Math.max(0,...rows.map(row=>row.sourceCount));
  const trustedRows=rows.filter(row=>row.trusted);
  const staleSources=[...new Set(rows.flatMap(row=>(row.excludedSourceValues||[]).map(record=>record.name)))];
  const note=usedNearby.length?`Seçili ilde doğrudan canlı satır bulunamadı; ${usedNearby.join(', ')} çevre ilinin tarihli canlı ortalaması gösteriliyor.`:trustedRows.length?`Aynı ilçe/il referansına ait tarih uyumu doğrulanmış ${Math.max(...trustedRows.map(row=>row.sourceCount))} canlı veri sağlayıcısının basit aritmetik ortalaması gösteriliyor.`:maxSources>=2?'Birden fazla canlı kaynak okundu ancak kaynak tarihleri aynı veya doğrulanabilir olmadığı için doğrulanmış ortalama etiketi kullanılmıyor.':'Yalnızca tek canlı kaynak okundu; ortalama iddiası yapılmıyor.';
  rows.meta={ live:rows.some(row=>row.live), trusted:rows.some(row=>row.trusted), sourceCount:maxSources, average:trustedRows.length>0, sources:[...sourceSummary(providers),{id:'epdk',name:FUEL_SOURCES.epdk.name,url:FUEL_SOURCES.epdk.url,ok:false,dateLabel:'Resmi rapor/servis referansı; canlı SOAP sorgusu yetki gerektiriyor',checkedAt:null,error:'EPDK resmi servisinde sorgu yetkisi gerekiyor.'}], authority:FUEL_SOURCES.epdk, checkedAt:formatDateTime(), nearby:usedNearby, staleSources, note:staleSources.length?`${note} Tarihi eski veya doğrulanamayan kaynaklar ortalamaya alınmadı: ${staleSources.join(', ')}.`:note };
  return rows;
}
export async function getFuelPrices({city='İstanbul',type='benzin'}={}) {
  if(typeof window!=='undefined') { try { const proxy=await fetch(`/api/fuel-prices?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`,{cache:'no-store'}); if(proxy.ok){ const payload=await proxy.json(); if(Array.isArray(payload.rows)){payload.rows.meta=payload.meta; return payload.rows;} } } catch { /* native APK or direct preview fallback */ } }
  return directPrices({city,type});
}
