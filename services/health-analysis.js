const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const obdMetrics = [
  ['coolant', 'Motor suyu', '°C'],
  ['rpm', 'Motor devri', 'rpm'],
  ['speed', 'Hız', 'km/s'],
  ['shortFuelTrim', 'Kısa yakıt düzeltmesi', '%'],
  ['longFuelTrim', 'Uzun yakıt düzeltmesi', '%'],
  ['voltage', 'Akü/şarj voltajı', 'V'],
  ['throttle', 'Gaz kelebeği', '%'],
  ['fuelLevel', 'Yakıt seviyesi', '%'],
];

export function analyzeVehicleHealth(input = {}) {
  const data = { ...input };
  let score = 100;
  const findings = [];
  const add = (severity, title, detail, penalty) => { score -= penalty; findings.push({ severity, title, detail }); };
  const coolant = Number(data.coolant);
  const voltage = Number(data.voltage);
  const trim = Math.abs(Number(data.shortFuelTrim || 0)) + Math.abs(Number(data.longFuelTrim || 0));
  const dtcs = Array.isArray(data.dtcs) ? data.dtcs : [];

  if (Number.isFinite(coolant) && coolant >= 112) add('critical', 'Hararet riski', `${coolant}°C motor suyu sıcaklığı yüksek; aracı güvenli yerde durdurup soğutun.`, 38);
  else if (Number.isFinite(coolant) && coolant >= 102) add('warn', 'Sıcaklık takibi', `${coolant}°C motor suyu sıcaklığı normal üstünde; fan ve soğutma sistemini kontrol ettirin.`, 15);
  if (Number.isFinite(voltage) && voltage < 12.1) add('warn', 'Düşük akü voltajı', `${voltage.toFixed(1)} V ölçüldü; akü/alternatör kontrolü önerilir.`, 20);
  else if (Number.isFinite(voltage) && voltage > 15.1) add('critical', 'Aşırı şarj', `${voltage.toFixed(1)} V ölçüldü; alternatör regülatörünü gecikmeden kontrol ettirin.`, 32);
  if (trim >= 25) add('warn', 'Yakıt karışımı sapması', `Yakıt düzeltmeleri toplamı yaklaşık %${trim.toFixed(0)}; hava kaçağı, enjektör veya lambda sensörü incelenmeli.`, 18);
  if (Number.isFinite(data.throttle) && Number(data.throttle) > 92 && Number(data.rpm) < 900) add('warn', 'Gaz kelebeği tutarsızlığı', 'Düşük devirde yüksek gaz kelebeği görüldü; ölçümü tekrar edin.', 10);
  if (dtcs.length) add(dtcs.some(code => /^P0(2|3|4|5|6)/i.test(code)) ? 'critical' : 'warn', 'Arıza kodu bulundu', `${dtcs.join(', ')} kodları için servis taraması önerilir.`, Math.min(35, 10 + dtcs.length * 5));
  if (!findings.length) findings.push({ severity:'ok', title:'Ölçümler dengeli', detail:'Son OBD örneğinde belirgin bir sapma görülmedi.' });
  score = clamp(Math.round(score), 0, 100);
  const level = score >= 85 ? 'İyi' : score >= 65 ? 'İzlemeli' : score >= 40 ? 'Servis önerilir' : 'Acil kontrol';
  return { score, level, findings, generatedAt: new Date().toISOString(), disclaimer:'Bu sonuç tanı değildir; OBD verisine dayalı ön değerlendirmedir.' };
}

export const demoHealthSnapshot = {
  coolant: 91,
  rpm: 780,
  speed: 0,
  shortFuelTrim: 2.4,
  longFuelTrim: 3.8,
  voltage: 14.1,
  throttle: 10,
  fuelLevel: 61,
  dtcs: [],
};
