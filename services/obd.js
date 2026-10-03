const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;
const cleanHex = value => String(value || '').replace(/\s|>/g, '').toUpperCase();
const byte = (hex, index = 0) => parseInt(hex.slice(index * 2, index * 2 + 2), 16);
const word = hex => parseInt(hex.slice(0, 4), 16);

export const OBD_PIDS = {
  coolant: { pid:'05', label:'Motor suyu', parse: hex => byte(hex) - 40 },
  shortFuelTrim: { pid:'06', label:'Kısa yakıt düzeltmesi', parse: hex => byte(hex) / 1.28 - 100 },
  longFuelTrim: { pid:'07', label:'Uzun yakıt düzeltmesi', parse: hex => byte(hex) / 1.28 - 100 },
  rpm: { pid:'0C', label:'Motor devri', parse: hex => word(hex) / 4 },
  speed: { pid:'0D', label:'Hız', parse: hex => byte(hex) },
  throttle: { pid:'11', label:'Gaz kelebeği', parse: hex => byte(hex) / 2.55 },
  fuelLevel: { pid:'2F', label:'Yakıt seviyesi', parse: hex => byte(hex) / 2.55 },
  voltage: { pid:'42', label:'Kontrol modülü voltajı', parse: hex => word(hex) / 1000 },
};

export function parseElmResponse(pid, response) {
  const compact = cleanHex(response);
  const marker = `41${pid}`;
  const at = compact.indexOf(marker);
  if (at < 0) return null;
  const raw = compact.slice(at + marker.length);
  const def = Object.values(OBD_PIDS).find(item => item.pid === pid);
  if (!def || raw.length < 2) return null;
  const value = def.parse(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseDtcResponse(response) {
  const compact = cleanHex(response);
  const at = compact.indexOf('43');
  if (at < 0) return [];
  const bytes = compact.slice(at + 2).match(/.{1,4}/g) || [];
  const letters = ['P', 'C', 'B', 'U'];
  return bytes.map(pair => {
    if (pair.length < 4 || pair === '0000') return null;
    const first = parseInt(pair[0], 16);
    return `${letters[(first >> 2) & 3]}${first & 3}${pair.slice(1)}`;
  }).filter(Boolean);
}

export function demoObdSnapshot() {
  return { coolant:91, shortFuelTrim:2.4, longFuelTrim:3.8, rpm:780, speed:0, throttle:10, fuelLevel:61, voltage:14.1, dtcs:[], connected:false, source:'Yerel OBD demo ölçümü' };
}

async function commandSerial(serial, address, command) {
  await serial.write({ address, value:`${command}\r` });
  const result = await serial.readUntil({ address, delimiter:'\r' });
  return result?.data || '';
}

export async function connectObdClassic() {
  const serial = nativePlugin('BluetoothSerial');
  if (!serial) return { ok:false, native:false, message:'Bluetooth Classic eklentisi yalnızca Android APK içinde kullanılabilir.' };
  try {
    await serial.enable();
    const scan = await serial.scan();
    const devices = (scan?.devices || []).filter(device => /elm|obd|vgate|obdlink|icar/i.test(device.name || '') || true).slice(0, 12);
    return { ok:true, native:true, serial, devices };
  } catch (error) {
    return { ok:false, native:true, message:error?.message || 'Bluetooth cihazları taranamadı.' };
  }
}

export async function readObdSnapshot(device) {
  const serial = nativePlugin('BluetoothSerial');
  if (!serial || !device?.address) return { ...demoObdSnapshot(), message:'Demo OBD verisi gösteriliyor.' };
  try {
    await serial.connectInsecure({ address:device.address });
    await commandSerial(serial, device.address, 'ATZ');
    await commandSerial(serial, device.address, 'ATE0');
    await commandSerial(serial, device.address, 'ATL0');
    const entries = {};
    for (const [key, def] of Object.entries(OBD_PIDS)) entries[key] = parseElmResponse(def.pid, await commandSerial(serial, device.address, `01 ${def.pid}`));
    entries.dtcs = parseDtcResponse(await commandSerial(serial, device.address, '03'));
    entries.connected = true; entries.source = `${device.name || 'ELM327'} · OBD-II canlı okuma`;
    return entries;
  } catch (error) {
    return { ...demoObdSnapshot(), message:`OBD bağlantısı kurulamadı: ${error?.message || 'bilinmeyen hata'}`, connected:false };
  }
}

export function obdSourceNote() {
  return 'PID dönüşümleri SAE J1979 OBD-II standardındaki ölçeklerle yapılır; araç ve adaptör desteği değişebilir.';
}
