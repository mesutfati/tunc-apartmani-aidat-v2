const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

const formatLabels = {
  256: 'QR Code',
  4096: 'Aztec',
  2048: 'Code 128',
  32: 'EAN-13',
  64: 'EAN-8',
   UPCA: 'UPC-A',
   UPCE: 'UPC-E',
};

const VEHICLE_MAKES = ['Toyota','Honda','Renault','Fiat','Ford','Volkswagen','Volkswagen','BMW','Mercedes-Benz','Mercedes','Audi','Hyundai','Kia','Nissan','Peugeot','Citroën','Citroen','Opel','Skoda','Seat','Dacia','Togg','Volvo','Mazda','Mitsubishi','Suzuki','Yamaha','Honda','Kawasaki','KTM','Bajaj','SYM','Vespa','Piaggio','Harley-Davidson','Triumph','Ducati','Aprilia'];
const FIELD_ALIASES = {
  brand:['marka','brand','make','manufacturer','üretici','uretici'],
  model:['model','tip','modelname','vehiclemodel','aracmodeli'],
  modelYear:['modelyili','modelyear','year','model yılı','model yili','ilk tescil yılı','ilk tescil yili'],
  engine:['motor','engine','motorhacmi','enginecapacity','motor no','motor no'],
  transmission:['sanziman','transmission','şanzıman','şanziman'],
  fuel:['yakit','fuel','fueltype','yakıt','yakıt türü','yakit turu'],
  plate:['plaka','plate','registration','registrationplate','tescilplakasi','tescil plakası'],
  vin:['sasi','şasi','vin','chassis','chassisnumber','sasi no','şasi no'],
  tank:['depokapasitesi','tank','tankcapacity','fuelcapacity','depo kapasitesi']
};
const normalizeKey = value => String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const cleanValue = value => String(value ?? '').replace(/^[\s"'([{]+|[\s"')\]}]+$/g,'').trim();
const aliasKey = key => Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.some(alias => normalizeKey(alias) === normalizeKey(key)))?.[0] || null;

function flattenRegistrationValue(value, target = {}) {
  if (!value || typeof value !== 'object') return target;
  for (const [key, raw] of Object.entries(value)) {
    const field = aliasKey(key);
    if (field && raw != null && typeof raw !== 'object' && !target[field]) target[field] = cleanValue(raw);
    else if (raw && typeof raw === 'object') flattenRegistrationValue(raw, target);
  }
  return target;
}

function fuelLabel(value) {
  const text = normalizeKey(value);
  if (!text) return '';
  if (/motorin|diesel|dizel|mazot/.test(text)) return 'Motorin';
  if (/lpg|otogaz|autogas/.test(text)) return 'LPG';
  if (/hybrid|hibrit/.test(text)) return 'Hibrit';
  if (/electric|elektrik|ev$/.test(text)) return 'Elektrik';
  if (/benzin|gasoline|petrol/.test(text)) return 'Benzin';
  return cleanValue(value);
}

function parseRegistrationText(rawValue) {
  const raw = String(rawValue ?? '').trim();
  const fields = {};
  let parsedJson = false;
  try {
    const candidate = JSON.parse(raw);
    if (candidate && typeof candidate === 'object') { flattenRegistrationValue(candidate, fields); parsedJson = true; }
  } catch {}
  try {
    const url = new URL(raw);
    for (const [key, value] of url.searchParams.entries()) {
      const field = aliasKey(key);
      if (field && !fields[field]) fields[field] = cleanValue(value);
    }
  } catch {}
  const text = decodeURIComponent(raw.replace(/\\u0026/g,'&')).replace(/<br\s*\/?>(?=.)/gi,'\n');
  for (const match of text.matchAll(/(?:^|[;|\n&,])\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9 _-]{2,32})\s*[:=]\s*([^;|\n&,]{1,100})/g)) {
    const field = aliasKey(match[1]);
    if (field && !fields[field]) fields[field] = cleanValue(match[2]);
  }
  if (!fields.plate) fields.plate = (text.match(/\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,5}\b/i)?.[0] || '').replace(/\s+/g,' ').toLocaleUpperCase('tr-TR');
  if (!fields.vin) fields.vin = (text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0] || '').toLocaleUpperCase('tr-TR');
  if (!fields.modelYear) fields.modelYear = text.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/)?.[1] || '';
  if (!fields.brand) {
    const foundMake = VEHICLE_MAKES.find(make => new RegExp(`\\b${make.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'i').test(text));
    if (foundMake) fields.brand = foundMake;
  }
  if (!fields.model && fields.brand) {
    const afterMake = text.match(new RegExp(`${fields.brand}\\s+([A-Za-z0-9ÇĞİÖŞÜçğıöşü-]{2,24})`, 'i'));
    if (afterMake) fields.model = cleanValue(afterMake[1]);
  }
  fields.fuel = fuelLabel(fields.fuel);
  if (fields.tank) fields.tank = String(fields.tank).replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0] || '';
  const present = ['brand','model','plate','vin','modelYear'].filter(key => fields[key]);
  return { ok: present.length >= 2, fields, parsedJson, rawValue:raw, missing:['brand','model','plate'].filter(key => !fields[key]) };
}

export function parseVehicleRegistrationQr(rawValue) {
  const parsed = parseRegistrationText(rawValue);
  return { ok:parsed.ok, rawValue:parsed.rawValue, fields:parsed.fields, missing:parsed.missing, parsedJson:parsed.parsedJson, message:parsed.ok ? 'Ruhsat karekodundan okunabilen alanlar forma aktarıldı.' : 'Bu karekod ruhsat alanlarını açık metin olarak içermiyor; ham veri gösterildi.' };
}

export async function scanBarcode() {
  const vision = nativePlugin('Vision');
  if (!vision?.scanBarcode || !globalThis.Capacitor?.isNativePlatform?.()) {
    return { ok:false, native:false, cancelled:false, message:'Karekod tarama yalnızca Android APK içindeki Google Code Scanner ile çalışır.' };
  }
  try {
    const result = await vision.scanBarcode();
    const rawValue = String(result?.rawValue || result?.displayValue || '').trim();
    if (!rawValue) return { ok:false, native:true, cancelled:false, message:'Karekod okundu ancak veri içermiyor.' };
    return {
      ok:true,
      native:true,
      rawValue,
      displayValue:String(result?.displayValue || rawValue),
      format:Number.isFinite(Number(result?.format)) ? (formatLabels[result.format] || `Kod formatı ${result.format}`) : 'Karekod / barkod',
      valueType:result?.valueType ?? null,
    };
  } catch (error) {
    const message = error?.message || 'Karekod taraması tamamlanamadı.';
    return { ok:false, native:true, cancelled:/iptal|cancel/i.test(message), message };
  }
}
