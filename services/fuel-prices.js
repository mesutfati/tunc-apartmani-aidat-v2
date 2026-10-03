import { districts } from '../data/fixtures.js';

export const FUEL_SOURCES = {
  epdk: { name:'EPDK resmi fiyat servisi', role:'Birincil otorite ve bayi fiyatı referansı', url:'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat', serviceUrl:'https://lisansws.epdk.gov.tr/services/bildirimPetrolAkaryakitFiyatlari?wsdl' },
  petrolOfisi: { name:'Petrol Ofisi canlı fiyat sayfası', role:'Tarih damgalı ticari pompa karşılaştırması', url:'https://www.petrolofisi.com.tr/akaryakit-fiyatlari' },
};
const cityNames = ['ISTANBUL','ANKARA','IZMIR','ADANA','BURSA','KOCAELI','ANTALYA','MERSIN','KONYA','GAZIANTEP','SAMSUN','TRABZON','SAKARYA','ESKISEHIR','KAYSERI','BALIKESIR','DENIZLI','HATAY','MANISA','MUGLA','AYDIN','TEKIRDAG','EDIRNE','CANAKKALE','BOLU','DİYARBAKIR','DIYARBAKIR','ERZURUM','MALATYA','VAN'];
const aliases = { 'İstanbul':'ISTANBUL', 'Ankara':'ANKARA', 'İzmir':'IZMIR', 'Bursa':'BURSA', 'Kocaeli':'KOCAELI', 'Antalya':'ANTALYA', 'Adana':'ADANA', 'Mersin':'MERSIN' };
const normalize = value => String(value || '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').replace(/[^A-Z0-9() ]/g,' ').replace(/\s+/g,' ').trim();
const num = value => Number(String(value).replace(',', '.'));

function textFromHtml(html) {
  if (typeof DOMParser !== 'undefined') return new DOMParser().parseFromString(html,'text/html').body.textContent.replace(/\s+/g,' ');
  return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
}
function findCitySegment(text, city) {
  const upper = normalize(text); const wanted = normalize(aliases[city] || city); const variants = wanted === 'ISTANBUL' ? ['ISTANBUL (ANADOLU)','ISTANBUL (AVRUPA)','ISTANBUL'] : [wanted];
  for (const variant of variants) {
    const start = upper.indexOf(variant); if (start < 0) continue;
    const next = cityNames.map(name => upper.indexOf(name, start + variant.length)).filter(i => i > start);
    return upper.slice(start, next.length ? Math.min(...next) : start + 700);
  }
  return '';
}
function parsePetrolOfisi(text, city) {
  const segment = findCitySegment(text, city); const values = [...segment.matchAll(/\b(\d{1,3})[ .,](\d{2})\b/g)].map(match => num(`${match[1]}.${match[2]}`));
  if (values.length < 6) return null;
  return { benzin:values[0], motorin:values[1], lpg:values[5] };
}
export async function getFuelPrices({ city='İstanbul', type='benzin' } = {}) {
  let live = null; let liveText = '';
  try {
    const response = await fetch(FUEL_SOURCES.petrolOfisi.url, { credentials:'omit', cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    liveText = await response.text(); live = parsePetrolOfisi(textFromHtml(liveText), city);
  } catch (error) {
    try {
      const proxy = await fetch(`/api/fuel-prices?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`, { cache:'no-store' });
      if (proxy.ok) {
        const payload = await proxy.json();
        if (Array.isArray(payload.rows)) { payload.rows.meta = payload.meta; return payload.rows; }
      }
    } catch (proxyError) { /* APK veya statik yayın proxy olmadan yerel önbelleğe düşer. */ }
    live = null;
  }
  const source = live ? FUEL_SOURCES.petrolOfisi : { name:'Canlı veri alınamadı', role:'Rakam gösterilmiyor; tekrar deneyin.', url:FUEL_SOURCES.epdk.url };
  const liveAt = live ? new Date().toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}) : 'Canlı veri alınamadı';
  const rows = districts.map(item => ({ city, district:item.name, price:live?.[type] ?? null, updatedAt:liveAt, source:live ? source.name : 'Gösterim yok', live:Boolean(live), cityReference:true, sourceUrl:source.url, type }));
  rows.meta = { live:Boolean(live), source, checkedAt:new Date().toISOString(), note:live ? 'İl referans fiyatı canlı olarak okundu; ilçe satırları aynı il referansını gösterir.' : 'Ağ kaynağına erişilemediği için sahte veya eski rakam gösterilmiyor.', epdkPrimary:FUEL_SOURCES.epdk };
  return rows;
}
