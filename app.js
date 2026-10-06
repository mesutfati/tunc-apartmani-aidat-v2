import { districts, provinces, seedState, fuelLabels } from './data/fixtures.js';
import { load, save, reset, exportBackup, importBackup } from './services/storage.js';
import { getFuelPrices } from './services/fuel-prices.js';
import { FUEL_SOURCES } from './services/fuel-prices.js';
import { requestCurrentPosition, checkLocationPermission, openLocationSettings } from './services/gps.js';
import { requestNotificationPermission, scheduleFuelNotification, scheduleCareReminder } from './services/notifications.js';
import { readReceipt, parseReceiptText } from './services/receipt-ocr.js';
import { scanBarcode } from './services/barcode.js';
import { corollaIcon } from './services/vehicle-art.js';
import { VEHICLE_PROFILES, MANUAL_VEHICLE_PROFILE, vehicleProfileById, vehicleFuelKey } from './data/vehicle-catalog.js';
import { analyzeVehicleHealth, demoHealthSnapshot, obdMetrics } from './services/health-analysis.js';
import { connectObdClassic, readObdSnapshot, obdSourceNote, demoObdSnapshot } from './services/obd.js';
import { FUEL_ALERT_SOURCES, alertPolicy } from './services/fuel-alerts.js';
import { getFuelAlerts } from './services/fuel-alert-feed.js';
import { getEarlyWarningLive, riskScore } from './services/early-warning.js';
import { provinceCodes } from './data/province-codes.js';
import { getNearbyStations } from './services/nearby-stations.js';
import { readDocument } from './services/document-ocr.js';

const app = document.querySelector('#app');
const FAVORITE_STATION_BRANDS = ['OPET','Shell','Petrol Ofisi','BP','TotalEnergies','MOİL','Aytemiz','Sunpet'];
const APP_THEMES = [{id:'aurora',label:'Aurora · Teal'}, {id:'sunset',label:'Gün Batımı · Mercan'}, {id:'violet',label:'Gece · Menekşe'}, {id:'contrast',label:'Yüksek kontrast'}];
const stationBrandKey = value => String(value || '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const modalLayer = document.querySelector('#modalLayer');
const toastStack = document.querySelector('#toastStack');
const isEditableTarget = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));
document.addEventListener('contextmenu', event => { if (!isEditableTarget(event.target)) event.preventDefault(); });
document.addEventListener('selectstart', event => { if (!isEditableTarget(event.target)) event.preventDefault(); });
let state = load(seedState);
let priceRecords = [];
let refuelPriceRecords = [];
let refuelPriceType = '';
let refuelDraftVehicleId = null;
let refuelDraftPercent = null;
let healthSnapshot = state.healthSnapshot || null;
let healthReport = healthSnapshot?.connected === true ? (state.healthReport || analyzeVehicleHealth(healthSnapshot)) : null;
let earlyWarning = state.earlyWarning || null;
let futureFuelAlerts = state.futureFuelAlerts || [];
let futureFuelAlertsStatus = state.futureFuelAlertsStatus || 'idle';
let futureFuelAlertsCheckedAt = state.futureFuelAlertsCheckedAt || '';
let nearbyStations = { status:'idle', stations:[], source:'', checkedAt:'', price:null, priceUpdatedAt:'' };
let pendingDocumentDraft = null;
let pendingBarcodeResult = null;
let pendingReceiptDraft = null;
let documentOcrBusy = false;
let tripWatchId = null;
let lastTripPersistAt = 0;
let parkGpsDraft = null;

state.drivers ||= [];
state.emergencies ||= [];
state.accidents ||= [];
state.insurance ||= [];
state.maintenance ||= [];

const ico = (name, size = 20) => {
  const paths = {
    motorcycle:'M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 14h8l-2-5h-3l-2 2m3-2 2 2m-5 3h-1', fuel:'M9 3h6v4l2 3v10H7V10l2-3V3Zm1 3v2h4V6h-4Zm-1 6v6h6v-6H9Z',
    home:'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3v-10.5Z', car:'M5 16 6.5 9h11L19 16v4h-2v-2H7v2H5v-4Zm3-5-1 3h10l-1-3H8Zm1.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    map:'M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Zm0-9.3a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z',
    chart:'M5 20V10h3v10H5Zm5 0V4h3v16h-3Zm5 0v-7h3v7h-3Z', user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.4-4 2.9-6 7-6s6.6 2 7 6H5Z',
    settings:'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5-.1-.8 2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.4-.8L16.3 4h-4l-.4 2.5a8 8 0 0 0-1.4.8l-2.4-1-2 3.4 2 1.5-.1.8.1.8-2 1.5 2 3.4 2.4-1c.4.3.9.6 1.4.8l.4 2.5h4l.4-2.5c.5-.2 1-.5 1.4-.8l2.4 1 2-3.4-2-1.5.1-.8Z',
    bell:'M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4', park:'M7 21V3h6.3a5 5 0 1 1 0 10H10v8H7Zm3-15v4h3.1a2 2 0 1 0 0-4H10Z',
    alert:'M12 3 2.5 20h19L12 3Zm1 13h-2v-5h2v5Zm0 2h-2v-2h2v2Z', phone:'M7 4h3l1.3 4-2 1.5a15 15 0 0 0 5.2 5.2l1.5-2 4 1.3v3c0 1.1-.9 2-2 2C11.4 19 5 12.6 5 5.9 5 4.9 5.9 4 7 4Z', shield:'M12 3 20 6v5c0 5.2-3.4 8.5-8 10-4.6-1.5-8-4.8-8-10V6l8-3Z', wrench:'m14.7 6.3 3-3a5 5 0 0 0-6.2 6.2L5 16a2.8 2.8 0 1 0 4 4l6.5-6.5a5 5 0 0 0 6.2-6.2l-3 3-4-1-1-4Z', share:'M18 8a3 3 0 1 0-2.8-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 2.8 4A3 3 0 0 0 6 15Zm12 5a3 3 0 1 0-2.8-4A3 3 0 0 0 18 20ZM8.6 14.3l6.8-4.1M8.6 9.7l6.8 4.1', gps:'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l2.8 2.8m8.4 8.4L19 19M19 5l-2.8 2.8m-8.4 8.4L5 19M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', file:'M6 2h8l4 4v16H6V2Zm7 1v4h4', receipt:'M5 3h14v18l-2-1.4L15 21l-3-1.4L9 21l-2-1.4L5 21V3Zm4 5h6M9 12h6M9 16h4',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v5l3.4 2', star:'m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z',
    plus:'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z', close:'M6 6l12 12M18 6 6 18', chevron:'m9 5 7 7-7 7', refresh:'M19 8V4l-2 2a7 7 0 1 0 1.6 7.5', cloud:'M7 18h10a4 4 0 0 0 .6-7.9A6 6 0 0 0 6.2 8.5 4.8 4.8 0 0 0 7 18Z', pin:'M8 3h8v5l2 3-4 2v7l-2 1-2-1v-7l-4-2 2-3V3Z',
    google:'M20.4 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h4.7a4 4 0 0 1-1.7 2.6v2.3h2.8c1.6-1.5 2.6-3.8 2.6-6.6ZM12 21c2.4 0 4.5-.8 6-2.2l-2.8-2.3c-.8.5-1.8.8-3.2.8-2.4 0-4.5-1.6-5.2-3.8H3.9v2.4A9 9 0 0 0 12 21ZM6.8 13.5a5.4 5.4 0 0 1 0-3.4V7.7H3.9a9 9 0 0 0 0 8.1l2.9-2.3ZM12 6.3c1.5 0 2.9.5 4 1.6l3-3A9 9 0 0 0 3.9 7.7l2.9 2.4c.7-2.2 2.8-3.8 5.2-3.8Z', bluetooth:'M12 3v18m0-18 6 6-6 3m0 0 6 6-6 3M6 7l12 10M6 17 12 11', backup:'M12 3v11m0 0 4-4m-4 4-4-4M5 19h14', route:'M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.8c2-1.6 3.5-1.1 5.2.2 1.4 1.1 2.4.8 3.3-.1', road:'M4 5h16M4 19h16M8 3v18m8-18v18', badge:'m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3Z', camera:'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', image:'M4 5h16v14H4V5Zm2 11 3.5-4 2.5 3 2-2 4 3M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', hgs:'M4 7h16v10H4V7Zm4 3h8m-8 3h5', check:'m5 12 4 4L19 6', filter:'M4 6h16M7 12h10m-7 6h4', logout:'M10 5H5v14h5m4-10 4 3-4 3m-5-3h9'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.star}"/></svg>`;
};
const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const money = value => `${Number(value).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} ₺`;
const uid = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
const persist = () => { save(state); render(); };
const displayNow = () => new Date().toLocaleString('tr-TR', { dateStyle:'short', timeStyle:'short', timeZone:'Europe/Istanbul' });
function rememberLocationResult(result, persistState = true) {
  const status = result?.ok ? 'granted' : result?.status || (result?.permission === 'denied' ? 'denied' : 'unavailable');
  state.locationAccess = { ...(state.locationAccess || {}), status, permission:result?.permission || state.locationAccess?.permission || 'unknown', serviceEnabled:result?.ok ? true : result?.serviceEnabled ?? state.locationAccess?.serviceEnabled ?? null, checkedAt:displayNow(), message:result?.message || '' };
  if (persistState) save(state);
  return state.locationAccess;
}
function locationAccessCopy() {
  const access = state.locationAccess || {};
  if (access.status === 'granted') return { status:'granted', title:'Konum izni açık', detail:'Yakındaki istasyonlar, park, acil durum ve sürüş kaydı gerektiğinde ön planda GPS ölçümü yapabilir.', tone:'ok', action:'Konum bilgisi' };
  if (access.status === 'service-off') return { status:'service-off', title:'Cihaz konum servisi kapalı', detail:'Android Ayarlar > Konum bölümünü açın; izin verilmiş olsa bile cihaz anahtarı kapalıyken koordinat alınamaz.', tone:'warn', action:'Tekrar dene' };
  if (access.status === 'denied') return { status:'denied', title:'Konum izni kapalı', detail:'Android Ayarlar > Uygulamalar > Sürüş Cepte > İzinler > Konum yolundan izin verin.', tone:'warn', action:'Konumu aç / tekrar dene' };
  return { status:'unknown', title:'Konum izni gerekli', detail:'Yakındaki istasyon listesini ve GPS kayıtlarını kullanmak için uygulamaya konum izni verin.', tone:'warn', action:'Konumu aç' };
}
function parseCheckedAt(value) { const text=String(value || ''); const match=text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[ ,]+(\d{1,2}):(\d{2})/); if (match) return new Date(Number(match[3]), Number(match[2])-1, Number(match[1]), Number(match[4]), Number(match[5])); const date=new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function priceFreshness(value) { const date=parseCheckedAt(value); if (!date) return { label:'Kontrol zamanı bekleniyor', tone:'muted' }; const minutes=Math.max(0, Math.round((Date.now()-date.getTime())/60000)); if (minutes <= 30) return { label:`Güncel kontrol · ${minutes} dk önce`, tone:'fresh' }; if (minutes <= 180) return { label:`Kontrol ${minutes} dk önce`, tone:'warn' }; return { label:`Eski kontrol · ${Math.round(minutes/60)} sa önce`, tone:'stale' }; }
function amountWords(value) { const number=Number(value); if (!Number.isFinite(number)) return 'tutarı'; const whole=Math.floor(number); const kuruş=Math.round((number-whole)*100); return `${whole} lira${kuruş ? ` ${String(kuruş).padStart(2,'0')} kuruş` : ''}`; }
function alertDateWords(value) { const match=String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) return value || 'belirtilen tarihten'; const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']; return `${Number(match[3])} ${months[Number(match[2])-1]} ${match[1]}`; }
function futureAlertSentence(alert) { const product=alert.product === 'motorin' ? 'motorinin' : alert.product === 'benzin' ? 'benzinin' : 'LPG’nin'; const change=alert.direction === 'down' ? 'indirim' : 'zam'; return alert.status === 'active' ? `${alertDateWords(alert.effectiveDate)} tarihinde ${product} litre fiyatına ${amountWords(alert.amount)} ${change} uygulanması bekleniyordu; canlı pompa ortalamasıyla teyit ediliyor.` : `${alertDateWords(alert.effectiveDate)} tarihinden itibaren ${product} litre fiyatına ${amountWords(alert.amount)} ${change} gelmesi bekleniyor.`; }
function futureAlertCard(alert) {
  if (futureFuelAlertsStatus === 'loading') return `<div class="notice-card future-alert-loading"><div class="notice-icon pulse">${ico('refresh',20)}</div><div><strong>Gelecek fiyat değişiklikleri kontrol ediliyor…</strong><p>Ekonomim, CNN Türk, Diken, PÜİS ve EPDK kaynaklarında ürün–tutar–tarih eşleşmesi aranıyor.</p></div></div>`;
  if (futureFuelAlertsStatus === 'error') return `<div class="notice-card warning"><div class="notice-icon">${ico('alert',20)}</div><div><strong>Gelecek fiyat uyarısı alınamadı</strong><p>Kaynaklar okunamadı. Bu, zam veya indirim olmadığı anlamına gelmez.</p></div><button class="secondary-button" data-action="refresh-fuel-alerts">Tekrar dene</button></div>`;
  if (!alert) return `<div class="notice-card"><div class="notice-icon">${ico('clock',20)}</div><div><strong>Doğrulanmış gelecek değişiklik bulunamadı</strong><p>Açık ürün, tutar ve yürürlük tarihi olan bir kaynak eşleşmesi yok. Uygulama tahmin uydurmaz; son kontrol: ${esc(futureFuelAlertsCheckedAt || 'bekleniyor')}.</p></div><button class="secondary-button" data-action="refresh-fuel-alerts">Kontrol et</button></div>`;
  const tone=alert.direction === 'down' ? 'down' : 'up';
  const sources=alert.sources?.map(source=>source.sourceName).join(' · ') || 'kaynak bilgisi yok';
  const active=alert.status === 'active';
  const changeLabel=active ? 'BUGÜN YÜRÜRLÜKTE' : alert.direction === 'down' ? 'İNDİRİM BEKLENTİSİ' : 'ZAM BEKLENTİSİ';
  return `<article class="future-alert-card ${tone} ${active ? 'active' : ''}"><div class="future-alert-top"><span class="chip ${tone === 'down' ? 'teal':'yellow'}">${changeLabel}</span><span class="future-confidence">${esc(alert.confidence || 'Düşük')} güven · ${alert.sourceCount || 0} yayın</span></div><strong>${esc(futureAlertSentence(alert))}</strong><p><b>Kaynaklar:</b> ${esc(sources)}<br><b>Son kontrol:</b> ${esc(futureFuelAlertsCheckedAt || '—')} · <b>Durum:</b> ${active ? 'Canlı fiyat teyidi bekleniyor' : 'Kesinleşmemiş beklenti'}</p><button class="text-button" data-action="future-alert-detail">Kaynak kanıtını gör ${ico('chevron',13)}</button></article>`;
}
function futureAlertDetailModal() {
  const alert=futureFuelAlerts.find(item=>item.status==='upcoming' || item.status==='active') || futureFuelAlerts[0];
  if (!alert) { openModal('Gelecek fiyat uyarısı','Henüz doğrulanabilir bir ürün–tutar–tarih eşleşmesi yok.','<div class="empty-card"><p>Kaynakları tekrar kontrol edin.</p></div>'); return; }
  const sourceRows=(alert.sources || []).map(source=>`<div class="source-detail-row"><b>${esc(source.sourceName)}</b><span>${esc(source.sourceTier)} · yayın tarihi: ${esc(source.publishedAt || 'belirtilmedi')}<br>${esc(source.evidence || 'Açık kaynak metni')}</span><button class="secondary-button" data-action="open-source" data-url="${esc(source.url)}">Kaynağı aç</button></div>`).join('');
  const checks=(state.futureFuelAlertChecks || []).map(check=>`<div class="metric-row"><span>${esc(check.name)}</span><b>${check.alertCount ? `${check.alertCount} eşleşme` : check.ok ? 'Eşleşme yok' : 'Okunamadı'}</b></div>`).join('');
  openModal('Gelecek fiyat uyarısı kanıtı','Bu kart kesinleşmiş pompa fiyatı değildir; kaynakların yayımladığı sektör beklentisini gösterir.',`<div class="notice-card ${alert.confidence === 'Yüksek' ? '' : 'warning'}"><div class="notice-icon">${ico(alert.direction==='down'?'chart':'alert',20)}</div><div><strong>${esc(alert.confidence)} güven · ${esc(alert.confidenceNote)}</strong><p>${esc(futureAlertSentence(alert))}</p></div></div><h4 class="modal-section-title">Kaynak kanıtları</h4><div class="source-detail">${sourceRows}</div>${checks ? `<h4 class="modal-section-title">Kontrol edilen resmi/sektör kaynakları</h4><div class="metric-list">${checks}</div>` : ''}<p class="muted" style="font-size:10px;line-height:1.5;margin-top:12px">Güven derecesi; yayıncı sayısı, kaynak katmanı, ürün–tutar–yürürlük tarihinin açık olması ve resmi teyit bulunup bulunmamasına göre verilir. PÜİS/EPDK resmi eşleşmesi yoksa kart “beklenti” olarak kalır. Yürürlük tarihinden sonra güncel pompa ortalamasıyla gerçekleşme ayrıca kontrol edilmelidir.</p><button class="primary-button full-button" data-action="close">Kapat</button>`);
}
function locationPromptPanel() {
  const access = locationAccessCopy();
  if (access.status === 'granted') return '';
  return `<section class="location-first-card ${access.status === 'denied' || access.status === 'service-off' ? 'warning' : ''}"><div class="location-first-icon">${ico('gps',24)}</div><div class="location-first-copy"><span class="eyebrow"><i class="eyebrow-dot"></i>İLK KULLANIM</span><h3>Konumunu aç</h3><p>${esc(access.detail)} Konum izni yalnızca istasyon, park, acil durum ve sürüş kaydı gibi ilgili özelliklerde kullanılır.</p></div><button class="primary-button" data-action="request-location">${esc(access.action)}</button></section>`;
}
function vehicleProfileDetails(profile) {
  if (!profile || profile.id === MANUAL_VEHICLE_PROFILE.id) return '<span class="muted">Model profili seçilmedi; depo, yakıt ve teknik bilgileri elle girebilirsiniz.</span>';
  const typeLabel = profile.vehicleType === 'motosiklet' ? 'Motosiklet' : profile.vehicleType === 'hafif-ticari' ? 'Hafif ticari' : 'Otomobil';
  const tankText = profile.tank == null ? 'Depo kapasitesi resmi kayıtta doğrulanmadı; kaydetmeden önce elle girin.' : `${profile.tank} L depo`;
  const consumptionText = profile.consumption == null ? 'Birleşik tüketim resmi kayıtta doğrulanmadı.' : `WLTP ${String(profile.consumption).replace('.',',')} L/100 km`;
  const engineText = profile.engine ? esc(profile.engine) : 'Motor/güç bilgisi resmi kayıtta belirtilmedi.';
  return `<b>${esc(profile.variant)} · ${typeLabel}</b><span>${engineText}</span><span>${esc(tankText)} · ${esc(consumptionText)}</span><small>${esc(profile.sourceLabel)} · versiyon ve donanıma göre değişebilir.</small>${profile.tip ? `<small class="vehicle-tip"><strong>Sürücü ipucu:</strong> ${esc(profile.tip)}</small>` : ''}${profile.sourceUrl ? `<a class="profile-source-link" href="${esc(profile.sourceUrl)}" target="_blank" rel="noreferrer">Resmi teknik kaynağı aç</a>` : ''}`;
}
function vehicleTankLabel(vehicle) { return Number(vehicle?.tank) > 0 ? `${Number(vehicle.tank)} L depo` : 'Depo kapasitesi belirtilmedi'; }
function vehicleCatalogSummary(profile) {
  const fuel = profile.fuel && profile.fuel !== 'Belirtilmedi' ? profile.fuel : 'Yakıt türü belirtilmedi';
  const tank = profile.tank == null ? 'Depo kapasitesi doğrulanmadı' : `${profile.tank} L depo`;
  const consumption = profile.consumption == null ? 'Tüketim doğrulanmadı' : `WLTP ${String(profile.consumption).replace('.',',')} L/100 km`;
  return `${fuel} · ${tank} · ${consumption}`;
}
function vehicleCatalogMarkup({ searchable = false } = {}) {
  const groups = [['otomobil','Otomobiller'],['hafif-ticari','Hafif ticari'],['motosiklet','Motosikletler']];
  const sections = groups.map(([type, label]) => {
    const profiles = VEHICLE_PROFILES.filter(profile => profile.vehicleType === type);
    if (!profiles.length) return '';
    const rows = profiles.map(profile => `<button class="card list-row catalog-row" data-catalog-row data-action="catalog-add" data-profile-id="${esc(profile.id)}" data-search-text="${esc(`${profile.brand} ${profile.model} ${profile.fuel} ${profile.engine}`.toLocaleLowerCase('tr-TR'))}"><i class="row-icon">${ico(type === 'motosiklet' ? 'motorcycle' : 'car',22)}</i><span class="row-main"><b>${esc(profile.brand)} ${esc(profile.model)}</b><span>${esc(vehicleCatalogSummary(profile))}</span></span><span class="catalog-add-label">Ekle</span>${ico('chevron',16)}</button>`).join('');
    return `<section class="catalog-section" data-catalog-section="${type}"><div class="section-head"><h3>${label}</h3><span class="muted">${profiles.length} model</span></div>${rows}</section>`;
  }).join('');
  const manual = `<section class="catalog-section"><div class="section-head"><h3>Manuel profil</h3></div><button class="card list-row catalog-row" data-action="catalog-add" data-profile-id="manual"><i class="row-icon">${ico('car',22)}</i><span class="row-main"><b>Diğer araç</b><span>Marka, model ve depo kapasitesini kendiniz girin</span></span><span class="catalog-add-label">Ekle</span>${ico('chevron',16)}</button></section>`;
  return `${searchable ? '<div class="catalog-search"><input type="search" data-catalog-search placeholder="Marka veya model ara" aria-label="Araç kataloğunda ara"></div>' : ''}<div data-catalog-list>${sections}${manual}</div>`;
}
function refuelStats(vehicle, percent, records = refuelPriceRecords) {
  const level = Math.min(100, Math.max(0, Number(percent) || 0));
  const rawTank = Number(vehicle?.tank);
  const hasTank = Number.isFinite(rawTank) && rawTank > 0;
  const tank = hasTank ? rawTank : 0;
  const currentLiters = tank * level / 100;
  const needed = Math.max(0, tank - currentLiters);
  const selected = records.find(row => row.district === state.location?.district && row.live && row.price != null) || records.find(row => row.live && row.price != null);
  const unitPrice = Number(selected?.price);
  const profile = vehicleProfileById(vehicle?.profileId);
  return {
    level, tank, hasTank, currentLiters, needed, selected, unitPrice, profile,
    costText: !hasTank ? 'Depo kapasitesi girilmeli' : Number.isFinite(unitPrice) && unitPrice > 0 ? money(needed * unitPrice) : 'Canlı fiyat bekleniyor',
    priceText: !hasTank ? 'Depo bilgisi eksik' : Number.isFinite(unitPrice) && unitPrice > 0 ? `${money(unitPrice)}/L` : 'Fiyat bekleniyor',
    rangeText: hasTank && profile.consumption ? `${Math.round((currentLiters / profile.consumption) * 100).toLocaleString('tr-TR')} km · mevcut seviye` : 'Model tüketim bilgisi yok'
  };
}
function updateRefuelPage(percent) {
  const vehicle = state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!vehicle) return;
  const stats = refuelStats(vehicle, percent);
  refuelDraftVehicleId = vehicle.id;
  refuelDraftPercent = stats.level;
  const set = (name, value) => document.querySelectorAll(`[data-refuel-page-${name}]`).forEach(node => { node.textContent = value; });
  set('percent', `${stats.level}%`);
  set('liters', stats.hasTank ? `${stats.currentLiters.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L` : '—');
  set('needed', stats.hasTank ? `${stats.needed.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L Daha Gerekli` : 'Depo kapasitesi girilmeli');
  set('needed-short', stats.hasTank ? `${stats.needed.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L` : '—');
  set('cost', stats.costText);
  set('price', stats.priceText);
  set('range', stats.rangeText);
  set('level-label', `${stats.level}% · Depodaki Mevcut Yakıt Miktarı`);
  const dial = document.querySelector('[data-refuel-page-dial]');
  if (dial) dial.style.setProperty('--refuel-angle', `${stats.level * 1.8}deg`);
  const slider = document.querySelector('[data-refuel-page-slider]');
  if (slider) slider.style.setProperty('--slider-level', `${stats.level}%`);
}
function openRefuelView(vehicle = null) {
  const selectedVehicle = vehicle || state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!selectedVehicle) { state.view = 'vehicles'; persist(); toast('Dolum hesabı için önce aracınızı ekleyin.', true); return; }
  closeModal();
  state.selectedVehicleId = selectedVehicle.id;
  state.view = 'refuel';
  refuelDraftVehicleId = selectedVehicle.id;
  refuelDraftPercent = Number(selectedVehicle.fuelLevelPercent) || 0;
  const key = vehicleFuelKey(selectedVehicle.fuel);
  refuelPriceType = key;
  refuelPriceRecords = key === state.fuelType && priceRecords.length ? priceRecords : [];
  save(state);
  render();
  if (key && !refuelPriceRecords.length) getFuelPrices({ city:state.location.city, district:state.location.district, type:key }).then(rows => {
    if (state.view === 'refuel' && state.selectedVehicleId === selectedVehicle.id) { refuelPriceRecords = rows; render(); }
  }).catch(() => {});
}
function refuelView() {
  const vehicle = state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!vehicle) return `<main class="refuel-page"><div class="refuel-page-head"><button class="icon-button" data-view="vehicles" aria-label="Araçlara dön">${ico('chevron',20)}</button><div><div class="eyebrow">YAKIT</div><h2>Dolum Hesabı</h2></div></div><div class="card empty-card"><h3>Önce aracınızı ekleyin</h3><p>Model seçtiğinizde depo kapasitesi ve yakıt türü otomatik olarak hesaba katılır.</p><button class="primary-button full-button" data-action="add-vehicle">Araç ekle</button></div></main>`;
  const initialLevel = refuelDraftVehicleId === vehicle.id && refuelDraftPercent != null ? refuelDraftPercent : vehicle.fuelLevelPercent;
  const stats = refuelStats(vehicle, initialLevel);
  const sourceCount = stats.selected?.sourceCount || refuelPriceRecords.meta?.sourceCount || 0;
  const sourceText = stats.selected?.source || (sourceCount ? `${sourceCount} canlı kaynak` : 'Canlı kaynak kontrolü bekleniyor');
  const vehicleOptions = state.vehicles.map(item => `<option value="${esc(item.id)}" ${item.id === vehicle.id ? 'selected':''}>${esc(item.brand)} ${esc(item.model)} · ${esc(item.plate)}</option>`).join('');
  return `<main class="refuel-page"><div class="refuel-page-head"><button class="icon-button" data-view="home" aria-label="Ana sayfaya dön">${ico('chevron',20)}</button><div><div class="eyebrow">YAKIT PLANLAMA</div><h2>Dolum Hesabı</h2><p>Depoyu ne kadar doldurmalısınız?</p></div><select class="refuel-vehicle-pill" data-refuel-page-vehicle aria-label="Aktif araç">${vehicleOptions}</select></div><form data-form="refuel-page"><section class="refuel-total"><span class="eyebrow">TAM DOLUM İÇİN KALAN TUTAR</span><strong data-refuel-page-cost>${esc(stats.costText)}</strong><b class="refuel-needed-badge">${ico('fuel',16)} <span data-refuel-page-needed>${stats.needed.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L Daha Gerekli</span></b><small>Seçili konum: ${esc(state.location?.city || 'konum bekleniyor')} · ${esc(sourceText)}</small></section><section class="refuel-white-card"><div class="refuel-dial" data-refuel-page-dial style="--refuel-angle:${stats.level * 1.8}deg"><div class="refuel-dial-inner"><span>E</span><b data-refuel-page-percent>${stats.level}%</b><span>D</span></div><i class="refuel-needle"></i><strong>Depodaki Mevcut Yakıt Miktarı</strong></div><div class="refuel-chips"><span class="chip teal">${ico('fuel',13)} ${esc(vehicle.fuel)}</span><span class="chip teal">${ico('fuel',13)} ${esc(vehicleTankLabel(vehicle))}</span></div><input class="refuel-slider" type="range" min="0" max="100" step="1" name="fuelLevelPercent" data-refuel-page-slider value="${stats.level}" aria-label="Depodaki mevcut yakıt yüzdesi"><div class="refuel-slider-caption"><span>E</span><span data-refuel-page-level-label>${stats.level}% · Depodaki Mevcut Yakıt Miktarı</span><span>D</span></div><small class="refuel-hint">Depodaki yakıt miktarını ayarlayın. OBD veya araç sensörü bağlı değilse bu değer otomatik okunmaz.</small></section><section class="refuel-breakdown refuel-breakdown-light"><div><span>Depoda Mevcut Yakıt</span><b data-refuel-page-liters>${stats.currentLiters.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L</b></div><div><span>Tam Dolum İçin Gerekli Yakıt</span><b data-refuel-page-needed-short>${stats.needed.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L</b></div><div><span>Canlı Birim Fiyat</span><b data-refuel-page-price>${esc(stats.priceText)}</b></div><div><span>Tahmini Menzil</span><b data-refuel-page-range>${esc(stats.rangeText)}</b></div></section><section class="refuel-model-strip"><div><span class="eyebrow">MODEL PROFİLİ</span><b>${esc(vehicle.brand)} ${esc(vehicle.model)}</b><small>${esc(stats.profile.variant || 'Manuel araç profili')} · ${esc(vehicleTankLabel(vehicle))}</small></div><button type="button" class="secondary-button" data-view="vehicles">Aracı değiştir</button></section><button class="primary-button full-button refuel-save-button" type="submit">Yakıt seviyesini kaydet</button></form></main>`;
}
function updateRefuelCalculator(percent) {
  const vehicle = state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!vehicle) return;
  const level = Math.min(100, Math.max(0, Number(percent) || 0));
  const rawTank = Number(vehicle.tank);
  const hasTank = Number.isFinite(rawTank) && rawTank > 0;
  const tank = hasTank ? rawTank : 0;
  const currentLiters = tank * level / 100;
  const needed = Math.max(0, tank - currentLiters);
  const key = vehicleFuelKey(vehicle.fuel);
  const selected = refuelPriceRecords.find(row => row.district === state.location.district && row.live && row.price != null) || refuelPriceRecords.find(row => row.live && row.price != null);
  const unitPrice = Number(selected?.price);
  const profile = vehicleProfileById(vehicle.profileId);
  const set = (name, value) => document.querySelectorAll(`[data-refuel-${name}]`).forEach(node => { node.textContent = value; });
  set('percent', `${level}%`);
  set('liters', hasTank ? `${currentLiters.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L` : '—');
  set('needed', hasTank ? `${needed.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} L` : '—');
  set('cost', !hasTank ? 'Depo kapasitesi girilmeli' : Number.isFinite(unitPrice) && unitPrice > 0 ? money(needed * unitPrice) : 'Canlı fiyat bekleniyor');
  set('price', !hasTank ? 'Depo bilgisi eksik' : Number.isFinite(unitPrice) && unitPrice > 0 ? `${money(unitPrice)}/L` : 'Fiyat bekleniyor');
  set('range', hasTank && profile.consumption ? `${Math.round((currentLiters / profile.consumption) * 100).toLocaleString('tr-TR')} km · mevcut seviye` : 'Model tüketim bilgisi yok');
  set('level-label', `${level}% · ayarlanan seviye`);
  const gauge = document.querySelector('[data-refuel-gauge]'); if (gauge) gauge.style.width = `${level}%`;
}
function refuelCalculatorModal(vehicle = null) {
  const selectedVehicle = vehicle || state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!selectedVehicle) { openModal('Dolum hesabı','Önce kendi aracınızı ekleyin.','<div class="empty-card"><p>Aracınızın modelini seçtiğinizde depo kapasitesi ve model bilgileri otomatik doldurulur.</p><button class="primary-button full-button" data-action="add-vehicle">Araç ekle</button></div>'); return; }
  state.selectedVehicleId = selectedVehicle.id;
  const key = vehicleFuelKey(selectedVehicle.fuel);
  const profile = vehicleProfileById(selectedVehicle.profileId);
  const level = Number.isFinite(Number(selectedVehicle.fuelLevelPercent)) ? Number(selectedVehicle.fuelLevelPercent) : 0;
  const vehicleOptions = state.vehicles.map(item => `<option value="${esc(item.id)}" ${item.id === selectedVehicle.id ? 'selected':''}>${esc(item.brand)} ${esc(item.model)} · ${esc(item.plate)}</option>`).join('');
  openModal('Dolum hesabı','Depoyu ne kadar doldurmalısınız? Canlı litre fiyatı ve seçtiğiniz model profili birlikte kullanılır.',`<form data-form="refuel"><div class="refuel-select"><label>Aktif araç</label><select name="vehicleId" data-refuel-vehicle>${vehicleOptions}</select></div><div class="refuel-hero"><span class="eyebrow">TAM DOLUM İÇİN KALAN TUTAR</span><strong data-refuel-cost>Hesaplanıyor…</strong><span data-refuel-needed>0,0 L</span></div><div class="refuel-card"><div class="refuel-gauge"><div class="refuel-gauge-track"><i data-refuel-gauge style="width:${level}%"></i></div><div class="refuel-gauge-label"><span>E</span><b data-refuel-percent>${level}%</b><span>D</span></div><strong data-refuel-level-label>${level}% · ayarlanan seviye</strong></div><div class="refuel-chips"><span class="chip teal">${ico('fuel',13)} ${esc(selectedVehicle.fuel)}</span><span class="chip teal">${ico('fuel',13)} ${esc(vehicleTankLabel(selectedVehicle))}</span><span class="chip yellow">${esc(profile.engine || 'Model bilgisi')}</span></div><input class="refuel-slider" type="range" min="0" max="100" step="1" name="fuelLevelPercent" data-refuel-slider value="${level}" aria-label="Depodaki mevcut yakıt yüzdesi"><small class="refuel-hint">Depodaki yakıt miktarını ayarlayın. OBD veya araç sensörü bağlı değilse bu değer otomatik okunmaz.</small></div><div class="refuel-breakdown"><div><span>Depodaki mevcut yakıt</span><b data-refuel-liters>0,0 L</b></div><div><span>Tam dolum için gereken</span><b data-refuel-needed>0,0 L</b></div><div><span>Canlı birim fiyat</span><b data-refuel-price>Fiyat bekleniyor</b></div><div><span>Tahmini menzil</span><b data-refuel-range>Model bilgisi yok</b></div></div><div class="vehicle-profile-card"><div><span class="eyebrow">MODEL PROFİLİ</span><h4>${esc(selectedVehicle.brand)} ${esc(selectedVehicle.model)}</h4>${vehicleProfileDetails(profile)}</div>${profile.sourceUrl ? `<a href="${esc(profile.sourceUrl)}" target="_blank" rel="noreferrer" class="secondary-button">Kaynağı aç</a>` : ''}</div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Seviyeyi kaydet</button></div></form>`);
  refuelPriceType = key;
  refuelPriceRecords = key === state.fuelType ? priceRecords : [];
  updateRefuelCalculator(level);
  if (key && key !== state.fuelType) getFuelPrices({ city:state.location.city, type:key }).then(rows => { if (state.selectedVehicleId === selectedVehicle.id && modalLayer.classList.contains('open')) { refuelPriceRecords = rows; updateRefuelCalculator(level); } }).catch(() => updateRefuelCalculator(level));
}
const locationItems = city => city === 'İstanbul' ? districts : [{ name:city }];
const haversineKm = (a, b) => {
  if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return 0;
  const rad = Math.PI / 180; const dLat = (b.latitude - a.latitude) * rad; const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
function compressImage(file) {
  if (!file) return Promise.resolve(null);
  return new Promise(resolve => {
    const reader = new FileReader(); reader.onload = () => {
      const image = new Image(); image.onload = () => { const scale = Math.min(1, 900 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve({ name:file.name, dataUrl:canvas.toDataURL('image/jpeg', .72) }); }; image.onerror = () => resolve({ name:file.name, dataUrl:null }); image.src = reader.result;
    }; reader.onerror = () => resolve({ name:file.name, dataUrl:null }); reader.readAsDataURL(file);
  });
}
function compressImages(files) { return Promise.all(Array.from(files || []).slice(0, 8).map(compressImage)); }
function downloadJson(filename, data) { const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function toast(message, warn = false) {
  const node = document.createElement('div'); node.className = `toast${warn ? ' warn':''}`; node.textContent = message; toastStack.append(node);
  setTimeout(() => node.remove(), 3600);
}
function header() {
  const gpsReady = state.gps && state.locationAccess?.status === 'granted';
  return `<header class="topbar"><div class="brand"><span class="brand-mark brand-car brand-photo"><img src="assets/corolla-logo.png" alt="Toyota Corolla" /></span><h1>Sürüş Cepte</h1></div><div class="top-actions"><button class="gps-pill ${gpsReady ? '' : 'off'}" data-action="toggle-gps" aria-label="Konum erişimini yönet"><i class="gps-dot"></i>${gpsReady ? 'GPS açık' : 'GPS kapalı'}</button><button class="icon-button" data-action="settings" aria-label="Ayarlar">${ico('settings',20)}</button></div></header>`;
}
function nav() {
  const items = [['home','Ana Sayfa','home'],['vehicles','Araçlar','car'],['journey','Yolculuk','map'],['prices','Fiyatlar','chart'],['account','Hesap','user']];
  return `<nav class="bottom-nav" aria-label="Alt navigasyon">${items.map(([id,label,icon]) => `<button class="nav-item ${state.view === id ? 'active':''}" data-view="${id}" aria-current="${state.view === id ? 'page':'false'}"><span class="nav-symbol">${ico(icon,20)}</span><span>${label}</span></button>`).join('')}</nav>`;
}
function notificationPanel() {
  const current = state.notificationTab === 'current';
  const items = current ? state.notifications.filter(n => !n.seen) : state.notifications;
  const priceHistory = items.length ? items.slice(0,3).map(n => `<div class="notice-card price-change-notice ${n.kind === 'down' ? 'price-drop' : 'price-rise'}"><div class="notice-icon">${ico(n.kind === 'down' ? 'chart':'bell',20)}</div><div><strong><span class="notice-kicker">GERÇEKLEŞEN DEĞİŞİKLİK</span>${n.kind === 'down'?'Fiyat düşüşü doğrulandı':n.kind === 'up'?'Fiyat artışı doğrulandı':'Fiyat güncellemesi'} <span class="chip teal">${esc(n.date)}</span></strong><p>${esc(n.text)}</p>${n.sourceCount ? `<small class="notice-source">${esc(String(n.sourceCount))} tarih uyumlu canlı kaynak karşılaştırıldı.</small>` : ''}</div></div>`).join('') : '';
  return `<section><div class="section-head"><h3>Akaryakıt Bildirimleri</h3><button class="text-button" data-action="fuel-alert-sources">Kaynak güveni</button></div><div class="pill-tabs"><button data-action="notif-tab" data-tab="current" class="${current?'active':''}">Güncel</button><button data-action="notif-tab" data-tab="history" class="${!current?'active':''}">Geçmiş</button></div>${current ? `${futureAlertCard(futureFuelAlerts.find(item => item.status === 'upcoming' || item.status === 'active'))}${priceHistory || ''}` : `${futureFuelAlerts.filter(item => item.status === 'past').slice(0,2).map(item => `<div class="notice-card warning"><div class="notice-icon">${ico('clock',20)}</div><div><strong>Geçmiş beklenti · ${esc(item.effectiveDateLabel)}</strong><p>${esc(futureAlertSentence(item))} Gerçekleşme, sonraki canlı fiyat kontrolüyle ayrıca değerlendirilir.</p></div></div>`).join('')}${priceHistory || (!futureFuelAlerts.some(item => item.status === 'past') ? `<div class="notice-card"><div class="notice-icon">${ico('check',20)}</div><div><strong>Geçmiş bildirim yok</strong><p>Gerçekleşen fiyat değişiklikleri ve süresi geçmiş beklentiler burada tutulur.</p></div></div>` : '')}`}</section>`;
}
function earlyWarningPanel() {
  const result = earlyWarning?.risk;
  const level = result?.level || 'ANALİZ BEKLENİYOR';
  const tone = level === 'YÜKSEK' || level === 'ÇOK YÜKSEK' ? 'warn' : level === 'VERİ YOK' ? 'muted-risk' : '';
  const checked = earlyWarning?.checkedAt ? `Son kontrol: ${earlyWarning.checkedAt}` : 'EPDK + TCMB canlı ölçümüyle kontrol edilir';
  return `<section class="early-warning-card ${tone}"><div class="early-warning-head"><div><div class="eyebrow"><i class="eyebrow-dot"></i>ZAM ERKEN UYARISI</div><h3>${level}</h3><p>Kesin zam tahmini değil; EPDK il fiyatı ve TCMB kuru baskı göstergesi.</p></div><strong class="early-score">${result?.score == null ? '—' : `${result.score}`}<small>/100</small></strong></div><div class="early-warning-foot"><span>${esc(checked)}</span><button class="secondary-button" data-action="early-warning">${earlyWarning ? 'Yenile' : 'Analiz et'}</button></div></section>`;
}
function earlyWarningResultModal(payload, risk, errorMessage = '') {
  const fuel = payload?.prices?.[state.fuelType];
  const rows = [
    ['Seçili il', state.location.city],
    ['EPDK benzin', payload?.prices?.benzin],
    ['EPDK motorin', payload?.prices?.motorin],
    ['EPDK LPG', payload?.prices?.lpg],
    ['TCMB USD satış', payload?.usdTry],
    ['Kaynak tarihi', payload?.sourceDate || (payload?.fuelFallback ? payload.fallbackUpdatedAt : null) || 'Kaynakta tarih yayınlanmadı'],
    ['Kontrol zamanı', payload?.checkedAt || displayNow()],
  ].map(([label,value]) => `<div class="metric-row"><span>${esc(label)}</span><b>${typeof value === 'number' ? (label.includes('USD') ? `${value.toLocaleString('tr-TR',{minimumFractionDigits:4,maximumFractionDigits:4})} ₺` : `${value.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} ₺/L`) : esc(value || '—')}</b></div>`).join('');
  const move = risk?.fuelMove == null ? 'İkinci tarihli yakıt ölçümü bekleniyor' : `Yakıt değişimi: ${risk.fuelMove.toFixed(2).replace('.',',')}% · USD değişimi: ${risk.usdMove.toFixed(2).replace('.',',')}%`;
  const fallbackNotice = payload?.fuelFallback ? `<div class="notice-card"><div class="notice-icon">${ico('chart',20)}</div><div><strong>Güncel yakıt fallback’i kullanıldı</strong><p>EPDK resmi SOAP servisi yetki gerektirdiği için seçili yakıt değeri canlı dağıtıcı ortalamasından alındı: ${esc(payload.fuelSourceLabel || 'çoklu kaynak')}. Bu değer zam baskısı geçmişi için kullanılır; EPDK resmi sonucu değildir.</p></div></div>` : '';
  openModal('Zam baskısı analizi', payload?.disclaimer || 'ZIP içindeki EPDK + TCMB erken uyarı yaklaşımı.',`${errorMessage ? `<div class="notice-card warning"><div class="notice-icon">${ico('alert',20)}</div><div><strong>Resmi EPDK ölçümü alınamadı</strong><p>${esc(errorMessage)}</p></div></div>` : ''}${fallbackNotice}<div class="health-summary"><div class="health-score large ${risk?.level === 'YÜKSEK' || risk?.level === 'ÇOK YÜKSEK' ? 'warn':''}"><strong>${risk?.score == null ? '—' : risk.score}</strong><span>/100</span></div><div><b>${esc(risk?.level || 'VERİ YOK')}</b><p>${esc(risk?.reason || move)}</p></div></div><div class="metric-list">${rows}</div><p class="muted" style="font-size:10px;line-height:1.45;margin-top:12px">${esc(move)}. Bu gösterge fiyatın kesin artacağını söylemez; iki tarihli canlı ölçüm yoksa puan üretmez. ${payload?.errors?.length ? `Hatalar: ${payload.errors.join(' · ')}` : ''}</p><button class="primary-button full-button" data-action="close">Kapat</button>`);
}
async function earlyWarningModal() {
  openModal('Zam baskısı analizi','EPDK il bazlı fiyat servisi ve TCMB günlük gösterge kuru kontrol ediliyor…','<div class="empty-card"><p>Canlı resmi kaynak yanıtı bekleniyor. Veri alınamazsa puan uydurulmaz.</p></div>');
  try {
    const code = provinceCodes[state.location.city] || '34';
    let payload;
    let apiError = '';
    const nativeApp = Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.Capacitor?.getPlatform?.() === 'android');
    try {
      if (nativeApp) throw new Error('Native APK: yerel preview API kullanılmıyor');
      const response = await fetch(`/api/early-warning?province=${encodeURIComponent(code)}&city=${encodeURIComponent(state.location.city)}&type=${encodeURIComponent(state.fuelType)}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Erken uyarı API HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error('Yerel erken uyarı API JSON yerine HTML döndürdü');
      payload = await response.json();
    } catch (error) {
      apiError = error.message;
      payload = await getEarlyWarningLive({ provinceCode:code });
      if (!nativeApp && !apiError.startsWith('Native APK:') && !apiError.includes('JSON yerine HTML')) payload.errors = [...(payload.errors || []), `Yerel API: ${apiError}`];
    }
    if (!Number.isFinite(Number(payload.prices?.[state.fuelType]))) {
      try {
        const rows = await getFuelPrices({ city:state.location.city, type:state.fuelType });
        const selected = rows.find(row => row.live && row.district === state.location.district) || rows.find(row => row.live);
        if (selected?.price != null) payload = { ...payload, ok:true, fuelFallback:true, fuelSourceLabel:`${selected.sourceCount} canlı dağıtıcı kaynağı`, fallbackUpdatedAt:selected.updatedAt, prices:{ ...payload.prices, [state.fuelType]:selected.price } };
      } catch (error) { payload.errors = [...(payload.errors || []), `Canlı fiyat fallback’i: ${error.message}`]; }
    }
    const current = Number(payload.prices?.[state.fuelType]);
    const historyKey = `${code}:${state.fuelType}`;
    const previous = state.earlyWarningHistory?.[historyKey];
    const risk = payload.ok && Number.isFinite(current) && Number.isFinite(Number(payload.usdTry)) ? riskScore(current, previous?.price, payload.usdTry, previous?.usdTry) : { level:'VERİ YOK', score:null, reason:'EPDK canlı fiyatı veya TCMB kuru alınamadı; kesin analiz üretilmedi.' };
    if (payload.ok && Number.isFinite(current) && Number.isFinite(Number(payload.usdTry))) { state.earlyWarningHistory = { ...(state.earlyWarningHistory || {}), [historyKey]: { price:current, usdTry:Number(payload.usdTry), checkedAt:payload.checkedAt } }; }
    earlyWarning = { ...payload, risk };
    state.earlyWarning = earlyWarning;
    save(state);
    render();
    earlyWarningResultModal(payload, risk, payload.ok && !payload.authorityStatus ? '' : (payload.authorityStatus || (payload.errors || []).join(' · ') || 'Resmi kaynak yanıtı alınamadı.'));
  } catch (error) {
    earlyWarning = { risk:{ level:'VERİ YOK', score:null, reason:'Erken uyarı servisine erişilemedi.' }, checkedAt:displayNow() };
    state.earlyWarning = earlyWarning; save(state); render();
    earlyWarningResultModal({ prices:{}, errors:[error.message] }, earlyWarning.risk, error.message);
  }
}
function stationRouteUrl(station) { const query = `${station.latitude},${station.longitude}`; return globalThis.Capacitor?.isNativePlatform?.() ? `geo:${query}?q=${encodeURIComponent(station.name || 'Akaryakıt istasyonu')}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`; }
function nearbyStationsPanel() {
  const price = nearbyStations.price != null ? money(nearbyStations.price) : '—';
  const priceDate = nearbyStations.priceUpdatedAt || priceRecords.meta?.checkedAt || 'Canlı kontrol bekleniyor';
  const area = state.location?.district || state.location?.city || 'seçili konum';
  const activeVehicle = state.vehicles.find(vehicle => vehicle.id === state.selectedVehicleId);
  const access = locationAccessCopy();
  let body = `${access.tone !== 'ok' ? `<div class="notice-card location-notice ${access.tone === 'warn' ? 'warning' : ''}"><div class="notice-icon">${ico('gps',20)}</div><div><strong>${esc(access.title)}</strong><p>${esc(access.detail)}</p></div><button class="secondary-button" data-action="request-location">${esc(access.action)}</button></div>` : ''}<div class="nearby-discovery"><div class="nearby-discovery-icon">${ico('fuel',26)}</div><div class="nearby-discovery-copy"><span class="eyebrow"><i class="eyebrow-dot"></i>YAKIT NOKTALARI</span><b>Yakındaki petrol istasyonlarını bul</b><small>OPET, Shell, Petrol Ofisi ve diğer bilinen markaları en yakından uzağa listeler.</small></div><button class="primary-button nearby-find-button" data-action="nearby-stations">İstasyonları bul <span>${ico('chevron',15)}</span></button></div>`;
  if (nearbyStations.status === 'loading') body = `<div class="nearby-empty"><i class="station-brand pulse">${ico('gps',19)}</i><div><b>Konum ve istasyonlar aranıyor…</b><small>Yakındaki markalı istasyonlar OpenStreetMap dizininden okunuyor.</small></div></div>`;
  if (nearbyStations.status === 'error') body = `<div class="nearby-empty"><i class="station-brand coral">${ico('alert',19)}</i><div><b>İstasyon listesi alınamadı</b><small>${esc(nearbyStations.error || 'Konum izni veya internet bağlantısı gerekli.')}</small></div><button class="secondary-button" data-action="nearby-stations">Tekrar dene</button></div>`;
  if (nearbyStations.status === 'ready') {
    body = nearbyStations.stations.length ? nearbyStations.stations.map((station, index) => `<article class="station-row"><span class="station-rank">${index + 1}</span><span class="station-brand">${esc(station.brand)}</span><div class="station-main"><b>${esc(station.name)}</b><small>${station.distanceKm.toFixed(1)} km${station.street ? ` · ${esc(station.street)}` : ''}</small></div><div class="station-price"><strong>${price}</strong><small>${price === '—' ? 'Fiyat yok' : `${esc(area)} ilçe ort.`}</small></div><a class="station-route" href="${stationRouteUrl(station)}" target="_blank" rel="noreferrer" aria-label="${esc(station.name)} yol tarifi"><span>${ico('route',14)}</span><b>Git</b></a></article>`).join('') : `<div class="nearby-empty"><i class="station-brand yellow">${ico('fuel',19)}</i><div><b>Markalı istasyon bulunamadı</b><small>12 km çevrede OpenStreetMap üzerinde bilinen marka kaydı bulunamadı.</small></div><button class="secondary-button" data-action="nearby-stations">Yenile</button></div>`;
  }
  return `<section class="nearby-section"><div class="section-head"><div><h3>Yakınımdaki istasyonlar</h3><span class="muted" style="font-size:10px">En yakından uzağa · OPET · Shell · Petrol Ofisi${activeVehicle?.favoriteStation ? ` · Favori: ${esc(activeVehicle.favoriteStation)} önde` : ''}</span></div><button class="text-button" data-action="nearby-stations">${nearbyStations.status === 'ready' ? 'Yenile' : 'Konum bul'}</button></div><div class="nearby-card">${body}${nearbyStations.status === 'ready' ? `<div class="station-footnote">${nearbyStations.stations.length} markalı istasyon · ${esc(nearbyStations.source || 'OpenStreetMap / Overpass')} · ${esc(priceDate)}<br><span>${activeVehicle?.favoriteStation ? `Favori ${esc(activeVehicle.favoriteStation)} markası listede öne çıkarıldı. ` : ''}Gösterilen fiyat şubeye özel değildir; ${esc(area)} için canlı kaynakların doğrulanmış litre ortalamasıdır.</span></div>` : ''}</div></section>`;
}

function homeView() {
  const vehicle = state.vehicles.find(v => v.id === state.selectedVehicleId);
  const profile = vehicle ? vehicleProfileById(vehicle.profileId) : null;
  const totalKm = state.trips.reduce((sum,t)=>sum + Number(t.km || 0),0).toFixed(1);
  const latestPrice = priceRecords.find(x => x.district === state.location.district);
  const hasLivePrice = Boolean(priceRecords.meta?.live && latestPrice?.price != null);
  const priceText = hasLivePrice ? money(latestPrice.price) : '—';
  const priceCaption = hasLivePrice ? 'Canlı il fiyatı' : 'Canlı veri yok';
  const hasTrips = state.trips.length > 0;
  const fuelLevel = vehicle ? Math.max(0, Math.min(100, Number(vehicle.fuelLevelPercent) || 0)) : 0;
  const range = profile?.consumption ? Math.round((Number(vehicle?.tank || 0) * (fuelLevel / 100) / profile.consumption) * 100) : null;
  return `<main><div class="hero-card"><div class="hero-top"><div><div class="hero-label">BUGÜNÜN YAKIT PLANI</div><div class="hero-number">${vehicle ? esc(vehicle.plate) : 'Araç ekle'}</div><div class="hero-sub">${vehicle ? `${esc(vehicle.brand)} ${esc(vehicle.model)} · ${esc(vehicle.fuel)}` : 'Masraf ve bakım takibine hemen başla.'}</div></div><div class="hero-side"><span>${ico('fuel',18)}</span><strong>${priceText}</strong><span>${priceCaption}</span></div></div><div class="progress"><span style="width:${vehicle ? `${fuelLevel}%`:'0'}"></span></div><div class="hero-sub" style="margin-top:8px">${vehicle ? `${esc(vehicleTankLabel(vehicle))} · ${fuelLevel}% ayarlı seviye${range != null ? ` · Tahmini ${range} km` : ''}` : 'Bir araç ekleyerek kişisel menzil hesabını aç.'}</div>${vehicle ? '<button class="hero-refuel-button" data-action="refuel">Dolum hesabını aç</button>' : '<button class="hero-refuel-button" data-action="add-vehicle">Aracını ekle</button>'}</div>${homePriorityCard()}${notificationPanel()}${earlyWarningPanel()}${nearbyStationsPanel()}<section><div class="section-head"><h3>Hızlı İşlemler</h3><span class="muted" style="font-size:11px">Tek dokunuş</span></div><div class="quick-grid"><button class="quick-card" data-action="emergency"><i class="quick-icon">${ico('alert',19)}</i><b>Acil Konum</b><span>Konumu kaydet</span></button><button class="quick-card" data-action="park"><i class="quick-icon">${ico('park',20)}</i><b>Park Ettim</b><span>Yerini hatırla</span></button><button class="quick-card" data-action="accident"><i class="quick-icon">${ico('camera',20)}</i><b>Kaza & Belge</b><span>Hızlı kayıt</span></button></div></section><section><div class="section-head"><h3>Bugünkü Özet</h3><button class="text-button" data-view="journey">Yolculuklara git</button></div><div class="summary-strip"><div class="mini-stat"><div class="mini-label">${ico('route',14)} Son sürüş</div><strong>${hasTrips ? `${state.trips[0].km} km` : '—'}</strong><small>${hasTrips ? state.trips[0].title : 'Henüz sürüş kaydı yok'}</small></div><div class="mini-stat"><div class="mini-label">${ico('chart',14)} Toplam kayıtlı km</div><strong>${hasTrips ? `${totalKm} km` : '0 km'}</strong><small>${hasTrips ? 'Yerel kayıtlardan hesaplandı' : 'Sürüş başlatınca hesaplanır'}</small></div></div></section><section><div class="section-head"><h3>Son Hareketler</h3><button class="text-button" data-action="open-history">Geçmiş</button></div><div class="card list-card">${activityRows().slice(0,3).join('')}</div></section></main>`;
}
function activityRows() {
  const items = [
    ...(state.trips || []).map(t => ({icon:'route', color:'teal', title:t.title, subtitle:`${t.date} · ${t.duration}`, end:`${t.km} km`})),
    ...(state.parks || []).map(p => ({icon:'park', color:'yellow', title:p.title, subtitle:p.date, end:'Park'}))
  ];
  return items.length ? items.map(row => listRow(row)) : [listRow({icon:'clock',title:'Henüz hareket yok',subtitle:'İlk sürüşünü kaydet',end:''})];
}
const dateInputValue = value => value ? String(value).slice(0,10) : '';
function daysUntil(value) { if (!value) return null; const target = new Date(`${value}T23:59:59`); return Number.isNaN(target.getTime()) ? null : Math.ceil((target - Date.now()) / 86400000); }
function nextInsurance() { return [...(state.insurance || [])].filter(item => item.expiry).sort((a,b) => String(a.expiry).localeCompare(String(b.expiry)))[0] || null; }
function dueMaintenance() { const km = Number(state.settings.mileage || 0); return (state.maintenance || []).filter(item => !item.completed && ((item.dueDate && daysUntil(item.dueDate) <= 30) || (item.dueKm != null && Number(item.dueKm) <= km))).length; }
function driverCareCard() {
  const insurance = nextInsurance(); const insuranceDays = daysUntil(insurance?.expiry); const maintenanceDue = dueMaintenance();
  const insuranceText = insurance ? `${insurance.provider || 'Poliçe'} · ${dateInputValue(insurance.expiry)}${insuranceDays != null && insuranceDays <= 30 ? ` · ${Math.max(0, insuranceDays)} gün` : ''}` : 'Poliçe ve bitiş tarihi ekleyin';
  const maintenanceText = maintenanceDue ? `${maintenanceDue} bakım kalemi yaklaşıyor` : `${state.maintenance?.length || 0} planlı bakım · km ${Number(state.settings.mileage || 0).toLocaleString('tr-TR')}`;
  return `<section><div class="section-head"><h3>Sürücü merkezi</h3><span class="muted" style="font-size:11px">Hazır ve güvende</span></div><div class="card list-card">${listRow({icon:'shield',title:'Araç sigortası',subtitle:insuranceText,end:'Aç',action:'insurance'})}${listRow({icon:'wrench',color:maintenanceDue?'yellow':'teal',title:'Rutin bakım planı',subtitle:maintenanceText,end:maintenanceDue ? 'Kontrol':'Planla',action:'maintenance'})}</div></section>`;
}
function priorityCardItems() {
  const items = [];
  const activeAlert = (state.futureFuelAlerts || []).find(item => item.status === 'active' || item.status === 'upcoming');
  if (activeAlert) items.push({ key:'future-fuel-alert', tone:activeAlert.kind === 'down' ? 'teal' : 'coral', icon:activeAlert.kind === 'down' ? 'chart' : 'alert', kicker:'YAKITTA YAKLAŞAN DEĞİŞİKLİK', title:activeAlert.kind === 'down' ? 'İndirim beklentisi takipte' : 'Fiyat artışı beklentisi takipte', body:futureAlertSentence(activeAlert), action:'future-alert-detail', actionLabel:'Kaynağı ve tarihi gör' });
  const latestChange = (state.notifications || [])[0];
  if (latestChange) items.push({ key:'latest-price-change', tone:latestChange.kind === 'down' ? 'teal' : 'coral', icon:latestChange.kind === 'down' ? 'chart' : 'bell', kicker:'CANLI FİYAT DEĞİŞİKLİĞİ', title:latestChange.kind === 'down' ? 'Yakıt fiyatı düştü' : latestChange.kind === 'up' ? 'Yakıt fiyatı yükseldi' : 'Yakıt fiyatı güncellendi', body:latestChange.text || 'Kaynak karşılaştırmasıyla doğrulanan son değişikliği inceleyin.', action:'notifications', actionLabel:'Bildirim geçmişini aç' });
  const insurance = nextInsurance();
  const insuranceDays = daysUntil(insurance?.expiry);
  if (insurance && insuranceDays != null && insuranceDays <= 30) {
    const dayText = insuranceDays < 0 ? `${Math.abs(insuranceDays)} gün gecikti` : insuranceDays === 0 ? 'Bugün sona eriyor' : `${insuranceDays} gün kaldı`;
    items.push({ key:'insurance-reminder', tone:'yellow', icon:'shield', kicker:'SİGORTA HATIRLATMASI', title:'Poliçe yenileme zamanı yaklaşıyor', body:`${insurance.provider || 'Araç poliçesi'} · ${dateInputValue(insurance.expiry)} · ${dayText}`, action:'insurance', actionLabel:'Poliçeyi aç' });
  }
  const maintenanceDue = dueMaintenance();
  if (maintenanceDue) {
    const next = [...(state.maintenance || [])].find(item => !item.completed && ((item.dueDate && daysUntil(item.dueDate) <= 30) || (item.dueKm != null && Number(item.dueKm) <= Number(state.settings.mileage || 0))));
    items.push({ key:'maintenance-reminder', tone:'yellow', icon:'wrench', kicker:'BAKIM HATIRLATMASI', title:`${maintenanceDue} bakım kalemi yaklaşmış durumda`, body:next?.item ? `${next.item}${next.dueDate ? ` · ${dateInputValue(next.dueDate)}` : ''}` : 'Planlı bakım kayıtlarınızı kontrol edin.', action:'maintenance', actionLabel:'Bakım planını aç' });
  }
  if (state.locationAccess?.status !== 'granted') items.push({ key:'location-reminder', tone:'blue', icon:'gps', kicker:'KONUM HAZIRLIĞI', title:'Yakındaki istasyonlar için konumu açın', body:'Konum izni verilmeden GPS tabanlı istasyon, park ve acil durum kaydı kullanılamaz.', action:'request-location', actionLabel:'Konum erişimini yönet' });
  if (!state.vehicles.length) items.push({ key:'vehicle-setup', tone:'blue', icon:'car', kicker:'İLK ADIM', title:'Aracını ekle, uygulamayı kişiselleştir', body:'Model profili seçince depo kapasitesi, tüketim ve araca özel bilgi kartları açılır.', action:'add-vehicle', actionLabel:'Araç ekle' });
  const selected = state.vehicles.find(vehicle => vehicle.id === state.selectedVehicleId);
  if (selected) items.push({ key:'fuel-plan', tone:'blue', icon:'fuel', kicker:'GÜNÜN YAKIT PLANI', title:'Dolum hesabın hazır', body:`${selected.brand} ${selected.model} · ${selected.fuel} · depodaki seviyeyi ayarlayıp canlı fiyatla hesaplayın.`, action:'refuel', actionLabel:'Dolum hesabını aç' });
  return items;
}
function homePriorityCard() {
  const pinned = state.settings?.homePriorityPinned;
  const item = pinned && typeof pinned === 'object' ? pinned : priorityCardItems()[0];
  if (!item) return '';
  const isPinned = Boolean(pinned && typeof pinned === 'object');
  const pinAction = isPinned ? 'unpin-priority-card' : 'pin-priority-card';
  return `<section class="priority-home-card priority-${esc(item.tone || 'blue')}" data-priority-card><div class="priority-card-head"><span class="eyebrow"><i class="eyebrow-dot"></i>${esc(item.kicker || 'SÜRÜŞ CEPTE ODAK')}</span><button class="priority-pin ${isPinned ? 'active':''}" data-action="${pinAction}" data-priority-key="${esc(item.key)}" aria-label="${isPinned ? 'Öncelik kartını otomatik moda al' : 'Bu öncelik kartını sabitle'}">${ico('pin',17)}<span>${isPinned ? 'Sabit' : 'Sabitle'}</span></button></div><div class="priority-card-main"><i class="priority-card-icon">${ico(item.icon || 'bell',24)}</i><div><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div></div><div class="priority-card-foot"><button class="priority-card-cta" data-action="${esc(item.action)}">${esc(item.actionLabel || 'Aç')} ${ico('chevron',15)}</button><small>${isPinned ? 'Bu kart siz değiştirene kadar sabit kalır.' : 'Önem sırasına göre otomatik güncellenir.'}</small></div></section>`;
}
function listRow({icon='clock',color='',title,subtitle='',end='',action='', chip='', id=''}) {
  return `<button class="list-row" ${action ? `data-action="${action}"`:''}${id ? ` data-id="${esc(id)}"`:''}><i class="row-icon ${color}">${ico(icon,19)}</i><span class="row-main"><b>${esc(title)}</b><span>${esc(subtitle)}</span></span><span class="row-end">${chip ? `<span class="chip ${chip}">${esc(end)}</span>` : `<strong>${esc(end)}</strong>`}</span>${action ? `<i class="chev">${ico('chevron',16)}</i>`:''}</button>`;
}
function vehiclesView() {
  const tab = state.vehicleTab;
  const vehicleCards = state.vehicles.length ? state.vehicles.map(v => { const profile = vehicleProfileById(v.profileId); const level = Math.max(0, Math.min(100, Number(v.fuelLevelPercent) || 0)); return `<article class="card vehicle-card"><i class="vehicle-art">${profile.vehicleType === 'motosiklet' ? ico('motorcycle',56) : corollaIcon(56)}</i><div class="vehicle-data"><b>${esc(v.brand)} ${esc(v.model)}</b><span class="plate">${esc(v.plate)}</span><span>${esc(v.fuel)} · ${Number(v.km || 0).toLocaleString('tr-TR')} km · ${esc(vehicleTankLabel(v))} · depo ${level}%</span>${profile.id !== 'manual' ? `<span class="vehicle-profile-tag">${esc(profile.variant)} · resmi profil</span>` : ''}${v.favoriteStation ? `<span class="favorite-station">Favori: ${esc(v.favoriteStation)}</span>` : ''}</div><div class="vehicle-card-actions"><button class="secondary-button" data-action="refuel" data-id="${v.id}">Dolum</button><button class="star-button ${state.selectedVehicleId === v.id ? 'active':''}" data-action="select-vehicle" data-id="${v.id}" aria-label="Aktif araç seç">${ico('star',20)}</button><button class="icon-button" data-action="edit-vehicle" data-id="${v.id}" aria-label="Aracı düzenle">${ico('settings',17)}</button></div></article>`; }).join('') : `<div class="card empty-card"><i class="empty-illustration car-empty">${corollaIcon(86)}</i><h3>Aracını ekleyerek başla</h3><p>Model profili seçildiğinde depo kapasitesi ve doğrulanmış teknik bilgiler otomatik gelir. OBD ve sağlık analizi bu araç üzerinden tutulur.</p><button class="primary-button" data-action="add-vehicle">Araç ekle</button></div>`;
  const catalog = vehicleCatalogMarkup();
  const hasHealth = Boolean(healthSnapshot?.connected === true && healthReport);
  const healthCard = `<section><div class="section-head"><h3>OBD araç sağlığı</h3><button class="text-button" data-action="obd">${healthSnapshot?.connected ? 'Bağlı':'Bağlan'}</button></div><div class="card health-card"><div class="health-score ${hasHealth && healthReport.score < 65 ? 'warn':''}"><strong>${hasHealth ? healthReport.score : '—'}</strong>${hasHealth ? '<span>/100</span>':''}</div><div class="health-copy"><b>${hasHealth ? healthReport.level : healthSnapshot ? 'OBD bağlantısı yok' : 'Ölçüm bekleniyor'}</b><span>${hasHealth ? (healthReport.findings[0]?.title || 'Sonuç hazır') : 'Gerçek araç sağlığı için ELM327 adaptörü bağlayın'}</span><small>${healthSnapshot?.connected ? healthSnapshot.source : healthSnapshot ? 'Canlı OBD verisi yok; demo/test verisi gösterilmiyor' : 'Henüz araçtan veri okunmadı'}</small></div><button class="icon-button" data-action="obd" aria-label="OBD bağlantısını aç">${ico('chevron',18)}</button></div></section>`;
  const driverRows = [listRow({icon:'user',title:'Siz',subtitle:'Ana sürücü · Tüm araçlar',end:'Aktif',chip:'teal'}), ...state.drivers.map(driver => listRow({icon:'user',title:driver.name,subtitle:`${driver.email} · ${driver.role}`,end:'Kaldır',action:'remove-driver',chip:'yellow',id:driver.id}))].join('');
  return `<main><div class="view-heading"><div><div class="eyebrow"><i class="eyebrow-dot"></i>ARAÇ YÖNETİMİ</div><h2>Araçlar</h2><p>Yakıt, bakım ve sürücü bilgileri.</p></div></div><div class="pill-tabs"><button class="${tab === 'vehicles'?'active':''}" data-action="vehicle-tab" data-tab="vehicles">Araçlarım</button><button class="${tab === 'drivers'?'active':''}" data-action="vehicle-tab" data-tab="drivers">Sürücüler</button><button class="${tab === 'catalog'?'active':''}" data-action="vehicle-tab" data-tab="catalog">Katalog</button></div><button class="vehicle-hero" data-action="receipt"><i>${ico('receipt',30)}</i><span><strong>Fiş oku</strong><p>Kamerayı aç, fişi cihazda OCR ile metne dönüştür. Plaka eşleşirse araca bağlanır.</p></span><i class="chev">${ico('chevron',19)}</i></button>${tab === 'vehicles' ? `${vehicleCards}${healthCard}${driverCareCard()}` : tab === 'drivers' ? `<section><div class="section-head"><h3>Yetkili sürücüler</h3><button class="text-button" data-action="add-driver">Sürücü ekle</button></div><div class="card list-card">${driverRows}</div></section>` : catalog}<button class="fab" data-action="add-vehicle" aria-label="Araç ekle">${ico('plus',25)}</button></main>`;
}
function journeyView() {
  const live = state.activeTrip;
  const trips = (state.trips || []).slice(0,3);
  const liveKm = live ? Number(live.distanceKm || 0).toFixed(1) : '0.0';
  const candidate = live?.autoParkCandidate || state.pendingParkCandidate;
  const candidateCard = candidate ? `<div class="auto-park-card"><div class="auto-park-icon">${ico('park',20)}</div><div class="auto-park-copy"><b>Olası park noktası algılandı</b><span>${Math.max(1, Math.round(Number(candidate.stationaryMinutes || 0)))} dk sabit konum · ±${candidate.accuracy ? Math.round(candidate.accuracy) : '—'} m doğruluk</span></div><div class="auto-park-actions"><button class="primary-button" data-action="save-auto-park">Park olarak kaydet</button><button class="secondary-button" data-action="dismiss-auto-park">Yok say</button></div></div>` : '';
  return `<main><div class="view-heading"><div><div class="eyebrow"><i class="eyebrow-dot"></i>YOLCULUK MERKEZİ</div><h2>Yolculuk</h2><p>Sürüşü başlatın veya geçmişe göz atın.</p></div></div>${live ? `<div class="card trip-live"><div class="live-top"><span class="live-state"><i class="pulse"></i>Sürüş kaydediliyor</span><span class="chip teal">${esc(live.type)}</span></div><div class="trip-time" id="tripTimer">00:00</div><div class="trip-km" id="tripKm">GPS ile ölçülen mesafe: ${liveKm} km${live.kmSource ? ` · ${esc(live.kmSource)}` : ''}</div><div class="trip-actions"><button class="secondary-button" data-action="trip-note">Not ekle</button><button class="primary-button" data-action="end-trip">Sürüşü bitir</button></div></div>${candidateCard}` : `${candidateCard}<div class="card empty-card" style="padding:24px 20px"><i class="empty-illustration">${ico('route',29)}</i><h3>Sürüşe hazır mısın?</h3><p>Başlatınca GPS konumları yüksek doğrulukla ön planda izlenir; izin verilmezse kilometre uydurulmaz ve 0 km kaydedilir.</p><button class="primary-button full-button" data-action="start-trip">Sürüşü Başlat</button></div>`}<section><div class="section-head"><h3>Kısayollar</h3><span class="muted" style="font-size:11px">Kayıt odaklı</span></div><div class="card list-card">${listRow({icon:'clock',title:'Geçmiş sürüşler',subtitle:'Düzenle veya gerektiğinde sil',end:trips.length,action:'open-history'})}${listRow({icon:'park',color:'yellow',title:'Geçmiş parklar',subtitle:'Konumu aç, düzenle veya sil',end:state.parks.length,action:'open-parks'})}${listRow({icon:'alert',color:'coral',title:'Kaza kayıtları',subtitle:'Hızlı kayıt veya tutanak oluştur',end:state.accidents.length,action:'accident'})}${listRow({icon:'camera',title:'Yolculuk belgeleri',subtitle:'Kaza ve fiş kayıtlarını gör',end:'Aç',action:'documents'})}${listRow({icon:'shield',title:'Araç sigortası',subtitle:'Poliçe, bitiş ve asistans bilgileri',end:'Aç',action:'insurance'})}${listRow({icon:'wrench',color:'yellow',title:'Rutin bakım planı',subtitle:'Tarih ve kilometre takibi',end:'Aç',action:'maintenance'})}${listRow({icon:'hgs',color:'yellow',title:'Otoyol geçişleri (HGS/OGS)',subtitle:'Geçiş ekleyin, gider raporuna kaydedin',end:state.hgs.length,action:'hgs'})}${listRow({icon:'badge',title:'Rozetler',subtitle:'Sürüş başarılarını görüntüle',end:'Rozetler',action:'badges'})}${listRow({icon:'chart',title:'Sürüş raporu',subtitle:'İş, kişisel ve aile km dağılımı',end:'Rapor',action:'report'})}</div></section><section><div class="section-head"><h3>Son sürüşler</h3><button class="text-button" data-action="open-history">Tümü</button></div><div class="card list-card">${trips.length ? trips.map(t => listRow({icon:'route',title:t.title,subtitle:`${t.date} · ${t.duration}${t.note ? ` · ${t.note}` : ''}`,end:`${t.km} km`,action:'edit-trip',id:t.id})).join('') : '<div class="empty-card"><p>Henüz sürüş kaydı yok.</p></div>'}</div></section></main>`;
  }
function pricesView() {
  const current = state.fuelType;
  const fallback = locationItems(state.location.city).map(item => ({ city:state.location.city, district:item.name, price:null, updatedAt:'Canlı veri alınamadı', live:false, sourceCount:0, cityReference:false }));
  const all = priceRecords.length ? priceRecords : fallback;
  const records = state.pricesOnlyFavorites ? all.filter(p => state.favorites.includes(p.district)) : all;
  const meta = priceRecords.meta || { live:false, trusted:false, sourceCount:0, sources:[], authority:FUEL_SOURCES.epdk, note:'İlk canlı yenileme bekleniyor.' };
  const selectedRecord = priceRecords.find(row => row.district === state.location.district) || priceRecords[0];
  const selectedSourceCount = selectedRecord?.sourceCount || 0;
  const sourceNames = selectedRecord?.source || (meta.sources || []).filter(source => source.ok).map(source => source.name).join(' · ');
  const headline = selectedRecord?.trusted ? `${selectedSourceCount} tarih uyumlu canlı kaynağın ortalaması` : selectedSourceCount >= 2 ? `${selectedSourceCount} canlı kaynak okundu; tarih uyumu doğrulanamadı` : selectedSourceCount === 1 ? 'Tek canlı kaynak okundu' : 'Canlı fiyat gösterilmiyor';
  const scopeLabel = state.location.city === 'İstanbul' ? 'ilçe' : 'il geneli';
  const nearbyLabel = meta.nearby?.length ? ` · Çevre il referansı: ${meta.nearby.join(', ')}` : '';
  const freshness = priceFreshness(meta.checkedAt);
  return `<main><div class="view-heading"><div><div class="eyebrow"><i class="eyebrow-dot"></i>GÜNCEL FİYATLAR</div><h2>Fiyatlar</h2><p>Seçtiğiniz ${scopeLabel} için erişilebilen, kapsamı ve tarihi uyumlu dağıtıcı ve NSoft kaynaklarını izleyin.</p></div><button class="icon-button" data-action="refresh-prices" aria-label="Fiyatları yenile">${ico('refresh',19)}</button></div><button class="card location-card" data-action="location"><i class="location-pin">${ico('map',22)}</i><span><b>${esc(state.location.city)}</b><span>${esc(state.location.district)} ${state.location.city === 'İstanbul' ? 'seçili ilçe' : 'il geneli'}</span></span><i class="location-change">Değiştir</i></button><div class="pill-tabs fuel-tabs"><button class="${current==='benzin'?'active':''}" data-action="fuel" data-fuel="benzin">Benzin</button><button class="${current==='motorin'?'active':''}" data-action="fuel" data-fuel="motorin">Motorin</button><button class="${current==='lpg'?'active':''}" data-action="fuel" data-fuel="lpg">LPG</button></div><div class="source-bar"><span class="source-dot ${meta.trusted ? 'live':''}"></span><span><b>${headline}</b><small class="freshness ${freshness.tone}">${esc(freshness.label)}</small><small>${esc(sourceNames || 'Canlı kaynak yanıtı bekleniyor')}${esc(nearbyLabel)} · ${esc(meta.checkedAt ? `Kontrol: ${meta.checkedAt}` : 'yenilemek için tekrar deneyin')}</small></span><button class="text-button" data-action="fuel-source">Kaynaklar</button></div><div class="price-meta"><span>${records.length} ${scopeLabel} · ${esc(records[0]?.updatedAt || 'Güncelleme bekleniyor')}</span><button class="text-button" data-action="favorites-filter">${state.pricesOnlyFavorites ? 'Tümünü göster':'Favoriler'}</button></div><section class="card list-card">${records.length ? records.map(p => `<div class="price-row"><i class="row-icon">${ico('map',18)}</i><span class="price-place"><b>${esc(p.district)}</b><span>${esc(p.updatedAt || 'Kaynak bekleniyor')} · ${p.trusted ? `${p.sourceCount} tarih uyumlu kaynak ortalaması` : p.sourceCount > 1 ? `${p.sourceCount} canlı kaynak; tarih uyumu doğrulanmadı` : p.sourceCount === 1 ? 'tek kaynak' : 'veri yok'}${p.cityReference ? ` · çevre il referansı${p.referenceCity ? `: ${esc(p.referenceCity)}` : ''}` : ''}</span></span><span class="price-value">${p.price == null ? '—' : `${money(p.price)} <small>/L</small>`}</span><button class="star-button ${state.favorites.includes(p.district) ? 'active':''}" data-action="favorite" data-district="${esc(p.district)}" aria-label="Favori değiştir">${ico('star',20)}</button></div>`).join('') : `<div class="empty-card"><p>Favori kapsamı boş. Yıldızlara dokunarak ekleyin.</p></div>`}</section><p class="center muted" style="font-size:10px;line-height:1.45;margin:13px 10px">Fiyat; aynı ürün, il/ilçe kapsamı ve uyumlu kaynak tarihi bulunan Petrol Ofisi, Aytemiz, Sunpet, M Oil, Lukoil ve NSoft API değerlerinin basit ortalamasıdır. NSoft, APK’sı incelenen Yakıt Alarmı uygulamasının kullandığı toplu API’dir; birinci taraf dağıtıcı yerine ayrı bir veri sağlayıcısı olarak gösterilir. EPDK, fiili pompa fiyatı ve il raporları için resmi otorite referansıdır; tek bir ticari pompa fiyatını belirleyen kurum değildir. Kaynak tarihi ve uygulamanın kontrol zamanı ayrı gösterilir. Eski tarihli kaynaklar ortalamaya karıştırılmaz. En az iki canlı kaynak yoksa ortalama etiketi kullanılmaz. ${esc(meta.note || '')}</p></main>`;
}
function accountView() {
  const vehicleCount = state.vehicles.length;
  const recordCount = state.trips.length + state.parks.length + state.receipts.length + state.accidents.length + state.insurance.length + state.maintenance.length;
  return `<main><div class="view-heading"><div><div class="eyebrow"><i class="eyebrow-dot"></i>HESAP</div><h2>Cihazım</h2><p>Giriş ve bulut hesabı olmadan, verileriniz bu cihazda tutulur.</p></div></div><section class="device-local-card"><i class="avatar">${ico('shield',22)}</i><div><b>Yerel kullanım aktif</b><span>${vehicleCount} araç · ${recordCount} kayıt · localStorage</span></div><span class="chip teal">Çevrimdışı hazır</span></section><section><div class="section-head"><h3>Veri yönetimi</h3><span class="chip teal">Cihazda</span></div><div class="card list-card">${listRow({icon:'backup',title:'Yedeği indir',subtitle:'Tüm cihaz kayıtlarını JSON olarak saklayın',end:'İndir',action:'export'})}${listRow({icon:'cloud',title:'Yedekten geri yükle',subtitle:'Daha önce indirdiğiniz JSON dosyasını seçin',end:'Yükle',action:'import'})}</div><p class="muted" style="font-size:10px;line-height:1.45;margin:10px 3px">Sürüş Cepte şu anda gerçek hesap sunucusu veya bulut senkronizasyonu kullanmaz. Telefon değiştirirken JSON yedeğini kendiniz aktarın.</p></section><section><div class="section-head"><h3>Tercihler</h3><span class="muted" style="font-size:11px">Cihaz ayarları</span></div><div class="card list-card">${listRow({icon:'bell',title:'Yakıt bildirimleri',subtitle:'İzin ve alarm tercihi',end:state.settings.notifications?'Açık':'Kapalı',action:'notification-settings'})}${listRow({icon:'park',color:'yellow',title:'Otomatik park önerisi',subtitle:'Aktif sürüşte sabit konumu algılar',end:state.settings.autoParkDetection?'Açık':'Kapalı',action:'settings'})}${listRow({icon:'settings',title:'Uygulama ayarları',subtitle:'GPS, kilometre ve görünüm',end:'Aç',action:'settings'})}</div></section><section><div class="section-head"><h3>Veri yönetimi</h3></div><button class="danger-button full-button" data-action="reset">Kayıtları sıfırla</button></section></main>`;
}
async function loadNearbyStations() { nearbyStations={...nearbyStations,status:'loading',error:''}; render(); try { const [positionResult, priceResult] = await Promise.all([requestCurrentPosition(), getFuelPrices({ city:state.location.city, district:state.location.district, type:state.fuelType })]); rememberLocationResult(positionResult); if (!positionResult.ok) throw new Error(positionResult.message || 'Konum alınamadı.'); const stationResult=await getNearbyStations(positionResult); priceRecords=priceResult; const selected=priceResult.find(row=>row.live && (!state.location.district || row.district===state.location.district)) || priceResult.find(row=>row.live); const activeVehicle=state.vehicles.find(vehicle=>vehicle.id===state.selectedVehicleId); const preferredBrand=activeVehicle?.favoriteStation || ''; const preferredKey=stationBrandKey(preferredBrand); const orderedStations=preferredKey ? [...stationResult.stations].sort((a,b)=>{ const aFav=stationBrandKey(a.brand).includes(preferredKey)?0:1; const bFav=stationBrandKey(b.brand).includes(preferredKey)?0:1; return aFav-bFav || Number(a.distanceKm)-Number(b.distanceKm); }) : stationResult.stations; nearbyStations={...stationResult,stations:orderedStations,status:'ready',preferredBrand,price:selected?.price ?? null,priceUpdatedAt:priceResult.meta?.checkedAt || selected?.updatedAt || ''}; } catch(error) { nearbyStations={...nearbyStations,status:'error',error:error?.message || 'Yakındaki istasyonlar alınamadı.'}; } render(); }
function render() {
  const fontScale = ['normal','large','xlarge'].includes(state.settings?.fontScale) ? state.settings.fontScale : 'normal';
  const theme = APP_THEMES.some(item => item.id === state.settings?.theme) ? state.settings.theme : 'aurora';
  document.documentElement.dataset.fontScale = fontScale;
  document.documentElement.dataset.theme = theme;
  app.innerHTML = `${header()}${state.view === 'home' ? homeView() : state.view === 'vehicles' ? vehiclesView() : state.view === 'journey' ? journeyView() : state.view === 'prices' ? pricesView() : state.view === 'refuel' ? refuelView() : accountView()}${nav()}`;
  if (state.view === 'refuel') updateRefuelPage(refuelDraftPercent ?? (state.vehicles.find(item => item.id === state.selectedVehicleId)?.fuelLevelPercent || 0));
}
function openModal(title, subtitle, body) {
  modalLayer.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>`:''}</div><button class="close-button" data-action="close" aria-label="Kapat">${ico('close',19)}</button></div>${body}</section>`;
  modalLayer.classList.add('open'); modalLayer.setAttribute('aria-hidden','false');
}
function closeModal() { modalLayer.classList.remove('open'); modalLayer.setAttribute('aria-hidden','true'); modalLayer.innerHTML=''; }
function vehicleModal(vehicle = null) {
  const editing = Boolean(vehicle?.id);
  const v = vehicle || { brand:'', model:'', plate:'', fuel:'Benzin', tank:50, km:state.settings.mileage || 0, favoriteStation:'', profileId:'manual', fuelLevelPercent:0 };
  const profile = vehicleProfileById(v.profileId);
  const options = [MANUAL_VEHICLE_PROFILE, ...VEHICLE_PROFILES].map(item => `<option value="${esc(item.id)}" ${profile.id === item.id ? 'selected':''}>${item.id === 'manual' ? 'Diğer / elle gir' : `${item.brand} ${item.model} · ${item.variant}`}</option>`).join('');
  openModal(editing?'Aracı düzenle':'Yeni araç ekle','Model profili seçildiğinde depo kapasitesi ve doğrulanmış teknik bilgiler forma aktarılır; alanları istediğinizde düzenleyebilirsiniz.',`<form data-form="vehicle"><input type="hidden" name="id" value="${esc(editing ? vehicle.id : '')}"><div class="form-group"><label>Araç model profili</label><select name="profileId" data-vehicle-profile>${options}</select><div class="vehicle-profile-summary" data-profile-summary>${vehicleProfileDetails(profile)}</div></div><div class="form-grid"><div class="form-group"><label>Marka</label><input required name="brand" value="${esc(v.brand)}" placeholder="Örn. Toyota"></div><div class="form-group"><label>Model</label><input required name="model" value="${esc(v.model)}" placeholder="Örn. Corolla"></div></div><div class="form-grid"><div class="form-group"><label>Plaka</label><input required name="plate" value="${esc(v.plate)}" placeholder="34 YKA 01"></div><div class="form-group"><label>Yakıt tipi</label><select name="fuel">${['Benzin','Motorin','LPG','Hibrit','Elektrik','Belirtilmedi'].map(x=>`<option ${v.fuel===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="form-grid"><div class="form-group"><label>Depo kapasitesi (L)</label><input required type="number" min="1" name="tank" value="${esc(v.tank ?? '')}" placeholder="Resmi veride yoksa elle girin"></div><div class="form-group"><label>Kilometre</label><input type="number" min="0" name="km" value="${esc(v.km)}"></div></div><div class="form-group"><label>Favori akaryakıt markası</label><select name="favoriteStation"><option value="">Seçilmedi</option>${FAVORITE_STATION_BRANDS.map(brand=>`<option value="${esc(brand)}" ${v.favoriteStation===brand?'selected':''}>${esc(brand)}</option>`).join('')}</select><small class="muted">Yakındaki istasyonlarda bu marka öne çıkarılır.</small></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">${editing?'Kaydet':'Aracı ekle'}</button></div>${editing?`<button type="button" class="danger-button full-button" style="margin-top:10px" data-action="delete-vehicle" data-id="${vehicle.id}">Aracı sil</button>`:''}</form>`);
}
function applyVehicleProfile(form, profileId) {
  const profile = vehicleProfileById(profileId);
  const summary = form.querySelector('[data-profile-summary]');
  if (summary) summary.innerHTML = vehicleProfileDetails(profile);
  if (profile.id === 'manual') return;
  for (const [name, value] of Object.entries({ brand:profile.brand, model:profile.model, fuel:profile.fuel, tank:profile.tank })) {
    const input = form.elements.namedItem(name);
    if (input) input.value = value ?? '';
  }
}
 let accidentGpsDraft = null;
 const localDateTime = value => { const date = value ? new Date(value) : new Date(); const safe = Number.isNaN(date.getTime()) ? new Date() : date; return new Date(safe.getTime() - safe.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
 function gpsLabel(gps) { return gps?.latitude != null ? `${Number(gps.latitude).toFixed(6)}, ${Number(gps.longitude).toFixed(6)}${gps.accuracy ? ` · ±${Math.round(gps.accuracy)} m` : ''}` : 'GPS kaydı yok'; }
 async function captureAccidentGps() { const status = document.querySelector('[data-accident-gps-status]'); if (status) status.textContent = 'GPS konumu ölçülüyor…'; const pos = await requestCurrentPosition(); rememberLocationResult(pos); accidentGpsDraft = pos.ok ? { latitude:pos.latitude, longitude:pos.longitude, accuracy:pos.accuracy ?? null, capturedAt:pos.capturedAt || new Date().toISOString() } : null; if (status) status.textContent = pos.ok ? `${gpsLabel(accidentGpsDraft)} · ${displayNow()}` : `GPS alınamadı: ${pos.message || 'izin verilmedi'}`; return pos; }
 function accidentModal(record = null) {
   const editing = Boolean(record?.id); accidentGpsDraft = record?.gps || null;
  openModal(editing ? 'Kaza tutanağını düzenle' : 'Kaza tutanağı oluştur','Acil durumda önce 112’yi arayın. Tutanak taslağı, GPS ve fotoğraflar cihazda tutulur.',`<div class="emergency-banner"><i class="row-icon coral">${ico('gps',19)}</i><div><b>Otomatik GPS kaydı</b><span data-accident-gps-status>${gpsLabel(accidentGpsDraft)}${accidentGpsDraft ? ` · ${displayNow()}` : ' · Konum aranıyor…'}</span></div><button type="button" class="secondary-button" data-action="accident-gps">Yenile</button></div><div class="template-strip"><b>Belgeyi otomatik doldur</b><div class="document-source-actions"><button class="source-choice-inline camera-choice" type="button" data-action="document-ocr" data-document="accident" data-source="camera">${ico('camera',17)} Kamerayı aç + tara</button><button class="source-choice-inline gallery-choice" type="button" data-action="document-ocr" data-document="accident" data-source="gallery">${ico('image',17)} Galeriden seç + OCR</button></div><small class="muted">Kameradan yeni belge çekin veya galerideki kaza/poliçe fotoğrafını seçin. Belge modu kenarları düzeltir; eksikleri formda düzenleyin.</small></div><form data-form="accident"><input type="hidden" name="id" value="${esc(record?.id || '')}"><div class="form-group"><label>Olay başlığı</label><input name="title" required value="${esc(record?.title || '')}" placeholder="Örn. Maddi hasarlı kaza"></div><div class="form-grid"><div class="form-group"><label>Kaza tarihi ve saati</label><input name="occurredAt" type="datetime-local" value="${esc(localDateTime(record?.occurredAt))}" required></div><div class="form-group"><label>Hava / yol</label><select name="condition"><option ${record?.condition === 'Kuru'?'selected':''}>Kuru</option><option ${record?.condition === 'Yağışlı'?'selected':''}>Yağışlı</option><option ${record?.condition === 'Buzlu'?'selected':''}>Buzlu</option><option ${record?.condition === 'Bilinmiyor'?'selected':''}>Bilinmiyor</option></select></div></div><div class="form-group"><label>Olay yeri / yol adı</label><input name="locationText" value="${esc(record?.locationText || '')}" placeholder="Örn. D100 Kadıköy yönü, km 12"></div><div class="form-grid"><div class="form-group"><label>Yaralanma durumu</label><select name="injury"><option ${record?.injury === 'Yok'?'selected':''}>Yok</option><option ${record?.injury === 'Bilinmiyor'?'selected':''}>Bilinmiyor</option><option ${record?.injury === 'Var'?'selected':''}>Var</option></select></div><div class="form-group"><label>Polis / jandarma</label><select name="official"><option ${record?.official === 'Çağrılmadı'?'selected':''}>Çağrılmadı</option><option ${record?.official === 'Arandı'?'selected':''}>Arandı</option><option ${record?.official === 'Tutanak tuttu'?'selected':''}>Tutanak tuttu</option></select></div></div><div class="form-grid"><div class="form-group"><label>Benim plakam</label><input name="plate" value="${esc(record?.plate || state.vehicles.find(v=>v.id===state.selectedVehicleId)?.plate || '')}" placeholder="34 ABC 123"></div><div class="form-group"><label>Karşı taraf plakası</label><input name="otherPlate" value="${esc(record?.otherPlate || '')}" placeholder="34 XYZ 456"></div></div><div class="form-grid"><div class="form-group"><label>Karşı taraf adı</label><input name="otherDriver" value="${esc(record?.otherDriver || '')}" placeholder="Ad soyad"></div><div class="form-group"><label>Karşı taraf telefon</label><input name="otherPhone" type="tel" value="${esc(record?.otherPhone || '')}" placeholder="05xx xxx xx xx"></div></div><div class="form-grid"><div class="form-group"><label>Sigorta şirketi</label><input name="insuranceCompany" value="${esc(record?.insuranceCompany || '')}" placeholder="Şirket adı"></div><div class="form-group"><label>Poliçe no</label><input name="policyNo" value="${esc(record?.policyNo || '')}" placeholder="Poliçe numarası"></div></div><div class="form-group"><label>Fotoğraf / belge</label><input name="photos" type="file" accept="image/*" multiple>${record?.photos?.length || record?.photo ? `<small class="muted">${record.photos?.length || 1} kayıtlı fotoğraf var; yeni seçim eklenir.</small>`:''}</div><div class="form-group"><label>Olay anlatımı ve ek not</label><textarea name="note" placeholder="Şerit, yön, hasar, tanık ve diğer önemli ayrıntılar">${esc(record?.note || '')}</textarea></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">${editing ? 'Tutanağı güncelle' : 'Tutanağı kaydet'}</button></div>${editing ? `<div class="sheet-actions"><button type="button" class="secondary-button" data-action="accident-share" data-id="${record.id}">${ico('share',16)} Paylaş</button><button type="button" class="secondary-button" data-action="accident-export" data-id="${record.id}">${ico('backup',16)} JSON indir</button><button type="button" class="danger-button" data-action="delete-accident" data-id="${record.id}">Sil</button></div>` : ''}</form>`);
   if (!record?.gps) setTimeout(() => captureAccidentGps(), 0);
 }
 function locationAccessModal() { const access=locationAccessCopy(); openModal('Konum erişimi',access.status === 'granted' ? 'Konum izni hazır; ölçüm yalnızca ilgili akış başlatıldığında yapılır.' : 'Yakındaki istasyonlar, park, acil durum ve sürüş kaydı için konum izni gerekir.',`<div class="notice-card ${access.tone === 'warn' ? 'warning' : ''}"><div class="notice-icon">${ico('gps',20)}</div><div><strong>${esc(access.title)}</strong><p>${esc(access.detail)}</p></div></div><div class="card list-card" style="margin-top:12px"><div class="settings-caption"><b>Android’de iki ayrı ayar vardır:</b><br>1) Uygulama izni: Ayarlar &gt; Uygulamalar &gt; Sürüş Cepte &gt; İzinler &gt; Konum.<br>2) Cihaz konumu: Hızlı ayarlardan veya Ayarlar &gt; Konum bölümünden açık olmalıdır.<br><br>Android güvenlik nedeniyle uygulama konumu gizlice veya sürekli açamaz. Uygulama ilk girişte izin ister; istasyon, park, kaza/acil durum ve sürüş akışlarında ön planda tekrar ölçüm yapar.</div></div>${access.status === 'granted' ? '<button class="primary-button full-button" style="margin-top:12px" data-action="close">Tamam</button>' : '<div class="sheet-actions" style="margin-top:12px"><button class="secondary-button" data-action="close">Şimdi değil</button><button class="primary-button" data-action="request-location">Konumu aç / tekrar dene</button></div>'}`); }
 function locationHelpModal() { openModal('Konum erişimi','Acil kaza akışı uygulama içindeki GPS anahtarını beklemez; cihazdan izin ister.',`<div class="notice-card"><div class="notice-icon">${ico('gps',20)}</div><div><strong>Android’de konum için iki koşul gerekir</strong><p>1) Uygulama izni: Ayarlar &gt; Uygulamalar &gt; Sürüş Cepte &gt; İzinler &gt; Konum. 2) Cihaz konum servisi: Hızlı ayarlardan veya Ayarlar &gt; Konum bölümünden açık olmalı.</p></div></div><div class="card list-card" style="margin-top:12px"><div class="settings-caption">Konum servisi tamamen kapalıysa Android güvenlik nedeniyle hiçbir uygulama gizlice koordinat alamaz. İzin açıldığında Kaza tutanağı ve Acil durum merkezi yeniden GPS isteği gönderir.</div></div><button class="primary-button full-button" style="margin-top:12px" data-action="close">Anladım</button>`); }
 function emergencyCenterModal() { const offline = typeof navigator !== 'undefined' && navigator.onLine === false; const offlineBanner = offline ? `<div class="notice-card offline-notice"><div class="notice-icon">${ico('cloud',20)}</div><div><strong>Çevrimdışı acil mod</strong><p>İnternet yok. GPS, fotoğraf ve tutanak kayıtları cihazda saklanır; bağlantı gelince paylaşabilirsiniz.</p></div></div>` : ''; const last = state.emergencies?.[0]; const lastText = last?.latitude != null ? `${Number(last.latitude).toFixed(6)}, ${Number(last.longitude).toFixed(6)}${last.accuracy ? ` · ±${Math.round(last.accuracy)} m` : ''}` : 'Henüz acil konum kaydı yok'; openModal('Acil durum merkezi','Önce güvenli bir yere geçin, yaralı varsa 112’yi arayın. Sonra konum ve tutanak kaydını oluşturun.',`${offlineBanner}<div class="emergency-priority"><i>${ico('alert',25)}</i><div><strong>Yaralanma veya tehlike varsa 112</strong><span>Arama düğmeleri cihazın telefon uygulamasını açar.</span></div></div><div class="emergency-call-grid"><a class="emergency-call" href="tel:112"><i>${ico('phone',18)}</i><b>112 Acil</b><small>Ambulans / itfaiye</small></a><a class="emergency-call" href="tel:155"><i>${ico('phone',18)}</i><b>Polis</b><small>Emniyet</small></a><a class="emergency-call" href="tel:156"><i>${ico('phone',18)}</i><b>Jandarma</b><small>Kırsal bölge</small></a><a class="emergency-call" href="tel:158"><i>${ico('phone',18)}</i><b>Sahil Güvenlik</b><small>Deniz kazası</small></a></div><div class="gps-record-card"><i class="row-icon">${ico('gps',19)}</i><span><b>Son acil konum</b><small>${esc(lastText)}${last?.date ? ` · ${esc(last.date)}` : ''}</small></span><button class="secondary-button" data-action="capture-emergency-location">Konumu kaydet</button></div><button class="secondary-button full-button" data-action="location-help">Konum izinlerini ve cihaz konumunu kontrol et</button><div class="sheet-actions"><button class="secondary-button" data-action="share-emergency-location">${ico('share',16)} Konumu paylaş</button><button class="primary-button" data-action="accident">Kaza tutanağı</button></div><div class="emergency-links"><button class="list-row" data-action="insurance"><i class="row-icon">${ico('shield',18)}</i><span class="row-main"><b>Sigorta asistansına ulaş</b><span>Poliçe ve çekici numaralarını aç</span></span>${ico('chevron',16)}</button><button class="list-row" data-action="documents"><i class="row-icon">${ico('file',18)}</i><span class="row-main"><b>Kaza / belge geçmişi</b><span>Kaydedilmiş tutanakları düzenle</span></span>${ico('chevron',16)}</button></div>`); }
 function insuranceModal(record = null) {
   const editing = Boolean(record?.id); const policies = state.insurance || [];
   const cards = policies.length ? policies.map(item => { const days=daysUntil(item.expiry); const urgent=days != null && days <= 30; return `<div class="care-record ${urgent?'urgent':''}"><div class="care-record-head"><span class="row-icon">${ico('shield',18)}</span><div><b>${esc(item.provider || 'Sigorta poliçesi')}</b><small>${esc(item.type || 'Trafik / kasko')} · ${esc(item.policyNo || 'Poliçe no yok')}</small></div><span class="chip ${urgent?'yellow':'teal'}">${item.expiry ? `${dateInputValue(item.expiry)}${days != null ? ` · ${Math.max(0,days)} gün` : ''}` : 'Tarih yok'}</span></div><p>${esc(item.note || 'Not eklenmedi.')}</p><div class="care-actions">${item.assistancePhone ? `<a class="secondary-button" href="tel:${esc(item.assistancePhone)}">${ico('phone',14)} Asistans</a>` : ''}<button class="secondary-button" data-action="edit-insurance" data-id="${item.id}">Düzenle</button><button class="danger-button" data-action="delete-insurance" data-id="${item.id}">Sil</button></div></div>`; }).join('') : '<div class="empty-card"><p>Henüz sigorta poliçesi eklenmedi. Poliçe bitiş tarihini kaydedin; yaklaşınca burada görünür.</p></div>';
   openModal(editing?'Sigorta poliçesini düzenle':'Araç sigortası','Trafik, kasko ve asistans bilgilerini cihazda düzenli tutun.',`<div class="template-strip"><b>Belgeyi otomatik doldur</b><div class="document-source-actions"><button class="source-choice-inline camera-choice" type="button" data-action="document-ocr" data-document="insurance" data-source="camera">${ico('camera',17)} Kamerayı aç + tara</button><button class="source-choice-inline gallery-choice" type="button" data-action="document-ocr" data-document="insurance" data-source="gallery">${ico('image',17)} Galeriden seç + OCR</button></div><small class="muted">Kameradan yeni poliçe çekin veya galerideki mevcut belge fotoğrafını seçin. Belge tarayıcı sayfayı düzeltir; eksikleri formda tamamlayın.</small></div><form data-form="insurance"><input type="hidden" name="id" value="${esc(record?.id || '')}"><div class="form-grid"><div class="form-group"><label>Sigorta şirketi</label><input required name="provider" value="${esc(record?.provider || '')}" placeholder="Örn. Anadolu Sigorta"></div><div class="form-group"><label>Poliçe türü</label><select name="type"><option ${!record?.type || record?.type === 'Trafik'?'selected':''}>Trafik</option><option ${record?.type === 'Kasko'?'selected':''}>Kasko</option><option ${record?.type === 'Trafik + Kasko'?'selected':''}>Trafik + Kasko</option></select></div></div><div class="form-grid"><div class="form-group"><label>Poliçe numarası</label><input name="policyNo" value="${esc(record?.policyNo || '')}" placeholder="Poliçe no"></div><div class="form-group"><label>Bitiş tarihi</label><input required type="date" name="expiry" value="${esc(dateInputValue(record?.expiry))}"></div></div><div class="form-grid"><div class="form-group"><label>Hasar / asistans telefonu</label><input type="tel" name="assistancePhone" value="${esc(record?.assistancePhone || '')}" placeholder="0850 ..."></div><div class="form-group"><label>Poliçe başlangıcı</label><input type="date" name="startDate" value="${esc(dateInputValue(record?.startDate))}"></div></div><div class="form-group"><label>Not</label><textarea name="note" placeholder="Çekici, ikame araç, acil dosya notu">${esc(record?.note || '')}</textarea></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">${editing?'Poliçeyi güncelle':'Poliçeyi kaydet'}</button></div></form><div class="section-head"><h4>Kayıtlı poliçeler</h4><span class="muted" style="font-size:10px">${policies.length} kayıt</span></div><div class="care-list">${cards}</div>`);
 }
 function maintenanceModal(record = null) {
   const editing = Boolean(record?.id); const items = state.maintenance || []; const km = Number(state.settings.mileage || 0);
   const cards = items.length ? items.map(item => { const dueDate=daysUntil(item.dueDate); const due=!item.completed && ((dueDate != null && dueDate <= 30) || (item.dueKm != null && Number(item.dueKm) <= km)); const status=item.completed?'Tamamlandı':due?'Yaklaşıyor':'Planlı'; return `<div class="care-record ${due?'urgent':''}"><div class="care-record-head"><span class="row-icon ${due?'yellow':''}">${ico('wrench',18)}</span><div><b>${esc(item.item || 'Bakım')}</b><small>${item.dueKm != null ? `Km ${Number(item.dueKm).toLocaleString('tr-TR')}` : 'Km tarihi yok'}${item.dueDate ? ` · ${dateInputValue(item.dueDate)}` : ''}</small></div><span class="chip ${due?'yellow':'teal'}">${status}</span></div><p>${item.cost ? `${money(item.cost)} · ` : ''}${esc(item.note || 'Not eklenmedi.')}</p><div class="care-actions">${!item.completed ? `<button class="secondary-button" data-action="mark-maintenance" data-id="${item.id}">Tamamlandı</button>` : ''}<button class="secondary-button" data-action="edit-maintenance" data-id="${item.id}">Düzenle</button><button class="danger-button" data-action="delete-maintenance" data-id="${item.id}">Sil</button></div></div>`; }).join('') : '<div class="empty-card"><p>Bakım takvimi boş. Hazır kalemlerden birini seçerek başlayın.</p></div>';
   const templates = ['Motor yağı + filtre','Fren ve balata kontrolü','Lastik rotasyon / diş kontrolü','Periyodik muayene','Akü kontrolü'];
   openModal(editing?'Bakım kaydını düzenle':'Rutin bakım planı','Kilometre veya tarihe göre yaklaşan işleri takip edin.',`<div class="template-strip"><b>Hazır bakım kalemleri</b><div>${templates.map(item=>`<button class="chip teal" type="button" data-action="maintenance-template" data-item="${esc(item)}">${esc(item)}</button>`).join('')}</div></div><form data-form="maintenance"><input type="hidden" name="id" value="${esc(record?.id || '')}"><div class="form-group"><label>Bakım kalemi</label><input required name="item" value="${esc(record?.item || '')}" placeholder="Örn. Motor yağı değişimi"></div><div class="form-grid"><div class="form-group"><label>Son tarih / hedef tarih</label><input type="date" name="dueDate" value="${esc(dateInputValue(record?.dueDate))}"></div><div class="form-group"><label>Hedef kilometre</label><input type="number" min="0" name="dueKm" value="${record?.dueKm ?? ''}" placeholder="Örn. 30000"></div></div><div class="form-grid"><div class="form-group"><label>Tahmini tutar (₺)</label><input type="number" min="0" step="0.01" name="cost" value="${record?.cost ?? ''}"></div><div class="form-group"><label>Tekrar aralığı (km)</label><input type="number" min="0" name="intervalKm" value="${record?.intervalKm ?? ''}" placeholder="Örn. 10000"></div></div><div class="form-group"><label>Not / servis bilgisi</label><textarea name="note" placeholder="Servis, parça ve kontrol notu">${esc(record?.note || '')}</textarea></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">${editing?'Bakımı güncelle':'Bakımı planla'}</button></div></form><div class="section-head"><h4>Bakım takvimi</h4><span class="muted" style="font-size:10px">Kilometre: ${km.toLocaleString('tr-TR')}</span></div><div class="care-list">${cards}</div>`);
 }
function hgsModal() { openModal('HGS / OGS geçişi','Geçişi gider raporuna eklemek için demo kayıt oluşturun.',`<form data-form="hgs"><div class="form-group"><label>Geçiş noktası</label><input required name="title" placeholder="Örn. Osmangazi Köprüsü"></div><div class="form-group"><label>Tutar (₺)</label><input required type="number" min="0" step="0.01" name="amount" placeholder="0,00"></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Geçişi ekle</button></div></form>`); }
function driverModal() { openModal('Sürücü ekle','Yerel sürücü listesine kayıt ekleyin.',`<form data-form="driver"><div class="form-group"><label>Ad soyad</label><input required name="name" placeholder="Örn. Ayşe Yılmaz"></div><div class="form-group"><label>E-posta</label><input required type="email" name="email" placeholder="ayse@example.com"></div><div class="form-group"><label>Rol</label><select name="role"><option>Yetkili sürücü</option><option>Görüntüleyici</option></select></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Sürücüyü kaydet</button></div></form>`); }
function catalogModal() { openModal('Araç kataloğu','Otomobil, hafif ticari ve motosiklet profilleri resmi Türkiye üretici kaynaklarından derlenmiştir. Teknik alanı doğrulanmayan modeller kaydetmeden önce sizden istenir.', vehicleCatalogMarkup({ searchable:true })); }
function tripNoteModal() { openModal('Sürüş notu','Aktif sürüşe yerel bir not ekleyin.',`<form data-form="trip-note"><div class="form-group"><label>Not</label><textarea required name="note" placeholder="Örn. Trafik yoğundu"></textarea></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Notu kaydet</button></div></form>`); }
  function locationModal() { const cityOptions = provinces.map(city => `<option value="${esc(city)}" ${state.location.city === city ? 'selected':''}>${esc(city)}</option>`).join(''); const items = locationItems(state.location.city); const districtOptions = items.map(item => `<option value="${esc(item.name)}" ${state.location.district === item.name ? 'selected':''}>${esc(item.name)}</option>`).join(''); openModal('Konum seçimi','81 il arasından seçim yapın. İstanbul’da ilçe, diğer illerde il geneli fiyatı gösterilir.',`<form data-form="location"><div class="form-group"><label>İl</label><select name="city" data-location-city>${cityOptions}</select></div><div class="form-group"><label>İlçe / kapsam</label><select name="district" data-location-district>${districtOptions}</select></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Konumu kaydet</button></div></form>`); }
function settingsModal() { const fontScale = ['normal','large','xlarge'].includes(state.settings?.fontScale) ? state.settings.fontScale : 'normal'; const theme = APP_THEMES.some(item => item.id === state.settings?.theme) ? state.settings.theme : 'aurora'; openModal('Uygulama ayarları','Bu ayarlar cihazınızda localStorage ile saklanır.',`<div class="switch-row"><i class="row-icon">${ico('bell',18)}</i><span class="switch-copy"><b>Yakıt bildirimleri</b><span>İndirim ve fiyat değişimi uyarıları</span></span>${switchControl('notifications',state.settings.notifications)}</div><div class="switch-row"><i class="row-icon">${ico('park',18)}</i><span class="switch-copy"><b>Otomatik park önerisi</b><span>Sürüş kaydı açıkken yaklaşık 3 dakika sabit konumu ölçer; kaydetmeden önce size gösterir.</span></span>${switchControl('autoParkDetection',Boolean(state.settings.autoParkDetection))}</div><div class="notice-card"><div class="notice-icon">${ico('gps',18)}</div><div><strong>GPS ve arka plan sınırı</strong><p>Ölçüm yüksek doğrulukla yalnızca aktif sürüş kaydı ve uygulama ön plandayken yapılır. Uygulama tamamen kapalıyken gizli arka plan takibi yapılmaz; gerçek sürekli takip için ayrıca Android foreground-service izni gerekir.</p></div></div><div class="switch-row"><i class="row-icon">${ico('map',18)}</i><span class="switch-copy"><b>GPS</b><span>${state.locationAccess?.status === 'granted' ? 'İzin açık; uygulama içi kullanım' : 'İzin gerekli; konumu aç düğmesine dokunun'}</span></span>${switchControl('gps',state.gps && state.locationAccess?.status === 'granted','root')}</div><button class="secondary-button full-button" type="button" data-action="request-location" style="margin-top:12px">${state.locationAccess?.status === 'granted' ? 'Konum erişimini kontrol et' : 'Konumu aç / tekrar dene'}</button><div class="theme-setting"><div><b>Görünüm teması</b><span>Kartların renk, derinlik ve vurgu stilini seçin.</span></div><select data-setting="theme" data-scope="settings" aria-label="Görünüm teması">${APP_THEMES.map(item=>`<option value="${item.id}" ${theme === item.id ? 'selected' : ''}>${item.label}</option>`).join('')}</select></div><div class="font-size-setting"><div><b>Yazı boyutu</b><span>Görme desteği için uygulama metinlerini büyütün.</span></div><select data-setting="fontScale" data-scope="settings" aria-label="Yazı boyutu"><option value="normal" ${fontScale === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${fontScale === 'large' ? 'selected' : ''}>Büyük</option><option value="xlarge" ${fontScale === 'xlarge' ? 'selected' : ''}>Çok büyük</option></select></div><form data-form="mileage"><div class="form-group"><label>Güncel kilometre</label><input name="mileage" type="number" min="0" value="${state.settings.mileage || 0}"></div><button class="primary-button full-button" type="submit">Kilometreyi kaydet</button></form>`); }
function switchControl(key, checked, scope='settings') { return `<label class="switch"><input type="checkbox" data-setting="${key}" data-scope="${scope}" ${checked?'checked':''}><span class="slider"></span></label>`; }
function reportModal() { const total=state.trips.reduce((s,t)=>s+Number(t.km||0),0); const byType={İş:0,Kişisel:0,Aile:0}; state.trips.forEach(t=>{byType[t.type] = (byType[t.type] || 0) + Number(t.km || 0);}); const pct=type=>total ? Math.round((byType[type] / total) * 100) : 0; openModal('Sürüş raporu','Yalnızca cihazda kaydedilmiş GPS mesafelerinden hesaplanır.',`<div class="card report-card"><div class="report-head"><b>Toplam sürüş</b><span class="report-total">${total.toFixed(1)} km</span></div><div class="bar-row"><div class="bar-label"><span>İş</span><span>${pct('İş')}%</span></div><div class="thin-progress"><i style="width:${pct('İş')}%"></i></div></div><div class="bar-row"><div class="bar-label"><span>Kişisel</span><span>${pct('Kişisel')}%</span></div><div class="thin-progress"><i class="yellow" style="width:${pct('Kişisel')}%"></i></div></div><div class="bar-row"><div class="bar-label"><span>Aile</span><span>${pct('Aile')}%</span></div><div class="thin-progress"><i class="slate" style="width:${pct('Aile')}%"></i></div></div></div><p class="muted" style="font-size:11px;line-height:1.5">Sürüş türü manuel kayıtta Kişisel olarak başlar; GPS izni yoksa kilometre 0 tutulur ve rapor şişirilmez.</p>`); }
function badgesModal() { const badges=[['route','İlk rota',state.trips.length>0],['fuel','Bütçe gözü',state.receipts.length>0],['park','Park uzmanı',state.parks.length>0],['badge','100 km',state.trips.reduce((s,t)=>s+Number(t.km||0),0)>=100],['chart','Raporcu',state.trips.length>=3],['star','Favori avcısı',state.favorites.length>=5]]; openModal('Sürüş rozetleri','Rozetler yalnızca gerçek yerel kayıt koşulları sağlandığında açılır.',`<div class="badge-grid">${badges.map(([i,t,earned]) => `<div class="badge ${earned?'':'locked'}"><i class="badge-mark">${ico(i,19)}</i><b>${t}</b><span>${earned?'Açık':'Kilitli'}</span></div>`).join('')}</div>`); }
function openParkInMaps(id) { const park=state.parks.find(item=>item.id===id); if (!park) return toast('Park kaydı bulunamadı.', true); if (park.latitude == null || park.longitude == null) return toast('Bu park kaydında GPS koordinatı yok; yeni park kaydında konum izni verin.', true); const native=Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.Capacitor?.getPlatform?.()==='android'); const url=native ? `geo:${park.latitude},${park.longitude}?q=${park.latitude},${park.longitude}(${encodeURIComponent(park.title || 'Park')})` : `https://www.google.com/maps/search/?api=1&query=${park.latitude},${park.longitude}`; window.open(url, native ? '_system' : '_blank'); }
function tripEditModal(record) {
  if (!record) return toast('Sürüş kaydı bulunamadı.', true);
  openModal('Sürüş kaydını düzenle','Kilometre, başlık, tür ve notu güncelleyebilirsiniz.',`<form data-form="trip-edit"><input type="hidden" name="id" value="${esc(record.id)}"><div class="form-group"><label>Sürüş başlığı</label><input required name="title" value="${esc(record.title || 'Sürüş kaydı')}" placeholder="Örn. İşe gidiş"></div><div class="form-grid"><div class="form-group"><label>Kayıt tarihi</label><input name="date" value="${esc(record.date || '')}" placeholder="06.10.2026 09:30"></div><div class="form-group"><label>Sürüş türü</label><select name="type">${['İş','Kişisel','Aile'].map(type=>`<option ${record.type === type ? 'selected':''}>${type}</option>`).join('')}</select></div></div><div class="form-grid"><div class="form-group"><label>Mesafe (km)</label><input required type="number" min="0" step="0.1" name="km" value="${esc(record.km ?? 0)}"></div><div class="form-group"><label>Süre</label><input name="duration" value="${esc(record.duration || '')}" placeholder="35 dk"></div></div><div class="form-group"><label>Not</label><textarea name="note" placeholder="Yol, trafik veya gider notu">${esc(record.note || '')}</textarea></div><div class="notice-card"><div class="notice-icon">${ico('gps',18)}</div><div><strong>${esc(record.kmSource || 'GPS bilgisi yok')}</strong><p>GPS ölçülmemişse kilometreyi elle düzeltebilirsiniz; uygulama yeni GPS verisi uydurmaz.</p></div></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Sürüşü kaydet</button></div><button type="button" class="danger-button full-button" style="margin-top:10px" data-action="delete-trip" data-id="${esc(record.id)}">Bu sürüşü sil</button></form>`);
}
function parkEditModal(record) {
  if (!record) return toast('Park kaydı bulunamadı.', true);
  parkGpsDraft = record.latitude != null && record.longitude != null ? { latitude:record.latitude, longitude:record.longitude, accuracy:record.accuracy ?? null, capturedAt:record.capturedAt || null } : null;
  openModal('Park kaydını düzenle','Park adını, tarihini ve notunu değiştirin; isterseniz konumu yeniden ölçün.',`<form data-form="park-edit"><input type="hidden" name="id" value="${esc(record.id)}"><div class="form-group"><label>Park başlığı</label><input required name="title" value="${esc(record.title || 'Park konumu')}" placeholder="Örn. Ev önü"></div><div class="form-group"><label>Kayıt tarihi</label><input name="date" value="${esc(record.date || '')}" placeholder="06.10.2026 19:30"></div><div class="form-group"><label>Not</label><textarea name="note" placeholder="Kat, otopark veya süre notu">${esc(record.note || '')}</textarea></div><div class="park-gps-box"><i class="row-icon yellow">${ico('gps',18)}</i><div><b data-park-gps-status>${parkGpsDraft ? `${gpsLabel(parkGpsDraft)} · doğrulanmış konum` : 'Bu kayıtta GPS koordinatı yok'}</b><small>Yeni ölçüm için konum izni ve cihaz GPS’i açık olmalıdır.</small></div><button type="button" class="secondary-button" data-action="park-gps">GPS’i yenile</button></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Parkı kaydet</button></div><div class="sheet-actions"><button type="button" class="secondary-button" data-action="navigate-park" data-id="${esc(record.id)}">${ico('route',15)} Haritada aç</button><button type="button" class="danger-button" data-action="delete-park" data-id="${esc(record.id)}">Sil</button></div></form>`);
}
async function captureParkGps() {
  const status = document.querySelector('[data-park-gps-status]');
  if (status) status.textContent = 'Yüksek doğrulukla GPS ölçülüyor…';
  const pos = await requestCurrentPosition();
  rememberLocationResult(pos);
  parkGpsDraft = pos.ok ? { latitude:pos.latitude, longitude:pos.longitude, accuracy:pos.accuracy ?? null, capturedAt:pos.capturedAt || new Date().toISOString() } : null;
  if (status) status.textContent = pos.ok ? `${gpsLabel(parkGpsDraft)} · ${displayNow()}` : `GPS alınamadı: ${pos.message || 'izin verilmedi'}`;
  return pos;
}
function historyModal(kind) {
  if (kind === 'parks') {
    const parks = state.parks || [];
    const body = parks.length ? parks.map(p=>`<article class="history-record park-history-record"><div class="history-record-head"><i class="row-icon yellow">${ico('park',19)}</i><div><b>${esc(p.title || 'Park konumu')}</b><small>${esc(p.date || '')} · ${p.latitude != null ? `GPS ±${p.accuracy ? Math.round(p.accuracy) : '—'} m` : 'GPS yok'}</small></div></div><p>${esc(p.note || 'Konum kaydı')}</p><div class="history-actions">${p.latitude != null ? `<button class="secondary-button" data-action="navigate-park" data-id="${esc(p.id)}">${ico('route',14)} Haritada aç</button>` : ''}<button class="secondary-button" data-action="edit-park" data-id="${esc(p.id)}">Düzenle</button><button class="danger-button" data-action="delete-park" data-id="${esc(p.id)}">Sil</button></div></article>`).join('') : '<div class="empty-card"><p>Yeni bir park kaydı oluşturduğunuzda burada görünür.</p></div>';
    openModal('Geçmiş parklar',parks.length?'Park kayıtlarını düzenleyebilir veya silebilirsiniz.':'Henüz kayıt bulunmuyor.',`<div class="history-list">${body}</div>`); return;
  }
  const trips = state.trips || [];
  const body = trips.length ? trips.map(t=>`<article class="history-record"><div class="history-record-head"><i class="row-icon">${ico('route',19)}</i><div><b>${esc(t.title || 'Sürüş kaydı')}</b><small>${esc(t.date || '')} · ${esc(t.duration || 'Süre yok')} · ${Number(t.km || 0).toLocaleString('tr-TR',{maximumFractionDigits:1})} km</small></div><span class="chip teal">${esc(t.type || 'Kişisel')}</span></div><p>${esc(t.note || (t.kmSource || 'Yerel kayıt'))}</p><div class="history-actions"><button class="secondary-button" data-action="edit-trip" data-id="${esc(t.id)}">Düzenle</button><button class="danger-button" data-action="delete-trip" data-id="${esc(t.id)}">Sil</button></div></article>`).join('') : '<div class="empty-card"><p>Yeni bir kayıt oluşturduğunuzda burada görünür.</p></div>';
  openModal('Geçmiş sürüşler',trips.length?'Sürüş kayıtlarını düzenleyebilir veya silebilirsiniz.':'Henüz kayıt bulunmuyor.',`<div class="history-list">${body}</div>`);
 }
 function documentsModal() { const accidents=state.accidents || []; const receipts=state.receipts || []; const accidentRows=accidents.map(item=>{ const photo=item.photos?.[0] || item.photo; const gps=item.gps?.latitude != null ? `${Number(item.gps.latitude).toFixed(5)}, ${Number(item.gps.longitude).toFixed(5)}` : 'GPS yok'; return `<article class="document-row">${photo?.dataUrl ? `<img src="${esc(photo.dataUrl)}" alt="${esc(item.title)}" class="document-thumb">` : `<i class="row-icon coral">${ico('alert',19)}</i>`}<span class="document-copy"><b>${esc(item.title)}</b><small>${esc(item.occurredAt || item.date)} · ${esc(item.plate || 'Plaka yok')} · ${gps}</small><small>${item.injury === 'Var' ? 'Yaralanma bildirildi' : 'Yaralanma yok/bilinmiyor'} · ${esc(item.official || 'Resmi kayıt yok')}</small></span><button class="secondary-button" data-action="edit-accident" data-id="${item.id}">Düzenle</button></article>`; }).join(''); const receiptRows=receipts.map(item=>`<article class="document-row"><i class="row-icon">${ico('receipt',19)}</i><span class="document-copy"><b>${esc(item.stationBrand || item.stationName || item.fuel || 'Yakıt fişi')} · ${item.amount ? money(item.amount) : 'Tutar okunamadı'}</b><small>${esc(item.date || 'Tarih okunamadı')}${item.time ? ` · ${esc(item.time)}` : ''}${item.liters != null ? ` · ${Number(item.liters).toLocaleString('tr-TR')} L` : ''}${item.plate ? ` · ${esc(item.plate)}` : ''}</small></span><button class="secondary-button" data-action="edit-receipt" data-id="${esc(item.id)}">Düzenle</button></article>`).join(''); const content=`<div class="sheet-actions"><button class="primary-button" data-action="accident">Yeni kaza tutanağı</button><button class="secondary-button" data-action="barcode-scan">Karekod / barkod okut</button></div><div class="section-head"><h4>Kaza tutanakları</h4><span class="muted" style="font-size:10px">${accidents.length} kayıt</span></div>${accidentRows || '<div class="empty-card"><p>Henüz kaza tutanağı yok.</p></div>'}${receipts.length ? `<div class="section-head"><h4>Yakıt fişleri</h4></div>${receiptRows}` : ''}`; openModal('Yolculuk belgeleri','Kaza tutanakları düzenlenebilir; GPS, fotoğraf ve acil durum bilgileri cihazda tutulur.',content); }
function notificationSettingsModal() {
  openModal('Bildirimler','Android 13+ için izin uygulama içindeki bu düğmeye dokununca istenir. Yalnızca canlı kaynakta doğrulanan fiyat değişimleri alarm üretir.',`<div class="switch-row"><i class="row-icon">${ico('bell',18)}</i><span class="switch-copy"><b>Doğrulanmış yakıt alarmı</b><span>Tahmin değil; iki veya daha fazla canlı kaynak ölçümü karşılaştırılır.</span></span>${switchControl('notifications',state.settings.notifications)}</div><button class="secondary-button full-button" data-action="request-notification" style="margin-top:14px">Android bildirim iznini aç</button><p class="muted" style="font-size:10px;line-height:1.45;margin-top:10px">İzin daha önce reddedildiyse Android Ayarlar &gt; Uygulamalar &gt; Sürüş Cepte &gt; Bildirimler yolundan açın. Web önizlemesinde tarayıcı site izni kullanılır.</p>`);
}
function fuelSourceModal() {
  const liveMeta = priceRecords.meta?.sources || [];
  const contributingIds = new Set(priceRecords.flatMap(row => (row.sourceValues || []).map(record => record.id)));
  const unverifiedIds = new Set(priceRecords.flatMap(row => (row.sourceValues || []).filter(record => !record.sourceDate).map(record => record.id)));
  const excludedIds = new Set(priceRecords.flatMap(row => (row.excludedSourceValues || []).map(record => record.id)));
  const excludedReasons = new Map(priceRecords.flatMap(row => (row.excludedSourceValues || []).map(record => [record.id, record.exclusionReason || 'Kaynak kapsamı dışında'])));
  const sourceCards = Object.entries(FUEL_SOURCES).map(([id,source]) => {
    const status = liveMeta.find(item => item.id === id);
    const statusText = source.authority
      ? (status?.error || 'EPDK resmi fiyat sayfası ve web servisleri; canlı SOAP sorgusu yetki gerektirebilir.')
      : source.referenceOnly
        ? 'Fiyat oluşumu açıklaması; bu sürümde ortalamaya dahil değildir.'
        : status?.ok
          ? contributingIds.has(id) ? `${unverifiedIds.has(id) ? 'Kaynak tarihi yayınlanmıyor; tarih uyumu doğrulanamadı' : (status.dateLabel || 'Kaynak tarihi yayınlanmıyor')} · Kontrol: ${status.checkedAt || '—'}` : excludedIds.has(id) ? `${excludedReasons.get(id)}; güncel ortalamaya alınmadı.` : 'Bu yakıt türü veya seçili kapsam için fiyat satırı kullanılmadı.'
          : status?.error ? `Bu yenilemede okunamadı: ${status.error}` : 'Bu yenilemede okunmadı';
    return `<div class="source-detail-row"><b>${esc(source.name)}</b><span>${esc(source.role)} · ${esc(statusText)}</span><button class="secondary-button" data-action="open-source" data-url="${source.url}">Siteyi aç</button></div>`;
  }).join('');
  const alertCards = FUEL_ALERT_SOURCES.map(source => `<div class="source-detail-row"><b>${esc(source.name)} <span class="chip ${source.level === 'Resmi kurum' || source.level === 'Resmi kayıt' ? 'teal' : 'yellow'}">${esc(source.level)}</span></b><span>${esc(source.signal)} · ${esc(source.note)}</span><button class="secondary-button" data-action="open-source" data-url="${source.url}">Duyuruları aç</button></div>`).join('');
  const futureSummary = futureFuelAlerts.length ? `Son gelecek uyarı kontrolü: ${futureFuelAlertsCheckedAt || '—'} · ${futureFuelAlerts.length} eşleşme.` : `Son gelecek uyarı kontrolü: ${futureFuelAlertsCheckedAt || 'henüz yapılmadı'} · açık ürün/tutar/tarih eşleşmesi yok.`;
  openModal('Yakıt kaynakları ve zam duyuruları','Güncel fiyat ile geleceğe yönelik sektör beklentisini birbirine karıştırmadan gösterir.',`<h4 class="modal-section-title">Güncel fiyat ortalaması</h4><div class="source-detail">${sourceCards}</div><p class="muted" style="font-size:11px;line-height:1.5;margin:12px 2px">Güncel kart; aynı yakıt türü, aynı il/ilçe kapsamı ve uyumlu kaynak tarihi bulunan erişilebilir dağıtıcı ve NSoft API değerlerini ortalar. NSoft, APK’sı incelenen Yakıt Alarmı uygulamasında kullanılan toplu API’dir; birinci taraf dağıtıcı olarak değil, ayrı veri sağlayıcısı olarak listelenir. Kaynak tarihi yoksa uydurulmaz; kontrol zamanı ayrıca yazılır. Eski tarihli bir kaynak güncel ortalamaya karıştırılmaz ve neden dışlandığı meta bilgisinde gösterilir. EPDK resmi otorite ve fiili pompa fiyatı referansıdır. Seçili ilde doğrudan satır bulunamazsa en yakın il merkezlerinin canlı verisi açıkça “çevre il referansı” olarak etiketlenir.</p><h4 class="modal-section-title">Zam/indirim duyuru kaynakları</h4><div class="source-detail">${alertCards}</div><p class="muted" style="font-size:11px;line-height:1.5;margin:12px 2px">${esc(alertPolicy.rule)} ${esc(futureSummary)} Gelecek kartı; Ekonomim, CNN Türk, Diken, PÜİS duyuruları ve EPDK resmi fiyat sayfasını canlı kontrol eder. En az iki yayın aynı ürün, tutar ve yürürlük tarihini bildirirse “Orta güvenli beklenti” gösterilir; PÜİS/EPDK resmi teyidi yoksa kesinleşmiş indirim veya zam yazılmaz.</p>`);
}
function receiptFormModal(parsed = {}, meta = {}, existing = null) {
  const p = parsed || {};
  const sourceText = meta.rawText || p.rawText || existing?.rawText || '';
  const items = p.items || existing?.items || [];
  pendingReceiptDraft = { rawText:sourceText, items, passes:Number(meta.passes || existing?.ocrPasses || 1), existingId:existing?.id || null };
  const value = key => esc(p[key] ?? existing?.[key] ?? '');
  const dateValue = value('date');
  const timeValue = String(p.time ?? existing?.time ?? '').slice(0,5);
  const select = (name, options, current, emptyLabel='Belirtilmedi') => `<select name="${name}"><option value="">${emptyLabel}</option>${options.map(option => `<option value="${esc(option)}" ${String(current || '') === option ? 'selected':''}>${esc(option)}</option>`).join('')}</select>`;
  const missing = Array.isArray(p.missing) ? p.missing : [];
  const itemRows = items.length ? items.map(item => `<div class="metric-row"><span>${esc(item.fuel || 'Yakıt satırı')}</span><b>${item.liters != null ? `${Number(item.liters).toLocaleString('tr-TR')} L` : 'Litre —'}${item.unitPrice != null ? ` · ${money(item.unitPrice)}/L` : ''}${item.amount != null ? ` · ${money(item.amount)}` : ''}</b></div>`).join('') : '';
  const status = meta.ocr === false ? 'Fotoğraf alındı · elle kontrol gerekli' : `Cihaz içi OCR tamamlandı · ${pendingReceiptDraft.passes} geçiş`;
  const subtitle = existing ? 'Kayıtlı fişi düzeltin; değişiklikler yalnızca bu cihazda saklanır.' : (meta.message || 'Okunan bilgileri kaydetmeden önce kontrol edin ve eksikleri tamamlayın.');
  openModal(existing ? 'Fiş kaydını düzenle' : 'Fiş bilgilerini kontrol et', subtitle, `<div class="receipt-result"><div class="receipt-status ${meta.ocr === false ? '' : 'ok'}">${esc(status)}</div>${missing.length ? `<div class="notice-card warning" style="margin-top:12px"><div class="notice-icon">${ico('alert',20)}</div><div><strong>${missing.length} alan eksik veya belirsiz</strong><p>${esc(missing.join(', '))}. Aşağıdaki formdan tamamlayabilirsiniz.</p></div></div>` : `<div class="notice-card" style="margin-top:12px"><div class="notice-icon">${ico('check',20)}</div><div><strong>Alan çıkarımı tamamlandı</strong><p>Yine de fiş üzerindeki değerlerle karşılaştırın.</p></div></div>`}<form data-form="receipt"><input type="hidden" name="id" value="${esc(existing?.id || '')}"><div class="section-head"><h4>İstasyon ve belge</h4></div><div class="form-grid"><div class="form-group"><label>Akaryakıt markası</label><input name="stationBrand" value="${value('stationBrand')}" placeholder="Örn. Shell / OPET"></div><div class="form-group"><label>İstasyon adı</label><input name="stationName" value="${value('stationName')}" placeholder="Şube veya istasyon adı"></div></div><div class="form-group"><label>İstasyon adresi</label><input name="stationAddress" value="${value('stationAddress')}" placeholder="Adres / ilçe / yol"></div><div class="form-grid"><div class="form-group"><label>İl</label><input name="city" value="${value('city')}" placeholder="İl"></div><div class="form-group"><label>İlçe</label><input name="district" value="${value('district')}" placeholder="İlçe"></div></div><div class="form-grid"><div class="form-group"><label>Fiş tarihi</label><input type="date" name="date" value="${dateValue}"></div><div class="form-group"><label>Fiş saati</label><input type="time" name="time" value="${esc(timeValue)}"></div></div><div class="section-head"><h4>Yakıt ve tutar</h4></div><div class="form-grid"><div class="form-group"><label>Yakıt türü</label>${select('fuel',['Benzin','Motorin','LPG'],p.fuel || existing?.fuel,'Belirsiz')}</div><div class="form-group"><label>Plaka</label><input name="plate" value="${value('plate')}" placeholder="34 ABC 123"></div></div><div class="form-grid"><div class="form-group"><label>Alınan yakıt (L)</label><input type="number" min="0" step="0.001" name="liters" value="${value('liters')}" placeholder="0,000"></div><div class="form-group"><label>Birim fiyat (₺/L)</label><input type="number" min="0" step="0.001" name="unitPrice" value="${value('unitPrice')}" placeholder="0,000"></div></div><div class="form-grid"><div class="form-group"><label>Toplam tutar (₺)</label><input type="number" min="0" step="0.01" name="amount" value="${value('amount')}" placeholder="0,00"></div><div class="form-group"><label>KDV / vergi (₺)</label><input type="number" min="0" step="0.01" name="vat" value="${value('vat')}" placeholder="Okunmadıysa boş bırakın"></div></div><div class="form-grid"><div class="form-group"><label>Ödeme yöntemi</label>${select('paymentMethod',['Kredi kartı','Banka kartı','Nakit','Filo / cari'],p.paymentMethod || existing?.paymentMethod)}</div><div class="form-group"><label>Pompa no</label><input name="pumpNo" value="${value('pumpNo')}" placeholder="Pompa / tabanca no"></div></div><div class="section-head"><h4>Belge bilgileri</h4></div><div class="form-grid"><div class="form-group"><label>Fiş / belge no</label><input name="receiptNo" value="${value('receiptNo')}" placeholder="Fiş no / Z no"></div><div class="form-group"><label>İşlem no</label><input name="transactionNo" value="${value('transactionNo')}" placeholder="İşlem / referans no"></div></div><div class="form-grid"><div class="form-group"><label>Vergi no (VKN)</label><input name="taxNo" value="${value('taxNo')}" placeholder="VKN"></div><div class="form-group"><label>Firma / satıcı</label><input name="issuer" value="${value('issuer')}" placeholder="Firma adı"></div></div>${itemRows ? `<div class="section-head"><h4>Yakıt satırları</h4></div><div class="metric-list">${itemRows}</div>` : ''}<div class="section-head"><h4>Ham OCR metni</h4></div><textarea name="rawText" readonly rows="5">${esc(sourceText)}</textarea><div class="sheet-actions"><button type="button" class="secondary-button" data-action="close">Vazgeç</button><button class="primary-button" type="submit">Fişi kaydet</button></div></form></div>`);
}
function receiptSourceModal() {
  openModal('Fiş oku','Fişi doğrudan kameradan çekebilir veya galerideki mevcut fotoğrafı seçebilirsiniz.',`<div class="document-source-choice"><button class="source-choice camera-choice" data-action="receipt-source" data-source="camera"><span class="source-choice-icon">${ico('camera',24)}</span><span><b>Kamerayı aç</b><small>Yeni fiş fotoğrafı çek</small></span>${ico('chevron',17)}</button><button class="source-choice gallery-choice" data-action="receipt-source" data-source="gallery"><span class="source-choice-icon">${ico('image',24)}</span><span><b>Galeriden seç</b><small>Kayıtlı fiş fotoğrafını kullan</small></span>${ico('chevron',17)}</button></div><p class="muted" style="font-size:11px;line-height:1.45;margin-top:14px">Seçtiğiniz görüntü cihazdaki OCR ile okunur. Okunan alanları kaydetmeden önce mutlaka kontrol edebilirsiniz.</p>`);
}
function receiptResultModal(result) {
  receiptFormModal(result.parsed || {}, result, null);
}
function documentOcrResultModal(result, type) { const p=result.parsed || {}; const fields = type === 'insurance' ? [['provider','Sigorta şirketi'],['policyNo','Poliçe numarası'],['startDate','Başlangıç tarihi'],['expiry','Bitiş tarihi'],['assistancePhone','Asistans telefonu']] : [['plate','Benim plakam'],['otherPlate','Karşı taraf plakası'],['insuranceCompany','Sigorta şirketi'],['policyNo','Poliçe numarası'],['otherPhone','Karşı taraf telefonu']]; const missing = fields.filter(([key]) => !p[key]).map(([,label]) => label); pendingDocumentDraft = { type, parsed:p, rawText:result.rawText || '' }; const scanLabel = result.scanMode === 'document' ? `Belge tarayıcı · ${result.pageCount || 1} sayfa` : 'Kamera fotoğrafı'; const rows = fields.map(([key,label]) => `<div class="metric-row"><span>${label}</span><b>${esc(p[key] || 'Eksik — formda doldurun')}</b></div>`).join(''); openModal(type === 'insurance' ? 'Poliçe OCR taslağı' : 'Kaza belgesi OCR taslağı',result.message || 'Belge taraması tamamlandı.',`<div class="receipt-result"><div class="receipt-status ${result.ocr ? 'ok':''}">${result.ocr ? `Cihaz içi OCR tamamlandı · ${scanLabel}` : `${scanLabel} · manuel kontrol gerekli`}</div><div class="metric-list">${rows}</div>${missing.length ? `<div class="notice-card warning" style="margin-top:12px"><div class="notice-icon">${ico('alert',20)}</div><div><strong>${missing.length} alan eksik</strong><p>${esc(missing.join(', '))}. Taslağı açıp bilgileri elle tamamlayın.</p></div></div>` : `<div class="notice-card"><div class="notice-icon">${ico('check',20)}</div><div><strong>Taslak hazır</strong><p>Kaydetmeden önce tüm alanları kontrol edebilirsiniz.</p></div></div>`}${p.rawText ? `<details><summary>Ham OCR metni</summary><pre>${esc(p.rawText)}</pre></details>` : ''}</div><div class="sheet-actions"><button class="secondary-button" data-action="close">Kapat</button><button class="primary-button" data-action="apply-document-draft" data-document="${type}">Taslağı forma aktar</button></div>`); }
 function barcodeResultModal(result) {
   pendingBarcodeResult = result;
   const raw = String(result.rawValue || '').trim();
   const parsed = parseReceiptText(raw);
   const hasReceiptData = Boolean(parsed.amount || parsed.liters || parsed.plate || /motorin|diesel|mazot|lpg|otogaz|benzin/i.test(raw));
   const isLink = /^https?:\/\//i.test(raw);
   const saveButton = hasReceiptData ? '<button class="primary-button" data-action="save-barcode-receipt">Fiş taslağına kaydet</button>' : '';
   const linkButton = isLink ? `<a class="secondary-button" href="${esc(raw)}" target="_blank" rel="noreferrer">Bağlantıyı aç</a>` : '';
   openModal('Karekod sonucu', `${esc(result.format || 'QR / barkod')} · Bilgi kaydetmeden önce kontrol edilir.`, `<div class="receipt-result"><div class="receipt-status ok">Karekod okundu</div><div class="metric-list"><div class="metric-row"><span>Format</span><b>${esc(result.format || '—')}</b></div><div class="metric-row"><span>Yakıt</span><b>${esc(parsed.fuel || 'Belirlenemedi')}</b></div><div class="metric-row"><span>Tutar</span><b>${parsed.amount ? money(parsed.amount) : 'Belirlenemedi'}</b></div><div class="metric-row"><span>Litre</span><b>${parsed.liters ? `${parsed.liters.toLocaleString('tr-TR')} L` : 'Belirlenemedi'}</b></div><div class="metric-row"><span>Plaka</span><b>${esc(parsed.plate || 'Belirlenemedi')}</b></div></div><details><summary>Okunan veri</summary><pre>${esc(raw)}</pre></details><p class="muted" style="font-size:10px;line-height:1.45;margin-top:12px">Karekod yalnızca bir bağlantı veya kimlik taşıyorsa uygulama otomatik alan uydurmaz; veriyi görüntüler. Fiş bilgisi içeriyorsa taslak olarak kaydedilebilir.</p></div><div class="sheet-actions">${saveButton}${linkButton}<button class="secondary-button" data-action="copy-barcode">Veriyi kopyala</button><button class="secondary-button" data-action="close">Kapat</button></div>`);
 }
 function saveBarcodeReceipt() {
   const raw = pendingBarcodeResult?.rawValue || '';
   const parsed = parseReceiptText(raw);
   if (!raw || (!parsed.amount && !parsed.liters && !parsed.plate)) { toast('Karekodda kaydedilebilir fiş alanı bulunamadı.', true); return; }
   pendingBarcodeResult = null;
   receiptFormModal(parsed, { ocr:true, rawText:raw, passes:1, message:'Karekoddan alınan alanları kaydetmeden önce kontrol edin.' }, null);
 }
 async function copyBarcodeValue() {
   const raw = pendingBarcodeResult?.rawValue || '';
   if (!raw) return;
   try { await navigator.clipboard.writeText(raw); toast('Karekod verisi panoya kopyalandı.'); }
   catch { toast('Kopyalama izni alınamadı.', true); }
 }
 async function runBarcodeScan() {
   closeModal();
   toast('Karekod tarayıcı açılıyor…');
   const result = await scanBarcode();
   if (result.ok) barcodeResultModal(result);
   else if (!result.cancelled) toast(result.message || 'Karekod okunamadı.', true);
 }
 async function runDocumentOcr(target) {
   if (documentOcrBusy) return;
   documentOcrBusy = true;
   const type = target?.dataset.document || 'insurance';
   closeModal();
   const source = target?.dataset.source || 'camera';
   toast(source === 'gallery' ? 'Galeri açılıyor…' : 'Belge kamerası açılıyor…');
   try {
     const result = await readDocument(type, source);
     if (!result?.ok) { if (!result?.cancelled) toast(result?.message || 'Belge/OCR işlemi başarısız.', true); return; }
     documentOcrResultModal(result, type);
   } catch (error) {
     toast(error?.message || 'Kamera/OCR işlemi başarısız.', true);
   } finally {
     documentOcrBusy = false;
   }
 }
 function applyDocumentDraft(type) { const draft = pendingDocumentDraft; pendingDocumentDraft = null; closeModal(); if (!draft || draft.type !== type) { toast('OCR taslağı bulunamadı.', true); return; } if (type === 'insurance') insuranceModal(draft.parsed); else accidentModal(draft.parsed); toast('OCR taslağı forma aktarıldı; eksik alanları kontrol edin.', true); }
function healthDetailModal() { if (!healthSnapshot?.connected || !healthReport) { openModal('Araç sağlık analizi','Gerçek araç sağlığı için OBD-II adaptörü gerekir.',`<div class="notice-card warning"><div class="notice-icon">${ico('bluetooth',20)}</div><div><strong>OBD bağlantısı yok</strong><p>Canlı PID verisi alınmadığı için araç iyi/kötü sonucu veya sağlık skoru gösterilmiyor. ELM327 adaptörünü bağlayıp cihaz tara seçeneğini kullanın.</p></div></div><button class="primary-button full-button" data-action="obd" style="margin-top:12px">OBD bağlantısını aç</button>`); return; } const metricRows = obdMetrics.map(([key,label,unit]) => healthSnapshot[key] == null ? '' : `<div class="metric-row"><span>${label}</span><b>${Number(healthSnapshot[key]).toLocaleString('tr-TR',{maximumFractionDigits:1})} ${unit}</b></div>`).join(''); openModal('Araç sağlık analizi','OBD-II verilerinden açıklanabilir ön değerlendirme.',`<div class="health-summary"><div class="health-score large ${healthReport.score < 65 ? 'warn':''}"><strong>${healthReport.score}</strong><span>/100</span></div><div><b>${healthReport.level}</b><p>${healthReport.disclaimer}</p></div></div><div class="finding-list">${healthReport.findings.map(f=>`<div class="finding ${f.severity}"><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></div>`).join('')}</div>${metricRows ? `<div class="metric-list">${metricRows}</div>`:''}<p class="muted" style="font-size:10px;line-height:1.45;margin-top:14px">${esc(obdSourceNote())}</p>`); }
function obdModal(devices = []) { const list = devices.length ? devices.map(d=>`<button class="device-row" data-action="obd-connect" data-address="${esc(d.address || d.id)}" data-name="${esc(d.name || 'ELM327')}"><i class="row-icon">${ico('bluetooth',18)}</i><span><b>${esc(d.name || 'İsimsiz Bluetooth')}</b><small>${esc(d.address || d.id || '')}</small></span>${ico('chevron',16)}</button>`).join('') : `<div class="notice-card"><div class="notice-icon">${ico('bluetooth',20)}</div><div><strong>Adaptörü hazırla</strong><p>OBD-II portuna ELM327 takın. Android’de Bluetooth’u açıp taramayı başlatın.</p></div></div>`; openModal('OBD-II bağlantısı','BLE ve Bluetooth Classic ELM327 adaptörleri için bağlantı katmanı.',`<div class="obd-protocols"><span class="chip teal">PID 05–42</span><span class="chip yellow">ELM327</span><span class="chip teal">Yerel analiz</span></div><div class="card device-list">${list}</div><div class="sheet-actions"><button class="secondary-button" data-action="obd-demo">Demo ölçüm (test)</button><button class="primary-button" data-action="obd-scan">Cihaz tara</button></div><p class="muted" style="font-size:10px;line-height:1.45;margin-top:12px">Canlı bağlantı yalnızca native APK’da izin ve gerçek ELM327 adaptörüyle denenebilir. Demo/test verisi araç sağlığı skoru değildir.</p>`); }
async function scanObd() { const result = await connectObdClassic(); if (!result.ok) { toast(result.message || 'OBD taraması başlatılamadı.', true); return; } obdModal(result.devices || []); toast(`${(result.devices || []).length} Bluetooth cihazı bulundu.`); }
async function useObdDevice(target) { closeModal(); toast('OBD adaptöründen PID verileri okunuyor…'); const snapshot = await readObdSnapshot({ address:target.dataset.address, name:target.dataset.name }); healthSnapshot = snapshot; healthReport = snapshot.connected === true ? analyzeVehicleHealth(snapshot) : null; state.healthSnapshot = snapshot; state.healthReport = healthReport; state.obdDevice = snapshot.connected === true ? { address:target.dataset.address, name:target.dataset.name } : null; save(state); render(); healthDetailModal(); }
function useDemoHealth() { healthSnapshot = { ...demoObdSnapshot(), source:'Yerel OBD demo/test ölçümü' }; healthReport = null; state.healthSnapshot=healthSnapshot; state.healthReport=null; save(state); closeModal(); render(); healthDetailModal(); toast('Demo veri gerçek araç sağlığı olarak gösterilmez.', true); }
async function requestLocationAccess({ showModal = true } = {}) {
  closeModal();
  const result = await requestCurrentPosition();
  rememberLocationResult(result);
  if (result.ok) {
    state.gps = true;
    state.settings.locationPromptSeen = true;
    save(state);
    render();
    toast('Konum izni açık; GPS gerektiğinde kullanılabilir.');
  } else {
    state.settings.locationPromptSeen = true;
    save(state);
    render();
    const settingsTarget = result.status === 'service-off' ? 'device' : 'app';
    const settingsResult = ['denied','service-off'].includes(result.status) ? await openLocationSettings(settingsTarget) : { ok:false };
    if (settingsResult.ok && settingsTarget === 'device') toast('Android Konum ayarları açıldı. Cihaz konum anahtarını açıp uygulamaya dönün.');
    if (settingsResult.ok && settingsTarget === 'app') toast('Android uygulama ayarları açıldı. İzinler > Konum bölümünden Sürüş Cepte’ye izin verin.');
    if (showModal) locationAccessModal();
    if (!settingsResult.ok) toast(result.message || 'Konum alınamadı. Android konum izni ve cihaz konum anahtarını kontrol edin.', true);
  }
  return result;
}
async function initializeLocationAccess() {
  const firstLaunch = !state.settings.locationPromptSeen;
  state.settings.locationPromptSeen = true;
  save(state);
  if (firstLaunch) {
    render();
    if (state.locationAccess?.status !== 'granted') locationAccessModal();
    return state.locationAccess;
  }
  const permission = await checkLocationPermission();
  if (permission.status === 'granted') {
    const result = await requestCurrentPosition();
    rememberLocationResult(result);
    render();
    return result;
  }
  rememberLocationResult(permission);
  render();
  return permission;
}
const fuelMonitorTypes = ['benzin','motorin','lpg'];
function monitoredFuelTypes() {
  const vehicleTypes = state.vehicles.map(vehicle => vehicleFuelKey(vehicle.fuel)).filter(Boolean);
  return [...new Set([state.fuelType, ...vehicleTypes, ...fuelMonitorTypes])];
}
function selectedLivePriceRow(rows) {
  return rows?.find(row => row.district === state.location.district && row.live && row.price != null) || rows?.find(row => row.live && row.price != null) || rows?.find(row => row.district === state.location.district) || rows?.[0];
}
async function captureVerifiedPriceChange(type, rows) {
  const selected = selectedLivePriceRow(rows);
  const trusted = selected?.trusted === true && rows?.meta?.trusted === true && Number(selected?.sourceCount) >= 2;
  const current = Number(selected?.price);
  if (!trusted || !Number.isFinite(current)) return { selected, nativeNotification:null, changed:false };
  const key = `${state.location.city}:${state.location.district}:${type}`;
  const previousRaw = state.priceSnapshots?.[key];
  const previous = Number(typeof previousRaw === 'object' ? previousRaw.price : previousRaw);
  const previousWasTrusted = typeof previousRaw !== 'object' || previousRaw.trusted !== false;
  const checkedAt = rows.meta.checkedAt || displayNow();
  let nativeNotification = null;
  let changed = false;
  if (previousWasTrusted && Number.isFinite(previous) && Math.abs(current - previous) >= .01 && state.settings.notifications) {
    const direction = current > previous ? 'up' : 'down';
    const duplicate = state.notifications.some(item => item.snapshotKey === key && Math.abs(Number(item.currentPrice) - current) < .005);
    if (!duplicate) {
      const difference = Math.abs(current - previous).toFixed(2).replace('.',',');
      const changeText = `${fuelLabels[type]} ${state.location.city} / ${selected.district || state.location.district} ortalaması ${difference} ₺ ${direction === 'up' ? 'arttı' : 'azaldı'}. Değişim ${selected.sourceCount} tarih uyumlu canlı kaynakta doğrulandı; kontrol: ${checkedAt}.`;
      state.notifications.unshift({ id:uid('price'), kind:direction, date:checkedAt, seen:false, sourceName:selected.source, sourceCount:selected.sourceCount, snapshotKey:key, fuelType:type, previousPrice:previous, currentPrice:current, text:changeText });
      state.notifications = state.notifications.slice(0,20);
      nativeNotification = await scheduleFuelNotification({ title:`Yakıt ${direction === 'up' ? 'artışı' : 'indirimi'} doğrulandı`, body:changeText });
      changed = true;
    }
  }
  state.priceSnapshots = { ...(state.priceSnapshots || {}), [key]: { price:current, checkedAt, trusted:true, sourceCount:selected.sourceCount } };
  return { selected, nativeNotification, changed };
}
async function refreshPrices({ silent = false } = {}) {
  const types = monitoredFuelTypes();
  const results = await Promise.allSettled(types.map(type => getFuelPrices({ city:state.location.city, type })));
  const changes = [];
  const nativeFailures = [];
  for (const [index, result] of results.entries()) {
    if (result.status !== 'fulfilled') continue;
    const type = types[index];
    const rows = result.value;
    if (type === state.fuelType) priceRecords = rows;
    const outcome = await captureVerifiedPriceChange(type, rows);
    if (outcome.changed) changes.push({ type, outcome });
    if (outcome.nativeNotification && !outcome.nativeNotification.ok) nativeFailures.push(type);
  }
  save(state);
  render();
  if (silent) return { changes, rows:priceRecords };
  const selected = selectedLivePriceRow(priceRecords);
  const trusted = selected?.trusted === true;
  const meta = priceRecords.meta || {};
  const baseMessage = trusted ? `Güncellendi · kontrol ${meta.checkedAt || displayNow()}` : meta.live && selected?.sourceCount >= 2 ? 'Birden fazla canlı kaynak okundu ancak tarih uyumu doğrulanmadı; doğrulanmış alarm oluşturulmadı.' : meta.live ? 'Seçili konumda tek canlı kaynak okundu; doğrulanmış alarm oluşturulmadı.' : 'Canlı kaynak doğrulanamadı; bildirim oluşturulmadı.';
  const changeMessage = changes.length ? `${changes.map(item => `${fuelLabels[item.type]} ${item.outcome.selected?.price != null ? 'değişimi' : 'güncellemesi'}`).join(' · ')} bildirimi oluşturuldu.` : baseMessage;
  toast(nativeFailures.length ? `${changeMessage} Android bildirim izni kapalı; uygulama içi bildirim kaydedildi.` : changeMessage, !meta.live || nativeFailures.length > 0);
  return { changes, rows:priceRecords };
}
async function refreshFutureFuelAlerts(silent = false) {
  futureFuelAlertsStatus = 'loading';
  state.futureFuelAlertsStatus = futureFuelAlertsStatus;
  if (!silent) render();
  try {
    const payload = await getFuelAlerts();
    futureFuelAlerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
    futureFuelAlertsCheckedAt = payload?.checkedAt || displayNow();
    futureFuelAlertsStatus = payload?.error ? 'error' : 'ready';
    state.futureFuelAlerts = futureFuelAlerts;
    state.futureFuelAlertsCheckedAt = futureFuelAlertsCheckedAt;
    state.futureFuelAlertsStatus = futureFuelAlertsStatus;
    state.futureFuelAlertChecks = payload?.checks || [];
    save(state);
    render();
  } catch (error) {
    futureFuelAlertsStatus = 'error';
    state.futureFuelAlertsStatus = futureFuelAlertsStatus;
    state.futureFuelAlertsCheckedAt = displayNow();
    save(state);
    render();
  }
}
async function recordPark() {
  const item = { id:uid('park'), title:'Mevcut park konumu', date:displayNow(), note:state.gps ? 'GPS konumu aranıyor…' : 'GPS kapalı', latitude:null, longitude:null, accuracy:null, capturedAt:null, source:'manual' };
  state.parks.unshift(item);
  persist();
  toast(state.gps ? 'Park kaydı oluşturuldu; yüksek doğruluklu GPS aranıyor…' : 'Park kaydı oluşturuldu; GPS kapalı.', !state.gps);
  if (!state.gps) return;
  const pos = await requestCurrentPosition();
  rememberLocationResult(pos);
  const saved = state.parks.find(park => park.id === item.id);
  if (!saved) return;
  saved.note = pos.ok ? 'GPS konumu doğrulandı' : 'GPS konumu alınamadı';
  if (pos.ok) { saved.latitude = pos.latitude; saved.longitude = pos.longitude; saved.accuracy = pos.accuracy ?? null; saved.capturedAt = pos.capturedAt || new Date().toISOString(); }
  persist();
  toast(pos.ok ? `Park konumu GPS ile güncellendi${pos.accuracy ? ` · ±${Math.round(pos.accuracy)} m` : ''}.` : 'Park kaydı duruyor; koordinat alınamadı.', !pos.ok);
}
function saveAutoParkCandidate() {
  const candidate = state.activeTrip?.autoParkCandidate || state.pendingParkCandidate;
  if (!candidate) return toast('Kaydedilecek otomatik park önerisi yok.', true);
  state.parks.unshift({ id:uid('park'), title:'Otomatik park konumu', date:displayNow(), note:`Sürüş sırasında yaklaşık ${Math.max(1, Math.round(Number(candidate.stationaryMinutes || 0)))} dakika sabit konum algılandı.`, latitude:candidate.latitude, longitude:candidate.longitude, accuracy:candidate.accuracy ?? null, capturedAt:candidate.capturedAt || new Date().toISOString(), source:'auto-gps' });
  if (state.activeTrip) state.activeTrip.autoParkCandidate = null;
  state.pendingParkCandidate = null;
  persist();
  toast('Otomatik park önerisi park geçmişine kaydedildi.');
}
function dismissAutoParkCandidate() {
  if (state.activeTrip) state.activeTrip.autoParkCandidate = null;
  state.pendingParkCandidate = null;
  persist();
  toast('Otomatik park önerisi yok sayıldı.');
}
async function emergency(share = false) { const pos = await requestCurrentPosition(); rememberLocationResult(pos); const item={id:uid('emergency'),date:displayNow(),capturedAt:pos.capturedAt || new Date().toISOString(),latitude:pos.ok?pos.latitude:null,longitude:pos.ok?pos.longitude:null,accuracy:pos.ok ? pos.accuracy ?? null : null,source:pos.ok?'GPS':'Konum alınamadı',error:pos.ok?'':(pos.message || '')}; state.emergencies.unshift(item); state.emergencies=state.emergencies.slice(0,30); save(state); const text=pos.ok ? `Sürüş Cepte acil konum: https://maps.google.com/?q=${pos.latitude},${pos.longitude}` : `Sürüş Cepte acil konum alınamadı: ${pos.message || 'konum kapalı'}`; if (share && navigator.share && pos.ok) { try { await navigator.share({ title:'Acil konum', text }); } catch {} } render(); toast(pos.ok ? (share ? 'Acil konum kaydedildi ve paylaşım açıldı.' : 'Acil konum GPS ile kaydedildi.') : `Acil kayıt kaydedildi; ${pos.message || 'GPS alınamadı'}`, !pos.ok); }
async function shareEmergencyLocation() { const last=state.emergencies?.find(item => item.latitude != null); if (!last) { await emergency(true); return; } const text=`Sürüş Cepte acil konum: https://maps.google.com/?q=${last.latitude},${last.longitude}`; if (navigator.share) { try { await navigator.share({ title:'Acil konum', text }); toast('Acil konum paylaşım ekranı açıldı.'); } catch {} } else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('Konum bağlantısı panoya kopyalandı.'); } else toast(text, true); }
async function shareAccident(id) { const item=state.accidents?.find(record => record.id === id); if (!item) return; const coords=item.gps?.latitude != null ? `https://maps.google.com/?q=${item.gps.latitude},${item.gps.longitude}` : 'GPS kaydı yok'; const text=`Kaza tutanağı: ${item.title}\nTarih: ${item.occurredAt || item.date}\nKonum: ${coords}\nPlaka: ${item.plate || '—'}\nNot: ${item.note || '—'}`; if (navigator.share) { try { await navigator.share({ title:'Kaza tutanağı', text }); toast('Kaza özeti paylaşım ekranı açıldı.'); } catch {} } else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('Kaza özeti panoya kopyalandı.'); } else toast('Cihaz paylaşımı desteklemiyor.', true); }
function startTripGpsWatch() {
  if (!state.activeTrip || tripWatchId != null || !navigator.geolocation) return;
  tripWatchId = navigator.geolocation.watchPosition(updateTripPosition, () => {}, { enableHighAccuracy:true, maximumAge:3000, timeout:15000 });
}
function updateTripPosition(position) {
  if (!state.activeTrip) return;
  const coords = position.coords || {};
  const next = { latitude:coords.latitude, longitude:coords.longitude, accuracy:coords.accuracy ?? null, capturedAt:new Date(position.timestamp || Date.now()).toISOString() };
  const previous = state.activeTrip.lastPosition || state.activeTrip.startPosition;
  const segmentKm = previous ? haversineKm(previous,next) : 0;
  const speedKmh = Number.isFinite(Number(coords.speed)) && Number(coords.speed) >= 0 ? Number(coords.speed) * 3.6 : null;
  state.activeTrip.distanceKm = Number(state.activeTrip.distanceKm || 0) + segmentKm;
  state.activeTrip.lastPosition = { ...next, speedKmh };
  state.activeTrip.kmSource = 'GPS yüksek doğruluk ölçümü';
  if (state.settings.autoParkDetection && (!Number.isFinite(Number(next.accuracy)) || Number(next.accuracy) <= 50)) {
    const movedMeters = segmentKm * 1000;
    const moving = (speedKmh != null && speedKmh >= 5) || movedMeters >= 60;
    if (moving) {
      state.activeTrip.stationarySince = null;
      state.activeTrip.stationaryPosition = null;
    } else {
      state.activeTrip.stationarySince ||= Date.now();
      state.activeTrip.stationaryPosition ||= next;
      const stationaryMinutes = (Date.now() - state.activeTrip.stationarySince) / 60000;
      const requiredMinutes = Math.max(2, Number(state.settings.autoParkMinutes) || 3);
      if (stationaryMinutes >= requiredMinutes && !state.activeTrip.autoParkCandidate) {
        const anchor = state.activeTrip.stationaryPosition || next;
        state.activeTrip.autoParkCandidate = { latitude:anchor.latitude, longitude:anchor.longitude, accuracy:anchor.accuracy ?? next.accuracy ?? null, capturedAt:anchor.capturedAt, stationaryMinutes:Math.round(stationaryMinutes) };
        save(state);
        render();
        toast('Sabit konum algılandı; park olarak kaydetmek ister misiniz?');
      }
    }
  }
  const el=document.querySelector('#tripKm'); if (el) el.textContent=`GPS ile ölçülen mesafe: ${Number(state.activeTrip.distanceKm).toFixed(1)} km · ${state.activeTrip.kmSource}`;
  if (Date.now()-lastTripPersistAt > 10000) { lastTripPersistAt=Date.now(); save(state); }
}
async function startTrip() {
  if (state.activeTrip) { toast('Zaten aktif bir sürüş var.', true); return; }
  const id = uid('trip');
  state.activeTrip = { id, startedAt:Date.now(), type:'Kişisel', startPosition:null, lastPosition:null, distanceKm:0, kmSource:state.gps ? 'GPS yüksek doğruluk konumu aranıyor…' : 'GPS kapalı', stationarySince:null, stationaryPosition:null, autoParkCandidate:null };
  persist();
  toast(state.gps ? 'Sürüş başladı; yüksek doğruluklu GPS aranıyor…' : 'Sürüş başladı; GPS kapalı, kilometre 0 tutulacak.', !state.gps);
  tripClock();
  if (!state.gps) return;
  const pos = await requestCurrentPosition();
  rememberLocationResult(pos);
  if (!state.activeTrip || state.activeTrip.id !== id) return;
  if (pos.ok) {
    state.activeTrip.startPosition = { latitude:pos.latitude, longitude:pos.longitude, accuracy:pos.accuracy ?? null, capturedAt:pos.capturedAt };
    state.activeTrip.lastPosition = state.activeTrip.startPosition;
    state.activeTrip.kmSource = 'GPS yüksek doğruluk ölçümü başladı';
    startTripGpsWatch();
    persist();
    toast('Yüksek doğruluklu GPS ölçümü başladı.');
  } else {
    state.activeTrip.kmSource = 'GPS izni yok';
    persist();
    toast('Sürüş kaydı açık; GPS izni yok, kilometre 0 tutulacak.', true);
  }
}
async function endTrip() {
  if (!state.activeTrip) { toast('Aktif sürüş bulunamadı.', true); return; }
  const active = { ...state.activeTrip };
  if (tripWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(tripWatchId);
  tripWatchId = null;
  const elapsed = Math.max(1, Math.round((Date.now() - active.startedAt) / 60000));
  const km = Math.round(Number(active.distanceKm || 0) * 10) / 10;
  state.trips.unshift({ id:active.id, title:'Manuel sürüş kaydı', date:displayNow(), km, duration:`${elapsed} dk`, type:active.type, note:active.note || '', active:false, kmSource:km>0?'GPS yüksek doğruluk ölçümü':'GPS ölçümü yok' });
  if (active.autoParkCandidate) state.pendingParkCandidate = { ...active.autoParkCandidate, tripId:active.id };
  state.activeTrip = null;
  persist();
  toast(active.autoParkCandidate ? 'Sürüş tamamlandı; otomatik park önerisi geçmişe eklenmek üzere hazır.' : km > 0 ? `Sürüş tamamlandı · ${km.toFixed(1)} km GPS kaydı.` : 'Sürüş tamamlandı; GPS ölçümü olmadığı için 0 km kaydedildi.');
}
function tripClock() { const el=document.querySelector('#tripTimer'); if(!el || !state.activeTrip) return; const secs=Math.floor((Date.now()-state.activeTrip.startedAt)/1000); el.textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`; setTimeout(tripClock,1000); }

app.addEventListener('click', async event => {
  const target = event.target.closest('[data-action],[data-view]'); if (!target) return;
  const { action, view } = target.dataset;
  if (view) { state.view=view; persist(); window.scrollTo({top:0,behavior:'smooth'}); return; }
  if (action === 'toggle-gps') { if (state.gps && state.locationAccess?.status === 'granted') { state.gps=false; persist(); toast('GPS kullanımı uygulama içinde kapatıldı.'); } else await requestLocationAccess(); }
  else if (action === 'request-location') await requestLocationAccess();
  else if (action === 'settings') settingsModal();
  else if (action === 'notif-tab') { state.notificationTab=target.dataset.tab; persist(); }
  else if (action === 'future-alert-detail') futureAlertDetailModal();
  else if (action === 'refresh-fuel-alerts') await refreshFutureFuelAlerts();
  else if (action === 'notifications') { openModal('Akaryakıt bildirimleri','Yalnızca canlı kaynak karşılaştırmaları burada görünür.',`<div class="card list-card">${state.notifications.length ? state.notifications.map(n=>listRow({icon:n.kind==='down'?'chart':'bell',title:n.kind==='down'?'Fiyat düşüşü doğrulandı':n.kind==='up'?'Fiyat artışı doğrulandı':'Fiyat güncellemesi',subtitle:n.text,end:n.date})).join('') : '<div class="empty-card"><p>Henüz canlı kaynakla doğrulanmış fiyat değişikliği yok.</p></div>'}</div>`); }
  else if (action === 'early-warning') await earlyWarningModal();
  else if (action === 'pin-priority-card') { const item=priorityCardItems().find(row=>row.key===target.dataset.priorityKey); if(item){ state.settings.homePriorityPinned={...item}; persist(); render(); toast('Öncelik kartı sabitlendi.'); } }
  else if (action === 'unpin-priority-card') { state.settings.homePriorityPinned=null; persist(); render(); toast('Öncelik kartı otomatik moda alındı.'); }
  else if (action === 'fuel-alert-sources') fuelSourceModal();
  else if (action === 'emergency') emergencyCenterModal();
  else if (action === 'park') await recordPark();
  else if (action === 'accident') accidentModal();
  else if (action === 'open-history') historyModal('trips');
  else if (action === 'open-parks') historyModal('parks');
  else if (action === 'navigate-park') openParkInMaps(target.dataset.id);
  else if (action === 'edit-trip') { const item=state.trips.find(row=>row.id===target.dataset.id); if (item) tripEditModal(item); }
  else if (action === 'vehicle-tab') { state.vehicleTab=target.dataset.tab; persist(); }
  else if (action === 'add-vehicle') vehicleModal();
  else if (action === 'edit-vehicle') vehicleModal(state.vehicles.find(v=>v.id===target.dataset.id));
  else if (action === 'refuel') openRefuelView(state.vehicles.find(v=>v.id===target.dataset.id) || state.vehicles.find(v=>v.id===state.selectedVehicleId) || state.vehicles[0]);
  else if (action === 'delete-vehicle') { state.vehicles=state.vehicles.filter(v=>v.id!==target.dataset.id); if(state.selectedVehicleId===target.dataset.id) state.selectedVehicleId=null; closeModal(); persist(); toast('Araç kaldırıldı.'); }
  else if (action === 'select-vehicle') { state.selectedVehicleId=target.dataset.id; persist(); toast('Aktif araç seçildi.'); }
  else if (action === 'receipt') receiptSourceModal();
  else if (action === 'barcode-scan') await runBarcodeScan();
  else if (action === 'document-ocr') await runDocumentOcr(target);
  else if (action === 'apply-document-draft') applyDocumentDraft(target.dataset.document || 'insurance');
  else if (action === 'add-driver') driverModal();
  else if (action === 'catalog') catalogModal();
  else if (action === 'catalog-add') { const profile=vehicleProfileById(target.dataset.profileId || 'manual'); vehicleModal({...profile,profileId:profile.id,plate:'',km:state.settings.mileage||0,favoriteStation:'',fuelLevelPercent:0}); }
  else if (action === 'remove-driver') { state.drivers=state.drivers.filter(driver=>driver.id!==target.dataset.id); persist(); toast('Sürücü kaldırıldı.'); }
  else if (action === 'start-trip') await startTrip();
  else if (action === 'end-trip') await endTrip();
  else if (action === 'save-auto-park') saveAutoParkCandidate();
  else if (action === 'dismiss-auto-park') dismissAutoParkCandidate();
  else if (action === 'trip-note') tripNoteModal();
  else if (action === 'documents') documentsModal();
  else if (action === 'insurance') insuranceModal();
  else if (action === 'maintenance') maintenanceModal();
  else if (action === 'hgs') hgsModal();
  else if (action === 'badges') badgesModal();
  else if (action === 'report') reportModal();
  else if (action === 'obd' || action === 'health-detail') action === 'obd' ? obdModal() : healthDetailModal();
  else if (action === 'location') locationModal();
  else if (action === 'fuel') { state.fuelType=target.dataset.fuel; await refreshPrices(); await refreshFutureFuelAlerts(true); }
  else if (action === 'refresh-prices') { await refreshPrices(); await refreshFutureFuelAlerts(true); }
  else if (action === 'nearby-stations') await loadNearbyStations();
  else if (action === 'fuel-source') fuelSourceModal();
  else if (action === 'favorites-filter') { state.pricesOnlyFavorites=!state.pricesOnlyFavorites; persist(); }
  else if (action === 'favorite') { const d=target.dataset.district; state.favorites=state.favorites.includes(d)?state.favorites.filter(x=>x!==d):[...state.favorites,d]; persist(); }
  else if (action === 'export') { exportBackup(state); toast('JSON yedeği indirildi.'); }
  else if (action === 'import') { const input=document.createElement('input'); input.type='file'; input.accept='application/json'; input.onchange=async()=>{ if(!input.files?.[0])return; try{state=await importBackup(input.files[0]); save(state); render(); toast('Yedek geri yüklendi.');}catch(e){toast(e.message,true);} }; input.click(); }
  else if (action === 'notification-settings') notificationSettingsModal();
  else if (action === 'motion-settings') { state.settings.motionTracking=!state.settings.motionTracking; persist(); toast(`Arka plan sürüş kaydı demo modu ${state.settings.motionTracking?'açık':'kapalı'}.`); }
  else if (action === 'request-notification') { const r=await requestNotificationPermission(); toast(r.message,!r.ok); }
  else if (action === 'reset') { if(confirm('Tüm kayıtlar bu cihazdan silinsin mi?')) { state=reset(seedState); priceRecords=[]; futureFuelAlerts=[]; futureFuelAlertsStatus='idle'; futureFuelAlertsCheckedAt=''; healthSnapshot=null; healthReport=null; persist(); toast('Kayıtlar sıfırlandı.'); } }
});
modalLayer.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]');
  if (event.target === modalLayer || target?.dataset.action === 'close') { closeModal(); return; }
  if (!target) return;
  if (target.dataset.action === 'barcode-scan') { await runBarcodeScan(); return; }
  if (target.dataset.action === 'receipt-source') { closeModal(); const source=target.dataset.source || 'camera'; toast(source === 'gallery' ? 'Fiş galeriden seçiliyor…' : 'Fiş kamerası açılıyor…'); try { const result=await readReceipt(source); if (result?.ok) receiptResultModal(result); else if (!result?.cancelled) toast(result?.message || 'Fiş görüntüsü alınamadı.', true); } catch (error) { toast(error?.message || 'Fiş OCR işlemi başarısız.', true); } return; }
  if (target.dataset.action === 'save-barcode-receipt') { saveBarcodeReceipt(); return; }
  if (target.dataset.action === 'copy-barcode') { await copyBarcodeValue(); return; }
  if (target.dataset.action === 'document-ocr') { await runDocumentOcr(target); return; }
  if (target.dataset.action === 'add-vehicle') { closeModal(); vehicleModal(); return; }
  if (target.dataset.action === 'refuel') { openRefuelView(state.vehicles.find(v=>v.id===target.dataset.id)); return; }
  if (target.dataset.action === 'edit-receipt') { const item=state.receipts.find(row=>row.id===target.dataset.id); if (item) receiptFormModal(item, { ocr:true, rawText:item.rawText || '', passes:item.ocrPasses || 1, message:'Kayıtlı fiş alanlarını düzenleyin.' }, item); return; }
  if (target.dataset.action === 'request-notification') {
    const r = await requestNotificationPermission();
    toast(r.message, !r.ok);
  }
  if (target.dataset.action === 'request-location') { await requestLocationAccess(); return; }
  if (target.dataset.action === 'accident-gps') await captureAccidentGps();
  if (target.dataset.action === 'capture-emergency-location') { await emergency(false); emergencyCenterModal(); }
  if (target.dataset.action === 'share-emergency-location') await shareEmergencyLocation();
  if (target.dataset.action === 'location-help') locationHelpModal();
  if (target.dataset.action === 'navigate-park') openParkInMaps(target.dataset.id);
  if (target.dataset.action === 'edit-trip') { const item=state.trips.find(row=>row.id===target.dataset.id); if (item) tripEditModal(item); }
  if (target.dataset.action === 'delete-trip') { if (confirm('Bu sürüş kaydı silinsin mi?')) { state.trips=state.trips.filter(row=>row.id!==target.dataset.id); closeModal(); persist(); toast('Sürüş kaydı silindi.'); } }
  if (target.dataset.action === 'edit-park') { const item=state.parks.find(row=>row.id===target.dataset.id); if (item) parkEditModal(item); }
  if (target.dataset.action === 'delete-park') { if (confirm('Bu park kaydı silinsin mi?')) { state.parks=state.parks.filter(row=>row.id!==target.dataset.id); closeModal(); persist(); toast('Park kaydı silindi.'); } }
  if (target.dataset.action === 'park-gps') await captureParkGps();
  if (target.dataset.action === 'save-auto-park') saveAutoParkCandidate();
  if (target.dataset.action === 'dismiss-auto-park') dismissAutoParkCandidate();
  if (target.dataset.action === 'accident') { closeModal(); accidentModal(); }
  if (target.dataset.action === 'edit-accident') { const item=state.accidents.find(row=>row.id===target.dataset.id); if (item) accidentModal(item); }
  if (target.dataset.action === 'delete-accident') { state.accidents=state.accidents.filter(row=>row.id!==target.dataset.id); closeModal(); persist(); toast('Kaza tutanağı silindi.'); }
  if (target.dataset.action === 'accident-share') await shareAccident(target.dataset.id);
  if (target.dataset.action === 'accident-export') { const item=state.accidents.find(row=>row.id===target.dataset.id); if(item) { downloadJson(`kaza-tutanagi-${item.id}.json`, item); toast('Kaza tutanağı JSON olarak indirildi.'); } }
  if (target.dataset.action === 'insurance') { closeModal(); insuranceModal(); }
  if (target.dataset.action === 'edit-insurance') { const item=state.insurance.find(row=>row.id===target.dataset.id); if(item) insuranceModal(item); }
  if (target.dataset.action === 'delete-insurance') { state.insurance=state.insurance.filter(row=>row.id!==target.dataset.id); closeModal(); persist(); toast('Sigorta poliçesi silindi.'); }
  if (target.dataset.action === 'maintenance') { closeModal(); maintenanceModal(); }
  if (target.dataset.action === 'edit-maintenance') { const item=state.maintenance.find(row=>row.id===target.dataset.id); if(item) maintenanceModal(item); }
  if (target.dataset.action === 'delete-maintenance') { state.maintenance=state.maintenance.filter(row=>row.id!==target.dataset.id); closeModal(); persist(); toast('Bakım kaydı silindi.'); }
  if (target.dataset.action === 'mark-maintenance') { const item=state.maintenance.find(row=>row.id===target.dataset.id); if(item) { item.completed=true; item.completedAt=displayNow(); save(state); maintenanceModal(); toast('Bakım tamamlandı olarak işaretlendi.'); } }
  if (target.dataset.action === 'maintenance-template') { const input=modalLayer.querySelector('[name="item"]'); if(input) { input.value=target.dataset.item || ''; input.focus(); toast('Bakım kalemi forma aktarıldı.'); } }
  if (target.dataset.action === 'delete-vehicle') {
    state.vehicles = state.vehicles.filter(v => v.id !== target.dataset.id);
    if (state.selectedVehicleId === target.dataset.id) state.selectedVehicleId = null;
    closeModal(); persist(); toast('Araç kaldırıldı.');
  }
  if (target.dataset.action === 'catalog-add') { const profile=vehicleProfileById(target.dataset.profileId || 'manual'); closeModal(); vehicleModal({...profile,profileId:profile.id,plate:'',km:state.settings.mileage||0,favoriteStation:'',fuelLevelPercent:0}); }
  if (target.dataset.action === 'remove-driver') { state.drivers=state.drivers.filter(driver=>driver.id!==target.dataset.id); closeModal(); persist(); toast('Sürücü kaldırıldı.'); }
  if (target.dataset.action === 'open-source') window.open(target.dataset.url, '_blank', 'noopener,noreferrer');
  if (target.dataset.action === 'obd-scan') await scanObd();
  if (target.dataset.action === 'obd-demo') useDemoHealth();
  if (target.dataset.action === 'obd-connect') await useObdDevice(target);
});
document.addEventListener('change', event => { const input=event.target; if (input.matches('[data-location-city]')) { const district=input.form.querySelector('[data-location-district]'); district.innerHTML=locationItems(input.value).map(item=>`<option value="${esc(item.name)}">${esc(item.name)}</option>`).join(''); return; } if (input.matches('[data-vehicle-profile]')) { applyVehicleProfile(input.form, input.value); return; } if (input.matches('[data-refuel-vehicle]')) { const vehicle=state.vehicles.find(item=>item.id===input.value); if (vehicle) { state.selectedVehicleId=vehicle.id; save(state); refuelCalculatorModal(vehicle); } return; } if (!input.matches('[data-setting]')) return; const scope=input.dataset.scope; if(scope==='root' && input.dataset.setting==='gps' && input.checked && state.locationAccess?.status !== 'granted') { input.checked=false; requestLocationAccess(); return; } const value = input.type === 'checkbox' ? input.checked : input.value; if(scope==='root') state[input.dataset.setting]=value; else state.settings[input.dataset.setting]=value; save(state); if(['fontScale','theme'].includes(input.dataset.setting)) render(); toast('Ayar kaydedildi.'); });
document.addEventListener('input', event => { const input=event.target; if (input.matches('[data-catalog-search]')) { const query=input.value.trim().toLocaleLowerCase('tr-TR'); modalLayer.querySelectorAll('[data-catalog-row]').forEach(row => { const haystack=row.dataset.searchText || row.textContent.toLocaleLowerCase('tr-TR'); row.hidden=Boolean(query && !haystack.includes(query)); }); return; } if (input.matches('[data-refuel-slider]')) updateRefuelCalculator(input.value); });
document.addEventListener('submit', async event => {
  const form=event.target.closest('form[data-form]'); if(!form) return; event.preventDefault(); const data=Object.fromEntries(new FormData(form));
  if(form.dataset.form==='vehicle'){ const id=data.id||uid('vehicle'); const old=state.vehicles.find(v=>v.id===id); const vehicle={id,brand:data.brand.trim(),model:data.model.trim(),plate:data.plate.toLocaleUpperCase('tr-TR').trim(),fuel:data.fuel,tank:data.tank === '' ? null : Number(data.tank),km:Number(data.km)||0,favoriteStation:data.favoriteStation||'',profileId:data.profileId || 'manual',fuelLevelPercent:old?.fuelLevelPercent ?? 0}; const existing=state.vehicles.findIndex(v=>v.id===id); if(existing>=0)state.vehicles[existing]=vehicle;else state.vehicles.unshift(vehicle); state.selectedVehicleId=id; state.settings.mileage=vehicle.km; closeModal();persist();toast(existing>=0?'Araç güncellendi.':'Araç eklendi.'); }
  else if(form.dataset.form==='refuel'){ const vehicle=state.vehicles.find(item=>item.id===data.vehicleId) || state.vehicles.find(item=>item.id===state.selectedVehicleId); if(vehicle){ vehicle.fuelLevelPercent=Math.min(100,Math.max(0,Number(data.fuelLevelPercent)||0)); state.selectedVehicleId=vehicle.id; closeModal(); persist(); toast(`Yakıt seviyesi ${vehicle.fuelLevelPercent}% olarak kaydedildi.`); } }
  else if(form.dataset.form==='trip-edit'){const item=state.trips.find(row=>row.id===data.id);if(item){item.title=data.title.trim();item.date=data.date.trim();item.type=data.type;item.km=Math.max(0,Number(data.km)||0);item.duration=data.duration.trim();item.note=data.note.trim();item.updatedAt=displayNow();closeModal();persist();toast('Sürüş kaydı güncellendi.');}}
  else if(form.dataset.form==='park-edit'){const item=state.parks.find(row=>row.id===data.id);if(item){item.title=data.title.trim();item.date=data.date.trim() || item.date;item.note=data.note.trim();if(parkGpsDraft){item.latitude=parkGpsDraft.latitude;item.longitude=parkGpsDraft.longitude;item.accuracy=parkGpsDraft.accuracy ?? null;item.capturedAt=parkGpsDraft.capturedAt || new Date().toISOString();item.source='manual-edit';}parkGpsDraft=null;closeModal();persist();toast(item.latitude != null ? 'Park kaydı ve GPS konumu güncellendi.' : 'Park kaydı güncellendi.');}}
  else if(form.dataset.form==='accident'){const existing=state.accidents.find(item=>item.id===data.id);const photos=await compressImages(form.querySelector('[name="photos"]')?.files);const oldPhotos=existing?.photos || (existing?.photo ? [existing.photo] : []);const mergedPhotos=photos.length ? [...oldPhotos,...photos].slice(-8) : oldPhotos;const item={id:data.id||uid('accident'),title:data.title.trim(),occurredAt:data.occurredAt,locationText:data.locationText.trim(),condition:data.condition,injury:data.injury,official:data.official,plate:data.plate.toLocaleUpperCase('tr-TR').trim(),otherPlate:data.otherPlate.toLocaleUpperCase('tr-TR').trim(),otherDriver:data.otherDriver.trim(),otherPhone:data.otherPhone.trim(),insuranceCompany:data.insuranceCompany.trim(),policyNo:data.policyNo.trim(),note:data.note.trim(),date:existing?.date||displayNow(),gps:accidentGpsDraft||existing?.gps||null,photos:mergedPhotos,photo:mergedPhotos[0]||null};const index=state.accidents.findIndex(row=>row.id===item.id);if(index>=0)state.accidents[index]=item;else state.accidents.unshift(item);accidentGpsDraft=null;closeModal();persist();toast(item.gps?'Kaza tutanağı ve GPS kaydı kaydedildi.':'Kaza tutanağı kaydedildi; GPS alınamadı.',!item.gps);}
  else if(form.dataset.form==='receipt'){const existing=state.receipts.find(item=>item.id===data.id);const draft=pendingReceiptDraft || {};const item={id:data.id||uid('receipt'),stationBrand:data.stationBrand.trim(),stationName:data.stationName.trim(),stationAddress:data.stationAddress.trim(),city:data.city.trim(),district:data.district.trim(),date:data.date || '',time:data.time || '',issuedAt:data.date ? `${data.date}${data.time ? `T${data.time}:00` : ''}` : '',fuel:data.fuel || '',plate:data.plate.toLocaleUpperCase('tr-TR').trim(),liters:data.liters===''?null:Number(data.liters),unitPrice:data.unitPrice===''?null:Number(data.unitPrice),amount:data.amount===''?null:Number(data.amount),vat:data.vat===''?null:Number(data.vat),paymentMethod:data.paymentMethod || '',pumpNo:data.pumpNo.trim(),receiptNo:data.receiptNo.trim(),transactionNo:data.transactionNo.trim(),taxNo:data.taxNo.trim(),issuer:data.issuer.trim(),items:draft.items || existing?.items || [],rawText:data.rawText || draft.rawText || '',ocrPasses:draft.passes || existing?.ocrPasses || 1,capturedAt:existing?.capturedAt || displayNow(),source:existing?.source || 'Android ML Kit OCR'};const index=state.receipts.findIndex(row=>row.id===item.id);if(index>=0)state.receipts[index]=item;else state.receipts.unshift(item);pendingReceiptDraft=null;closeModal();persist();toast(existing?'Fiş kaydı güncellendi.':'Fiş alanları kontrol edilerek kaydedildi.');}
  else if(form.dataset.form==='insurance'){const existing=state.insurance.find(item=>item.id===data.id);const item={id:data.id||uid('insurance'),provider:data.provider.trim(),type:data.type,policyNo:data.policyNo.trim(),expiry:data.expiry,startDate:data.startDate,assistancePhone:data.assistancePhone.trim(),note:data.note.trim(),updatedAt:displayNow()};const index=state.insurance.findIndex(row=>row.id===item.id);if(index>=0)state.insurance[index]=item;else state.insurance.unshift(item);const reminder=item.expiry ? await scheduleCareReminder({title:`${item.type} poliçesi bitişi`,body:`${item.provider} poliçenizin bitiş tarihi geldi.`,at:new Date(`${item.expiry}T09:00:00`),key:item.id}) : null;closeModal();persist();toast(existing?'Sigorta poliçesi güncellendi.':'Sigorta poliçesi kaydedildi.');if(reminder?.ok)toast('Sigorta vade bildirimi Android’de planlandı.');}
  else if(form.dataset.form==='maintenance'){const existing=state.maintenance.find(item=>item.id===data.id);const item={id:data.id||uid('maintenance'),item:data.item.trim(),dueDate:data.dueDate||null,dueKm:data.dueKm===''?null:Number(data.dueKm),cost:data.cost===''?null:Number(data.cost),intervalKm:data.intervalKm===''?null:Number(data.intervalKm),note:data.note.trim(),completed:existing?.completed||false,updatedAt:displayNow()};const index=state.maintenance.findIndex(row=>row.id===item.id);if(index>=0)state.maintenance[index]=item;else state.maintenance.unshift(item);const reminder=item.dueDate ? await scheduleCareReminder({title:`Bakım zamanı: ${item.item}`,body:`Planlanan bakım tarihi geldi. Km ve servis notunu kontrol edin.`,at:new Date(`${item.dueDate}T09:00:00`),key:item.id}) : null;closeModal();persist();toast(existing?'Bakım kaydı güncellendi.':'Bakım planlandı.');if(reminder?.ok)toast('Bakım hatırlatıcısı Android’de planlandı.');}
  else if(form.dataset.form==='hgs'){state.hgs.unshift({id:uid('hgs'),title:data.title.trim(),amount:Number(data.amount)||0,date:displayNow()});closeModal();persist();toast('HGS/OGS geçişi eklendi.');}
  else if(form.dataset.form==='driver'){state.drivers.unshift({id:uid('driver'),name:data.name.trim(),email:data.email.trim(),role:data.role});closeModal();persist();toast('Sürücü yerel listeye eklendi.');}
  else if(form.dataset.form==='trip-note'){if(state.activeTrip){state.activeTrip.note=data.note.trim();save(state);closeModal();render();toast('Sürüş notu kaydedildi.');}else{closeModal();toast('Aktif sürüş bulunamadı.',true);}}
  else if(form.dataset.form==='location'){state.location={city:data.city,district:data.district};priceRecords=[];closeModal();persist();await refreshPrices();toast('Fiyat konumu güncellendi.');}
  else if(form.dataset.form==='mileage'){state.settings.mileage=Number(data.mileage)||0;closeModal();persist();toast('Kilometre güncellendi.');}
});
document.addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('[data-refuel-page-vehicle]')) return;
  const vehicle = state.vehicles.find(item => item.id === input.value);
  if (vehicle) openRefuelView(vehicle);
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-refuel-page-slider]')) updateRefuelPage(event.target.value);
});
document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form="refuel-page"]');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const vehicle = state.vehicles.find(item => item.id === state.selectedVehicleId) || state.vehicles[0];
  if (!vehicle) return;
  vehicle.fuelLevelPercent = Math.min(100, Math.max(0, Number(data.fuelLevelPercent) || 0));
  state.selectedVehicleId = vehicle.id;
  save(state);
  render();
  toast(`Yakıt seviyesi ${vehicle.fuelLevelPercent}% olarak kaydedildi.`);
});

window.addEventListener('offline', () => { render(); toast('İnternet bağlantısı yok. Acil kayıtlar cihazda saklanabilir.', true); });
window.addEventListener('online', () => { render(); toast('İnternet bağlantısı geri geldi.'); });
refreshPrices({ silent:true }).catch(() => render());
render();
refreshFutureFuelAlerts(true);
if(state.activeTrip) { tripClock(); if (state.activeTrip.startPosition) startTripGpsWatch(); }
initializeLocationAccess().catch(error => { rememberLocationResult({ ok:false, status:'unavailable', permission:'unknown', message:error?.message || 'Konum erişimi başlatılamadı.' }); render(); locationAccessModal(); });
