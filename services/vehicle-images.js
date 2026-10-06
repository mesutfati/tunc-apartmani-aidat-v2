const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const memoryCache = new Map();
const OFFICIAL_MODEL_IMAGES = [
  {
    brand:'toyota',
    model:/corolla( sedan)?( hybrid)?$/i,
    url:'https://img-optimize.toyota-europe.com/ccis/zip/tr/product-token/84588010-a015-4226-922e-4ce81221bc72/vehicle/96518/width/680/height/383/padding/0,0,0,0/image-quality/70/day-exterior-03_040.png',
    sourceUrl:'https://www.toyota.com.tr/araba-modelleri/corolla-sedan',
    sourceLabel:'Toyota Türkiye resmi Corolla Sedan fotoğrafı',
    title:'Toyota Corolla Sedan · Toyota Türkiye'
  }
];

// Gerçek model fotoğrafı yerine logo, çizim, yarış/drift veya değiştirilmiş araç seçilmesini engeller.
const BAD_WORDS = /logo|emblem|badge|interior|dashboard|engine|wheel|tire|model.?car|scale|concept|drawing|illustration|render|diagram|parts|manual|drift|race|racing|rally|modified|tuning|custom|track|police|patrol|taxi|replica|diecast|miniature/i;
const GENERIC_MODEL_WORDS = new Set(['sedan','hatchback','wagon','estate','suv','crossover','pickup','van','car','automobile','otomobil','hybrid','hev','phev','ev','electric','elektrik','diesel','diesel','benzin','benzine','petrol','motorcycle','motosiklet','scooter','bike','touring','sport','standard','base','fwd','awd','4x2','4x4']);

const clean = value => String(value || '').trim();
const lower = value => clean(value).toLocaleLowerCase('tr-TR');
const safeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};
const keyFor = profile => `${clean(profile?.brand)}|${clean(profile?.model)}|${clean(profile?.modelYear)}|${clean(profile?.vehicleType)}`.toLocaleLowerCase('tr-TR');
const terms = value => lower(value).replace(/[’']/g, '').replace(/[^a-z0-9çğıöşü]+/gi, ' ').split(/\s+/).filter(Boolean);
const compact = value => terms(value).join('');
const modelIdentity = profile => {
  let value = lower(profile?.model);
  for (const token of terms(profile?.brand)) value = value.replace(new RegExp(`\\b${token}\\b`, 'gi'), ' ');
  for (const token of GENERIC_MODEL_WORDS) value = value.replace(new RegExp(`\\b${token}\\b`, 'gi'), ' ');
  return value.replace(/[^a-z0-9çğıöşü]/gi, '');
};
function officialImageFor(profile) {
  const brand = lower(profile?.brand);
  const model = lower(profile?.model);
  return OFFICIAL_MODEL_IMAGES.find(item => brand === item.brand && item.model.test(model)) || null;
}

/**
 * Stored images are checked again on every render. This invalidates old cached
 * drift/incorrect images and prevents a generic brand match from being shown.
 */
export function isVehicleImageSuitable(profile, image = {}) {
  const url = safeUrl(image.url || image.imageUrl);
  const title = clean(image.title || image.imageTitle);
  if (!profile || !url || !title || BAD_WORDS.test(title)) return false;
  const brand = compact(profile.brand);
  const model = modelIdentity(profile);
  const titleCompact = compact(title);
  if (!brand || !titleCompact.includes(brand)) return false;
  if (model && model.length >= 3 && !titleCompact.includes(model)) return false;
  return true;
}

function candidateScore(page, profile) {
  const title = clean(page.title);
  if (!isVehicleImageSuitable(profile, { url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url, title })) return -Infinity;
  const haystack = lower(title);
  const brand = compact(profile.brand);
  const model = modelIdentity(profile);
  let score = 20;
  if (brand && compact(haystack).includes(brand)) score += 8;
  if (model && compact(haystack).includes(model)) score += 10;
  if (profile?.vehicleType === 'motosiklet' && /motorcycle|motorrad|scooter|motosiklet|bike/i.test(title)) score += 4;
  if (profile?.vehicleType !== 'motosiklet' && /car|sedan|hatchback|suv|pickup|automobile|otomobil/i.test(title)) score += 2;
  if (page.imageinfo?.[0]?.thumburl) score += 2;
  return score;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Model görseli HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '720',
    format: 'json',
    origin: '*'
  });
  const payload = await fetchJson(`${COMMONS_API}?${params.toString()}`);
  return Object.values(payload?.query?.pages || {});
}

export async function findVehicleImage(profile) {
  const key = keyFor(profile);
  if (!key || profile?.id === 'manual') return { ok: false, reason: 'manual-profile' };
  if (memoryCache.has(key)) return memoryCache.get(key);
  const official = officialImageFor(profile);
  if (official && isVehicleImageSuitable(profile, official)) {
    const result = { ok:true, url:official.url, sourceUrl:official.sourceUrl, sourceLabel:official.sourceLabel, title:official.title, license:'Üretici sayfası kullanım koşulları geçerlidir.', representative:false };
    memoryCache.set(key, result);
    return result;
  }

  const searchType = profile.vehicleType === 'motosiklet' ? 'motorcycle' : profile.vehicleType === 'hafif-ticari' ? 'van pickup' : 'car';
  const queries = [
    `${clean(profile.brand)} ${clean(profile.model)} ${searchType}`.trim(),
    `${clean(profile.brand)} ${clean(profile.model)}`.trim()
  ].filter(Boolean);

  try {
    const pageMap = new Map();
    for (const query of queries) {
      const pages = await searchCommons(query);
      for (const page of pages) pageMap.set(page.pageid, page);
      if ([...pageMap.values()].some(page => candidateScore(page, profile) >= 40)) break;
    }
    const pages = [...pageMap.values()].sort((a, b) => candidateScore(b, profile) - candidateScore(a, profile));
    const page = pages.find(item => Number.isFinite(candidateScore(item, profile)) && candidateScore(item, profile) >= 40 && item.imageinfo?.[0]);
    if (!page) throw new Error('Seçilen modelle güvenilir biçimde eşleşen gerçek araç fotoğrafı bulunamadı.');
    const info = page.imageinfo[0];
    const url = safeUrl(info.thumburl || info.url);
    const title = page.title.replace(/^File:/, '');
    const pageUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/, 'File:')).replace(/%2F/g, '/')}`;
    const result = url ? {
      ok: true,
      url,
      sourceUrl: pageUrl,
      sourceLabel: 'Wikimedia Commons model fotoğrafı; yıl/donanım ayrıca doğrulanmalı',
      title,
      license: info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || 'Lisans bilgisi Wikimedia Commons sayfasında',
      representative: true
    } : { ok: false, reason: 'invalid-image-url' };
    memoryCache.set(key, result);
    return result;
  } catch (error) {
    const result = { ok: false, reason: error?.message || 'Model fotoğrafı alınamadı.' };
    memoryCache.set(key, result);
    return result;
  }
}
