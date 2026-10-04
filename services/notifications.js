const nativeNotifications = () => globalThis.Capacitor?.Plugins?.LocalNotifications || null;

function webPermissionMessage(result) {
  if (result === 'granted') return { ok:true, message:'Tarayıcı bildirim izni etkin.' };
  if (result === 'denied') return { ok:false, message:'Bildirim izni kapalı. Tarayıcı/site ayarlarından Sürüş Cepte bildirimlerini açın.' };
  return { ok:false, message:'Bildirim izni verilmedi.' };
}

async function createChannel(native, id, name, description) {
  await native.createChannel?.({ id, name, description, importance:5, visibility:1, vibration:true });
}

export async function requestNotificationPermission() {
  const native = nativeNotifications();
  if (native) {
    try {
      const current = await native.checkPermissions();
      const permission = current.display === 'granted' ? current : await native.requestPermissions();
      if (permission.display === 'granted') {
        await createChannel(native, 'fuel-alerts', 'Akaryakıt fiyat alarmları', 'Doğrulanmış fiyat değişimleri');
        await createChannel(native, 'driver-care', 'Araç bakım ve sigorta', 'Vade ve bakım hatırlatıcıları');
        return { ok:true, native:true, message:'Android bildirim izni etkin. Yakıt, bakım ve sigorta uyarıları gösterilecek.' };
      }
      return { ok:false, native:true, message:'Android bildirim izni kapalı. Ayarlar > Uygulamalar > Sürüş Cepte > Bildirimler bölümünden izin verin.' };
    } catch (error) {
      return { ok:false, native:true, message:`Android bildirim izni alınamadı: ${error?.message || 'bilinmeyen hata'}` };
    }
  }
  if (!('Notification' in window)) return { ok:false, message:'Bildirim desteği bu cihazda bulunamadı.' };
  return webPermissionMessage(await Notification.requestPermission());
}

export async function scheduleFuelNotification({ title, body }) {
  const native = nativeNotifications();
  if (native) {
    try {
      const permission = await native.checkPermissions();
      if (permission.display !== 'granted') return { ok:false, native:true, message:'Android bildirim izni verilmedi.' };
      await createChannel(native, 'fuel-alerts', 'Akaryakıt fiyat alarmları', 'Doğrulanmış fiyat değişimleri');
      const id = Math.max(1, Date.now() % 2147483000);
      await native.schedule({ notifications:[{ id, title, body, channelId:'fuel-alerts', schedule:{ at:new Date(Date.now() + 700) } }] });
      return { ok:true, native:true, id };
    } catch (error) {
      return { ok:false, native:true, message:error?.message || 'Yerel bildirim zamanlanamadı.' };
    }
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
    return { ok:true, native:false };
  }
  return { ok:false, native:false, message:'Bildirim izni verilmedi.' };
}

export async function scheduleCareReminder({ title, body, at, key = 'care' }) {
  const when = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(when.getTime()) || when <= new Date()) return { ok:false, skipped:true, message:'Vade tarihi geçmiş veya geçersiz.' };
  const native = nativeNotifications();
  if (!native) return { ok:false, native:false, skipped:true, message:'Gelecek tarih bildirimi yalnızca Android APK’da çalışır.' };
  try {
    const permission = await native.checkPermissions();
    if (permission.display !== 'granted') return { ok:false, native:true, message:'Bildirim izni verilmedi.' };
    await createChannel(native, 'driver-care', 'Araç bakım ve sigorta', 'Vade ve bakım hatırlatıcıları');
    const seed = [...String(key)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const id = Math.max(1, (Date.now() + seed) % 2147483000);
    await native.schedule({ notifications:[{ id, title, body, channelId:'driver-care', schedule:{ at:when } }] });
    return { ok:true, native:true, id };
  } catch (error) {
    return { ok:false, native:true, message:error?.message || 'Bakım bildirimi zamanlanamadı.' };
  }
}
