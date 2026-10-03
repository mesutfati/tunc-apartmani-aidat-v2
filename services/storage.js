const KEY = 'yakit-alarmi-v1';
const DEMO_IDS = new Set(['trip-demo', 'trip-seed', 'park-seed', 'hgs-seed', 'n1', 'n2']);

function removeSeedRecords(state) {
  const result = { ...state };
  for (const key of ['trips', 'parks', 'hgs', 'notifications']) {
    if (Array.isArray(result[key])) result[key] = result[key].filter(item => !DEMO_IDS.has(item.id));
  }
  if (result.settings?.mileage === 28460) result.settings = { ...result.settings, mileage:0 };
  if (result.healthSnapshot && !result.healthSnapshot.connected && !result.healthSnapshot.source) {
    result.healthSnapshot = null;
    result.healthReport = null;
  }
  return result;
}

export function load(seed) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const state = saved ? { ...seed, ...saved, settings:{ ...seed.settings, ...(saved.settings || {}) } } : structuredClone(seed);
    const cleaned = removeSeedRecords(state);
    localStorage.setItem(KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch { return structuredClone(seed); }
}
export function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function reset(seed) { localStorage.removeItem(KEY); return structuredClone(seed); }
export function exportBackup(state) {
  const file = new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), data:state }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(file); const a = document.createElement('a');
  a.href = url; a.download = `yakit-alarmi-yedek-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { try { const json = JSON.parse(reader.result); resolve(json.data || json); } catch { reject(new Error('Geçersiz yedek dosyası')); } };
    reader.onerror = () => reject(new Error('Dosya okunamadı')); reader.readAsText(file);
  });
}
