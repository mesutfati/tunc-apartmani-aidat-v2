import { SURUS_CEPTE_ALERT_API_URL } from '../runtime-config.js';

const MONTHS = { ocak:1, şubat:2, mart:3, nisan:4, mayıs:5, haziran:6, temmuz:7, ağustos:8, eylül:9, ekim:10, kasım:11, aralık:12 };

export const FUEL_ALERT_FEEDS = [
  { id:'ekonomim', name:'Ekonomim', tier:'İkincil medya', url:'https://www.ekonomim.com/ekonomi/tabela-yine-degisecek-motorine-bir-indirim-daha-geliyor-haberi-922304' },
  { id:'cnnturk', name:'CNN Türk', tier:'İkincil medya', url:'https://www.cnnturk.com/ekonomi/motorine-indirim-geldi-4-ekim-akaryakit-fiyatlari-guncellendi-iste-benzin-motorin-mazot-lpg-akaryakit-fiyatlarinda-son-durum-3474614' },
  { id:'diken', name:'Diken', tier:'İkincil medya', url:'https://www.diken.com.tr/motorine-indirim-bekleniyor-guncel-akaryakit-fiyatlari-6/' },
  { id:'puis', name:'PÜİS duyuruları', tier:'Sektör kuruluşu', url:'https://www.puis.org.tr/tum-haberler' },
  { id:'epdk-alerts', name:'EPDK resmi akaryakıt fiyatları', tier:'Resmi kurum', url:'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat' },
];

const nativeApp = () => Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.Capacitor?.getPlatform?.() === 'android');
const monthNumber = value => MONTHS[String(value || '').toLocaleLowerCase('tr-TR')];
const decode = value => String(value || '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&uuml;/gi, 'ü').replace(/&ouml;/gi, 'ö').replace(/&ccedil;/gi, 'ç').replace(/&scedil;/gi, 'ş').replace(/&gbreve;/gi, 'ğ').replace(/&imath;/gi, 'ı').replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
const plainText = html => decode(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const cleanAmount = value => Number(String(value).replace(',', '.'));
const dateText = date => date ? `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}` : null;
const isoDate = date => date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : null;

function parseDate(value, fallbackYear = new Date().getFullYear()) {
  const match = String(value || '').match(/(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)(?:\s+(20\d{2}))?/i);
  if (!match || !monthNumber(match[2])) return null;
  return new Date(Number(match[3] || fallbackYear), monthNumber(match[2]) - 1, Number(match[1]));
}
function publishedDate(text) {
  const match = text.match(/(?:YAYINLAMA|Yayınlanma|Güncelleme|Son Güncelleme|^)(?:[^0-9]{0,30})(\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+20\d{2})/im);
  return parseDate(match?.[1]);
}
function effectiveDate(text, fallbackYear) {
  const monthPattern = '(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)';
  const datePattern = new RegExp(`((?:\\d{1,2}\\s+)?${monthPattern}\\s+20\\d{2}|\\d{1,2}\\s+${monthPattern})`, 'gi');
  const cuePattern = /(?:geçerli|itibaren|yansı|başlayan)/gi;
  const dates = [...String(text || '').matchAll(datePattern)].map(match => ({ raw:match[1], index:match.index ?? 0, value:parseDate(match[1], fallbackYear) })).filter(item => item.value);
  const cues = [...String(text || '').matchAll(cuePattern)];
  for (const cue of cues) {
    const nearby = dates.filter(item => Math.abs(item.index - (cue.index ?? 0)) <= 130).sort((a, b) => Math.abs(a.index - (cue.index ?? 0)) - Math.abs(b.index - (cue.index ?? 0)));
    if (nearby[0]) return nearby[0].value;
  }
  const patterns = [
    /((?:\d{1,2}\s+)?(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+20\d{2}|\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık))[^.]{0,100}(?:geçerli|itibaren|yansı|başlayan)/i,
    /(?:geçerli|itibaren|yansı|başlayan)[^.]{0,100}?((?:\d{1,2}\s+)?(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)(?:\s+20\d{2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseDate(match?.[1], fallbackYear);
    if (parsed) return parsed;
  }
  return null;
}
function productOf(text) {
  const matchText = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(?:motorin\w*|mazot\w*|diesel)\b/i.test(matchText)) return 'motorin';
  if (/\b(?:benzin\w*|kursunsuz\w*|gasoline)\b/i.test(matchText)) return 'benzin';
  if (/\b(?:lpg|otogaz\w*)\b/i.test(matchText)) return 'lpg';
  return null;
}
function directionOf(text) {
  if (/\b(?:indirim|düşüş|azalma|düşmesi|gerileme)\b/i.test(text)) return 'down';
  if (/\b(?:zam|artış|yükseliş|artması|yükselme)\b/i.test(text)) return 'up';
  return null;
}
function futureCandidate(text, index, length) {
  const immediate = text.slice(index, Math.min(text.length, index + length + 55));
  if (/(?:düşürüldü|uygulandı|yapılmıştı|değişti|gelmişti|geldi|yapıldı|geriledi)(?:\s|[.,;!?]|$)/i.test(immediate)) return false;
  const nearby = text.slice(Math.max(0, index - 90), Math.min(text.length, index + length + 120));
  if (/(?:düşürüldü|uygulandı|yapılmıştı|değişti|gelmişti|geldi|yapıldı|geriledi)(?:\s|[.,;!?]|$)/i.test(nearby) && !/(?:bekleniyor|beklenecek|yapılacak|geçerli olmak üzere)/i.test(nearby)) return false;
  return true;
}
function amountContexts(text) {
  const contexts = [];
  const pattern = /(\d{1,2}[.,]\d{1,2})\s*(?:TL|lira|₺)/gi;
  for (const match of text.matchAll(pattern)) {
    const context = text.slice(Math.max(0, match.index - 170), Math.min(text.length, match.index + match[0].length + 170));
    const amount = cleanAmount(match[1]);
    if (amount > 0 && amount < 20 && productOf(context) && directionOf(context) && futureCandidate(text, match.index, match[0].length) && /beklen|planlan|yapılacak/i.test(context)) contexts.push({ amount, context });
  }
  const wordsPattern = /(\d{1,2})\s+lira\s+(\d{1,2})\s+kuruş/gi;
  for (const match of text.matchAll(wordsPattern)) {
    const context = text.slice(Math.max(0, match.index - 170), Math.min(text.length, match.index + match[0].length + 170));
    const amount = Number(`${match[1]}.${String(match[2]).padStart(2,'0')}`);
    if (amount > 0 && amount < 20 && productOf(context) && directionOf(context) && futureCandidate(text, match.index, match[0].length) && /beklen|planlan|yapılacak/i.test(context)) contexts.push({ amount, context });
  }
  return contexts;
}

export function parseAlertDocument(html, feed) {
  const text = plainText(html);
  const published = publishedDate(text);
  const contexts = amountContexts(text);
  if (!contexts.length) return { feed, ok:true, publishedAt:dateText(published), alerts:[], note:'Açık ürün, tutar ve yürürlük tarihi eşleşmesi bulunmadı.' };
  const alerts = [];
  for (const candidate of contexts) {
    const product = productOf(candidate.context);
    const direction = directionOf(candidate.context);
    const effective = effectiveDate(candidate.context, published?.getFullYear() || new Date().getFullYear()) || effectiveDate(text, published?.getFullYear() || new Date().getFullYear());
    if (!product || !direction || !effective) continue;
    alerts.push({
      id:`${feed.id}-${product}-${direction}-${candidate.amount}-${isoDate(effective)}`,
      product,
      direction,
      amount:candidate.amount,
      effectiveDate:isoDate(effective),
      effectiveDateLabel:dateText(effective),
      publishedAt:dateText(published),
      sourceId:feed.id,
      sourceName:feed.name,
      sourceTier:feed.tier,
      url:feed.url,
      title:`${product === 'motorin' ? 'Motorin' : product === 'benzin' ? 'Benzin' : 'LPG'} ${direction === 'down' ? 'indirimi' : 'zammı'} beklentisi`,
      evidence:candidate.context.trim(),
    });
  }
  return { feed, ok:true, publishedAt:dateText(published), alerts:[...new Map(alerts.map(item => [item.id,item])).values()], note:alerts.length?'Ürün, tutar ve yürürlük tarihi bulundu.':'Ürün/tutar bulundu ancak yürürlük tarihi doğrulanamadı.' };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache:'no-store', signal:controller.signal, headers:{ Accept:'text/html', 'User-Agent':'SurusCepte/1.1.0 fuel-alert-verifier' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return text;
  } finally { clearTimeout(timer); }
}

function mergeAlerts(results) {
  const groups = new Map();
  for (const result of results) for (const item of result.alerts || []) {
    const key = `${item.product}|${item.direction}|${item.amount.toFixed(2)}|${item.effectiveDate}`;
    const group = groups.get(key) || { ...item, sources:[], sourceCount:0, independentSourceCount:0, confidence:'Düşük', confidenceNote:'' };
    if (!group.sources.some(source => source.sourceId === item.sourceId)) group.sources.push(item);
    groups.set(key, group);
  }
  const now = new Date();
  return [...groups.values()].map(group => {
    const effective = new Date(`${group.effectiveDate}T00:00:00`);
    const uniquePublishers = new Set(group.sources.map(source => source.sourceId));
    const hasOfficial = group.sources.some(source => source.sourceTier === 'Resmi kurum');
    const sourceCount = uniquePublishers.size;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const effectiveDay = new Date(effective.getFullYear(), effective.getMonth(), effective.getDate());
    const status = effectiveDay > today ? 'upcoming' : effectiveDay.getTime() === today.getTime() ? 'active' : 'past';
    const confidence = hasOfficial && sourceCount >= 2 ? 'Yüksek' : sourceCount >= 2 ? 'Orta' : 'Düşük';
    const confidenceNote = hasOfficial ? 'Resmi kayıtla ve medya kaynağıyla eşleşiyor.' : sourceCount >= 2 ? `${sourceCount} yayın aynı ürün, tutar ve tarihi aktarıyor; ortak sektör kaynağı ayrıca resmî olarak yayımlanmış değil.` : 'Tek yayın bulundu; resmî teyit yok.';
    return { ...group, sources:group.sources.map(source => ({ sourceName:source.sourceName, sourceTier:source.sourceTier, publishedAt:source.publishedAt, url:source.url, evidence:source.evidence })), sourceCount, independentSourceCount:sourceCount, confidence, confidenceNote, status };
  }).sort((a,b) => `${a.status==='upcoming'?0:a.status==='active'?1:2}${a.effectiveDate}`.localeCompare(`${b.status==='upcoming'?0:b.status==='active'?1:2}${b.effectiveDate}`));
}

export async function collectFuelAlerts() {
  const results = await Promise.all(FUEL_ALERT_FEEDS.map(async feed => {
    try { return parseAlertDocument(await fetchText(feed.url), feed); }
    catch (error) { return { feed, ok:false, alerts:[], error:error?.message || 'Kaynak okunamadı' }; }
  }));
  const alerts = mergeAlerts(results);
  return { alerts, checkedAt:new Date().toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}), checks:results.map(result => ({ id:result.feed.id, name:result.feed.name, tier:result.feed.tier, url:result.feed.url, ok:result.ok, alertCount:result.alerts?.length || 0, publishedAt:result.publishedAt || null, note:result.note || null, error:result.error || null })) };
}

async function requestFeedApi(url) {
  const response = await fetch(url, { cache:'no-store', headers:{ Accept:'application/json' } });
  if (!response.ok) throw new Error(`Uyarı API HTTP ${response.status}`);
  return response.json();
}

export async function getFuelAlerts() {
  const configured = String(SURUS_CEPTE_ALERT_API_URL || '').replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const endpoint = nativeApp() && configured ? `${configured}/api/fuel-alerts` : !nativeApp() ? '/api/fuel-alerts' : '';
    if (endpoint) {
      try { return await requestFeedApi(endpoint); } catch {}
    }
    try { return await collectFuelAlerts(); } catch (error) { return { alerts:[], checks:[], checkedAt:new Date().toLocaleString('tr-TR'), error:error?.message || 'Uyarı kaynaklarına erişilemedi' }; }
  }
  return collectFuelAlerts();
}
