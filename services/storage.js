const KEY = 'yakit-alarmi-v1';

export function load(seed) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved ? { ...seed, ...saved, settings:{ ...seed.settings, ...(saved.settings || {}) } } : structuredClone(seed);
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
