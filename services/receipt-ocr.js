const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

const STATION_BRANDS = [
  ['Petrol Ofisi', /petrol\s+of[iı]s[iı]|po\b/i],
  ['Shell', /\bshell\b/i],
  ['OPET', /\bopet\b/i],
  ['Aytemiz', /\baytem[iı]z\b/i],
  ['Sunpet', /\bsunpet\b/i],
  ['M Oil', /\bm\s*oil\b/i],
  ['Lukoil', /\blukoil\b/i],
  ['TotalEnergies', /total\s*energies|total\b/i],
  ['Kadoil', /\bkadoil\b/i],
  ['Go Petrol', /go\s+petrol/i],
  ['Alpet', /\balpet\b/i],
  ['Türkpetrol', /t[uü]rk\s*petrol/i],
  ['Moil', /\bmoil\b/i],
];

const FUEL_PATTERNS = [
  ['Motorin', /motorin|d[iı]esel|mazot|euro\s*diesel|v[- ]power\s+diesel|diesel\s+extra/i],
  ['LPG', /\blpg\b|otogaz|autogas/i],
  ['Benzin', /benzin|gasoline|kur[sş]unsuz|95\s*oktan|98\s*oktan|v[- ]power\s+benzin|fuelsave|ultimate/i],
];

const uniq = values => [...new Set(values.filter(Boolean))];
const cleanLine = value => String(value ?? '')
  .replace(/[|¦]/g, 'I')
  .replace(/[\t ]+/g, ' ')
  .replace(/^[-_=~•·]+|[-_=~•·]+$/g, '')
  .trim();
const normalizeText = value => String(value ?? '').replace(/\r/g, '').split('\n').map(cleanLine).filter(Boolean).join('\n').trim();
const flatText = value => normalizeText(value).replace(/\n+/g, ' ').replace(/[ ]+/g, ' ').trim();
const lower = value => String(value || '').toLocaleLowerCase('tr-TR');
const noDiacritics = value => lower(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function numberFrom(value) {
  if (value == null) return null;
  let text = String(value).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, '');
  }
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

function isoDate(value) {
  const raw = String(value || '').trim().replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  let match = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = raw.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
}

function dateMatches(text) {
  const candidateText = String(text || '').replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  return [...candidateText.matchAll(/\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/g)].map(match => ({ raw:match[0], value:isoDate(match[0]), index:match.index }));
}

function timeMatches(text) {
  return [...String(text || '').matchAll(/(?<![\d./-])\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::([0-5]\d))?\b(?![\d./-])/g)].map(match => `${match[1].padStart(2, '0')}:${match[2]}${match[3] ? `:${match[3]}` : ''}`);
}

function moneyMatches(text) {
  const source = String(text || '');
  const matches = [];
  const pattern = /(?<!\d)(\d{1,3}(?:[. ]\d{3})+(?:,\d{1,3})?|\d+(?:[,.]\d{1,3}))(?:\s*(?:₺|TL|TRY))?(?!\d)/gi;
  for (const match of source.matchAll(pattern)) {
    const raw = match[1];
    if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(raw)) continue;
    const value = numberFrom(raw);
    if (value == null || value <= 0 || value > 1000000) continue;
    matches.push({ raw, value, index:match.index });
  }
  return matches;
}

function labeledNumber(lines, patterns, options = {}) {
  const rx = patterns instanceof RegExp ? patterns : new RegExp(patterns, 'i');
  for (const line of lines) {
    const normalizedLine = noDiacritics(line);
    const normalizedRx = new RegExp(noDiacritics(rx.source), rx.flags.replace('g', ''));
    if (!rx.test(line) && !normalizedRx.test(normalizedLine)) continue;
    const tail = rx.test(line) ? line.replace(rx, ' ') : normalizedLine.replace(normalizedRx, ' ');
    const candidates = moneyMatches(tail);
    const chosen = options.last ? candidates.at(-1) : candidates[0];
    if (chosen) return chosen.value;
    const loose = tail.match(/\b\d+[,.]\d{1,3}\b/);
    if (loose) return numberFrom(loose[0]);
  }
  return null;
}

function labeledText(lines, patterns) {
  const rx = patterns instanceof RegExp ? patterns : new RegExp(patterns, 'i');
  for (const line of lines) {
    const normalizedRx = new RegExp(noDiacritics(rx.source), rx.flags.replace('g', ''));
    const match = line.match(rx) || noDiacritics(line).match(normalizedRx);
    if (!match) continue;
    const value = cleanLine(line.slice((match.index ?? 0) + match[0].length).replace(/^\s*[:#№-]?\s*/, ''));
    if (value && !/^[-:]+$/.test(value)) return value;
  }
  return '';
}

function fuelType(value) {
  const line = noDiacritics(value);
  return FUEL_PATTERNS.find(([, pattern]) => pattern.test(line))?.[0] || '';
}

function stationInfo(lines, text) {
  const searchableText = noDiacritics(text);
  const brand = STATION_BRANDS.find(([, pattern]) => pattern.test(searchableText))?.[0] || '';
  const candidates = lines.filter(line => {
    const normalized = noDiacritics(line);
    return line.length >= 3 && line.length <= 120 && /(petrol|akaryakit|istasyon|opet|shell|aytemiz|sunpet|lukoil|alpet|total|oil)/i.test(normalized);
  });
  const name = labeledText(lines, /(?:istasyon\s*ad[iı]|firma\s*ad[iı]|ünvan|unvan|şube|sube)\s*[:#-]?/i) || candidates.find(line => /istasyon/i.test(noDiacritics(line))) || candidates.find(line => /(petrol|akaryak[iı]t|opet|shell|aytemiz|sunpet|lukoil|alpet|total|oil)/i.test(noDiacritics(line))) || brand;
  const address = labeledText(lines, /(?:adres|adresi|istasyon\s*adres[iı])\s*[:#-]?/i) || lines.find(line => /(mah\.?|mahallesi|cad\.?|caddesi|sok\.?|soka[ğg][iı]|bulvar|blv\.?)/i.test(noDiacritics(line))) || '';
  const city = labeledText(lines, /(?:il|şehir|sehir)\s*[:#-]?/i);
  const district = labeledText(lines, /(?:ilçe|ilce)\s*[:#-]?/i);
  return { stationBrand:brand, stationName:cleanLine(name), stationAddress:cleanLine(address), city, district };
}

function paymentMethod(text) {
  const normalized = noDiacritics(text);
  if (/kredi kart|credit card|visa|mastercard|world|bonus|maximum/.test(normalized)) return 'Kredi kartı';
  if (/nakit|cash/.test(normalized)) return 'Nakit';
  if (/banka kart|debit/.test(normalized)) return 'Banka kartı';
  if (/hgs|ogs|filo|fleet|cari/.test(normalized)) return 'Filo / cari';
  return '';
}

function extractItems(lines) {
  return lines.flatMap(line => {
    const fuel = fuelType(line);
    if (!fuel) return [];
    const values = moneyMatches(line).map(item => item.value).filter(value => value > 0);
    const litersMatch = line.match(/(?:\b(?:lt|l|litre|liter|miktar|quantity|volume)\b\s*[:=]?\s*)(\d+[,.]\d{1,3})/i) || line.match(/(\d+[,.]\d{2,3})\s*(?:lt|l|litre|liter)/i);
    const liters = litersMatch ? numberFrom(litersMatch[1]) : null;
    const unitPrice = labeledNumber([line], /(?:birim|unit|fiyat\s*\/\s*l|tl\s*\/\s*l|price)/i);
    const amount = labeledNumber([line], /(?:tutar|toplam|total|amount)/i, { last:true });
    return [{ fuel, line, unitPrice:unitPrice ?? (values.length > 1 ? values.at(-1) : null), liters, amount:amount ?? (values.length > 1 && liters ? values.at(-1) : null) }];
  });
}

function parseReceiptText(rawText = '') {
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n').map(cleanLine).filter(Boolean);
  const text = flatText(normalized);
  let structured = {};
  try {
    const candidate = String(rawText || '').trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) structured = JSON.parse(candidate) || {};
  } catch {}
  const structuredNumber = (...keys) => { for (const key of keys) { const value = numberFrom(structured?.[key]); if (value != null) return value; } return null; };
  const allDates = dateMatches(text);
  const allTimes = timeMatches(text);
  const station = stationInfo(lines, text);
  const lineFuel = fuelType(structured?.fuel || structured?.fuelType) || lines.map(fuelType).find(Boolean) || fuelType(text);
  const items = extractItems(lines);
  const dateLine = lines.find(line => /tarih|işlem\s*tarihi|islem\s*tarihi|satış\s*tarihi|satis\s*tarihi|date/i.test(noDiacritics(line))) || '';
  const date = isoDate(dateLine) || allDates[0]?.value || '';
  const time = timeMatches(dateLine)[0] || allTimes[0] || '';
  const total = labeledNumber(lines, /(?:genel\s*toplam|ödenecek|odenecek|toplam|tutar|total|amount|grand\s*total)/i, { last:true });
  const amountCandidates = lines.flatMap(line => moneyMatches(line).map(item => item.value)).filter(value => value > 0 && value < 1000000);
  const amount = structuredNumber('amount','total','totalAmount') ?? total ?? (amountCandidates.length ? Math.max(...amountCandidates) : null);
  const liters = structuredNumber('liters','litres','volume') ?? labeledNumber(lines, /(?:litre|liter|miktar|quantity|volume|sat[iı]lan\s*miktar)/i) ?? items.find(item => item.liters != null)?.liters ?? null;
  const unitPrice = structuredNumber('unitPrice','unit_price','pricePerLiter') ?? labeledNumber(lines, /(?:birim\s*fiyat|fiyat\s*\/\s*l|tl\s*\/\s*l|unit\s*price|litre\s*fiyat[iı])/i) ?? items.find(item => item.unitPrice != null)?.unitPrice ?? null;
  const plateMatch = lines.map(line => line.match(/\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/i)).find(Boolean);
  const receiptNo = structured?.receiptNo || structured?.receipt || labeledText(lines, /(?:fiş\s*no|fis\s*no|belge\s*no|receipt\s*no|document\s*no|z\s*no)\s*[:#№-]?/i);
  const transactionNo = structured?.transactionNo || structured?.transaction || labeledText(lines, /(?:işlem\s*no|islem\s*no|transaction\s*no|referans\s*no|ref\s*no)\s*[:#№-]?/i);
  const pumpNo = structured?.pumpNo || structured?.pump || labeledText(lines, /(?:pompa|pump|tabanca)\s*(?:no|numaras[iı])?\s*[:#№-]?/i);
  const taxNo = structured?.taxNo || structured?.vkn || labeledText(lines, /(?:vergi\s*(?:no|numaras[iı])|vkn|tax\s*no)\s*[:#№-]?/i);
  const vat = structuredNumber('vat','tax') ?? labeledNumber(lines, /(?:kdv|vat|vergi)/i, { last:true });
  const payment = paymentMethod(text);
  const issuer = labeledText(lines, /(?:firma|şirket|sirket|ünvan|unvan|merchant|satıcı|satici)\s*[:#№-]?/i);
  const phone = (text.match(/(?:\+90|0)?\s*(?:5\d{2}|850)[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/i) || [])[0] || '';
  const issuedAt = date ? `${date}${time ? `T${time}:00` : ''}` : '';
  const parsed = {
    rawText:text,
    rawLines:lines,
    stationBrand:structured?.stationBrand || structured?.brand || station.stationBrand,
    stationName:structured?.stationName || structured?.station || station.stationName,
    stationAddress:structured?.stationAddress || structured?.address || station.stationAddress,
    city:structured?.city || station.city,
    district:structured?.district || station.district,
    date,
    time,
    issuedAt,
    receiptNo,
    transactionNo,
    pumpNo,
    taxNo,
    phone,
    issuer,
    fuel:lineFuel,
    liters,
    unitPrice,
    amount,
    vat,
    paymentMethod:structured?.paymentMethod || structured?.payment || payment,
    plate:String(structured?.plate || plateMatch?.[0] || '').replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR'),
    items,
    confidenceHint:lines.length >= 4 && (amount != null || liters != null || lineFuel) ? 'Orta' : 'Düşük',
  };
  parsed.missing = [
    ['stationName', 'istasyon'], ['date', 'tarih'], ['fuel', 'yakıt türü'], ['liters', 'litre'], ['unitPrice', 'birim fiyat'], ['amount', 'toplam tutar'],
  ].filter(([key]) => parsed[key] == null || parsed[key] === '').map(([, label]) => label);
  return parsed;
}

function browserCapture(source = 'camera') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; if (source === 'camera') input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('Fiş fotoğrafı seçilmedi.')); return; }
      const url = URL.createObjectURL(file);
      resolve({ ok:true, native:false, imageUri:url, imageName:file.name, scanMode:source === 'gallery' ? 'gallery' : 'camera', ocr:false, parsed:parseReceiptText(''), rawText:'', message:source === 'gallery' ? 'Galeriden fiş seçildi. OCR ve alan çıkarımı gerçek Android APK içinde çalışır.' : 'Fotoğraf alındı. OCR ve alan çıkarımı gerçek Android APK içinde çalışır.' });
    };
    input.click();
  });
}

export async function readReceipt(source = 'camera') {
  const camera = nativePlugin('Camera');
  const ocr = nativePlugin('Vision');
  if (!camera || !globalThis.Capacitor?.isNativePlatform?.()) return browserCapture(source);
  try {
    const photo = await camera.getPhoto({ quality:95, allowEditing:false, resultType:'uri', source:source === 'gallery' ? 'PHOTOS' : 'CAMERA', promptLabelHeader:source === 'gallery' ? 'Galeriden fiş seçin' : 'Fişin tamamını kadraja alın', promptLabelPhoto:'Galeriden seç', promptLabelPicture:'Fotoğraf çek', correctOrientation:true, saveToGallery:false });
    const imageUri = photo?.path || photo?.webPath;
    if (!imageUri) throw new Error('Kamera fotoğraf yolu döndürmedi.');
    if (!ocr?.detectText) return { ok:true, native:true, ocr:false, imageUri, scanMode:source === 'gallery' ? 'gallery' : 'camera', parsed:parseReceiptText(''), rawText:'', message:'Fiş görüntüsü alındı. OCR servisi kullanılamadı; bilgileri elle kontrol edin.' };
    try {
      const result = await ocr.detectText({ filename:imageUri, orientation:'UP' });
      const rawText = result?.text || (result?.textDetections || []).map(item => item.text).join('\n');
      return { ok:true, native:true, ocr:true, imageUri, scanMode:source === 'gallery' ? 'gallery' : 'camera', parsed:parseReceiptText(rawText), rawText, passes:result?.passes || 1, message:'Fiş metni iki OCR geçişiyle cihazda okundu; alanları kaydetmeden önce kontrol edin.' };
    } catch (ocrError) {
      return { ok:true, native:true, ocr:false, imageUri, scanMode:source === 'gallery' ? 'gallery' : 'camera', parsed:parseReceiptText(''), rawText:'', message:`Fiş görüntüsü alındı; OCR çalışmadı. Bilgileri elle kontrol edin. (${ocrError?.message || 'OCR hatası'})` };
    }
  } catch (error) {
    return { ok:false, native:true, ocr:false, message:error?.message || 'Kamera/OCR işlemi tamamlanamadı.' };
  }
}

export { parseReceiptText, numberFrom, isoDate };
