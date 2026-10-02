export async function requestNotificationPermission() {
  if (!('Notification' in window)) return { ok:false, message:'Bildirim desteği bu cihazda bulunamadı.' };
  const result = await Notification.requestPermission();
  return { ok:result === 'granted', message:result === 'granted' ? 'Bildirim izni etkin.' : 'Bildirim izni verilmedi.' };
}
// Capacitor Local Notifications entegrasyonu sonraki aşamada bu adaptera eklenecek.
