const EPDK_FUEL = 'https://lisansws.epdk.gov.tr/services/bildirimPetrolAkaryakitFiyatlari';
const EPDK_LPG = 'https://lisansws.epdk.gov.tr/services/bildirimLPGTarife';
const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

const clean = value => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const decode = value => String(value || '')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
const numberValues = value => [...String(value || '').replace(',', '.').matchAll(/\b(\d{1,3}(?:\.\d{1,3})?)\b/g)].map(match => Number(match[1])).filter(value => Number.isFinite(value) && value > 5 && value < 200);
const isoNow = () => new Date().toISOString();

async function getText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, cache:'no-store', signal:controller.signal, headers:{ 'User-Agent':'YakitAlarmi/early-warning', ...(options.headers || {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return text;
  } finally { clearTimeout(timer); }
}

async function epdkXml(url, code) {
  const urls = [
    `${url}?sorguNo=72&parametre=${encodeURIComponent(code)}`,
    `${url}?sorguNo=72&parametreler=${encodeURIComponent(code)}`,
  ];
  let lastError = null;
  for (const candidate of urls) {
    try { return await getText(candidate); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('EPDK servisi cevap vermedi.');
}

function leafFields(xml) {
  const text = decode(xml);
  return [...text.matchAll(/<([A-Za-z_][\w:.-]*)[^>]*>\s*([^<>]{1,260}?)\s*<\/\1>/g)].map(match => ({ tag:match[1].toLocaleLowerCase('tr-TR'), value:clean(match[2]) }));
}

export function classifyPriceRows(xml) {
  const fields = leafFields(xml);
  const result = { benzin:null, motorin:null, lpg:null };
  const typeFor = value => {
    const text = value.toLocaleLowerCase('tr-TR');
    if (/lpg|otogaz|propan|bütan/.test(text)) return 'lpg';
    if (/motorin|euro ?diesel|diesel/.test(text)) return 'motorin';
    if (/benzin|kurşunsuz|95 ?oktan|gasoline/.test(text)) return 'benzin';
    return null;
  };
  for (let index=0; index<fields.length; index += 1) {
    const type = typeFor(`${fields[index].tag} ${fields[index].value}`);
    if (!type || result[type] != null) continue;
    const ownValues = numberValues(fields[index].value).filter(value => value > 5 && value < 200);
    const nearby = [...fields.slice(index + 1, index + 9).map(field => field.value), ...fields.slice(Math.max(0,index - 3), index).map(field => field.value)];
    const values = (ownValues.length ? ownValues : nearby.flatMap(numberValues)).filter(value => value > 5 && value < 200);
    if (values.length) result[type] = values[0];
  }
  const fallback = clean(decode(xml));
  for (const type of ['benzin','motorin','lpg']) {
    if (result[type] != null) continue;
    const label = type === 'benzin' ? '(?:benzin|kurşunsuz|95 ?oktan)' : type === 'motorin' ? '(?:motorin|euro ?diesel|diesel)' : '(?:lpg|otogaz)';
    const match = fallback.match(new RegExp(label + '[\\s\\S]{0,160}?([0-9]{1,3}[.,][0-9]{1,3})', 'i'));
    if (match) result[type] = Number(match[1].replace(',', '.'));
  }
  return result;
}

function parseUsd(xml) {
  const match = String(xml || '').match(/(?:Kod|CurrencyCode)\s*=\s*["']USD["'][\s\S]{0,700}?(?:ForexSelling|BanknoteSelling|selling)[^>]*>\s*([0-9.,]+)/i);
  if (match) return Number(match[1].replace(',', '.'));
  const nearby = String(xml || '').match(/USD[\s\S]{0,1000}?([0-9]+[.,][0-9]+)/i);
  return nearby ? Number(nearby[1].replace(',', '.')) : null;
}
function riskScore(priceNow, previousPrice, usdNow, previousUsd) {
  if (![priceNow, previousPrice, usdNow, previousUsd].every(value => Number.isFinite(Number(value))) || Number(previousPrice) === 0 || Number(previousUsd) === 0) return { level:'VERİ YOK', score:null, pressure:null, reason:'Trend için en az iki tarihli canlı ölçüm gerekir.' };
  const fuelMove = ((Number(priceNow) - Number(previousPrice)) / Number(previousPrice)) * 100;
  const usdMove = ((Number(usdNow) - Number(previousUsd)) / Number(previousUsd)) * 100;
  const pressure = Math.max(0, usdMove) * 0.55 + Math.max(0, fuelMove) * 0.45;
  if (pressure >= 1.5) return { level:'ÇOK YÜKSEK', score:Math.min(100, Math.round(70 + pressure * 10)), pressure, fuelMove, usdMove };
  if (pressure >= 0.7) return { level:'YÜKSEK', score:Math.min(99, Math.round(55 + pressure * 15)), pressure, fuelMove, usdMove };
  if (pressure >= 0.25) return { level:'ORTA', score:Math.min(90, Math.round(35 + pressure * 20)), pressure, fuelMove, usdMove };
  return { level:'DÜŞÜK', score:Math.max(5, Math.round(pressure * 40)), pressure, fuelMove, usdMove };
}

export async function getEarlyWarningLive({ provinceCode='34' } = {}) {
  const code = String(provinceCode).padStart(2, '0');
  const [fuel, lpg, usd] = await Promise.allSettled([epdkXml(EPDK_FUEL, code), epdkXml(EPDK_LPG, code), getText(TCMB_URL)]);
  const errors = [];
  const prices = { benzin:null, motorin:null, lpg:null };
  let sourceDate = null;
  if (fuel.status === 'fulfilled') Object.assign(prices, classifyPriceRows(fuel.value)); else errors.push(`EPDK akaryakıt: ${fuel.reason?.message || 'yanıt yok'}`);
  if (lpg.status === 'fulfilled') prices.lpg = classifyPriceRows(lpg.value).lpg ?? prices.lpg; else errors.push(`EPDK LPG: ${lpg.reason?.message || 'yanıt yok'}`);
  const usdTry = usd.status === 'fulfilled' ? parseUsd(usd.value) : null;
  if (usd.status === 'rejected') errors.push(`TCMB: ${usd.reason?.message || 'yanıt yok'}`);
  const dateMatch = `${fuel.status === 'fulfilled' ? fuel.value : ''} ${lpg.status === 'fulfilled' ? lpg.value : ''}`.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
  if (dateMatch) sourceDate = dateMatch[1];
  const hasFuel = Object.values(prices).some(value => Number.isFinite(value));
  return { ok:hasFuel, province:code, prices, usdTry:Number.isFinite(usdTry) ? usdTry : null, timestamp:isoNow(), sourceDate, checkedAt:new Date().toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}), source:{ epdk:'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat', epdkFuel:EPDK_FUEL, epdkLpg:EPDK_LPG, tcmb:TCMB_URL }, errors, disclaimer:'Bu skor kesin zam tahmini değildir. EPDK/TCMB canlı ölçümü ve cihazda biriken en az iki tarihli kayıtla hesaplanan erken uyarı baskı göstergesidir.' };
}

export { riskScore };
