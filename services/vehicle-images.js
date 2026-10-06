const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const memoryCache = new Map();
const BAD_WORDS = /logo|emblem|badge|interior|dashboard|engine|wheel|tire|road|street|\btoy\b|model.?car|scale|concept|drawing|illustration|render|diagram|parts|manual|drift|race|racing|rally|modified|tuning|custom|track|police|patrol|taxi/i;

const clean = value => String(value || '').trim();
const safeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};
const keyFor = profile => `${clean(profile?.brand)}|${clean(profile?.model)}|${clean(profile?.modelYear)}|${clean(profile?.vehicleType)}`.toLocaleLowerCase('tr-TR');
const tokenSet = value => clean(value).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü\s-]/gi, ' ').split(/\s+/).filter(token => token.length > 2);

function candidateScore(page, profile) {
  const title = clean(page.title);
  const haystack = title.toLocaleLowerCase('tr-TR');
  const tokens = [...tokenSet(profile?.brand), ...tokenSet(profile?.model)];
  let score = 0;
  for (const token of tokens) if (haystack.includes(token)) score += token.length > 4 ? 3 : 1;
  if (profile?.vehicleType === 'motosiklet' && /motorcycle|motorrad|scooter|motosiklet|bike/i.test(title)) score += 4;
  if (profile?.vehicleType !== 'motosiklet' && /car|sedan|hatchback|suv|pickup|automobile|otomobil/i.test(title)) score += 2;
  if (BAD_WORDS.test(title)) score -= 12;
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

export async function findVehicleImage(profile) {
  const key = keyFor(profile);
  if (!key || profile?.id === 'manual') return { ok: false, reason: 'manual-profile' };
  if (memoryCache.has(key)) return memoryCache.get(key);

  const searchType = profile.vehicleType === 'motosiklet' ? 'motorcycle' : profile.vehicleType === 'hafif-ticari' ? 'van pickup' : 'car';
  const search = `${profile.brand} ${profile.model} ${searchType}`.trim();
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: search,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '720',
    format: 'json',
    origin: '*'
  });

  try {
    const payload = await fetchJson(`${COMMONS_API}?${params.toString()}`);
    const pages = Object.values(payload?.query?.pages || {}).sort((a, b) => candidateScore(b, profile) - candidateScore(a, profile));
    const page = pages.find(item => candidateScore(item, profile) >= 4 && item.imageinfo?.[0]);
    if (!page) throw new Error('Eşleşen model fotoğrafı bulunamadı.');
    const info = page.imageinfo[0];
    const url = safeUrl(info.thumburl || info.url);
    const pageUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/, 'File:')).replace(/%2F/g, '/')}`;
    const result = url ? {
      ok: true,
      url,
      sourceUrl: pageUrl,
      sourceLabel: 'Wikimedia Commons model fotoğrafı',
      title: page.title.replace(/^File:/, ''),
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
