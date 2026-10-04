const nativeNotifications = () => globalThis.Capacitor?.Plugins?.LocalNotifications || null;

function webPermissionMessage(result) {
  if (result === 'granted') return { ok:true, message:'Tarayıcı bildirim izni etkin.' };
  if (result === 'denied') return { ok:false, message:'Bildirim izni kapalı. Tarayıcı/site ayarlarından Yakıt Alarmı bildirimlerini açın.' };
  return { ok:false, message:'Bildirim izni verilmedi.' };
}

export async function requestNotificationPermission() {
  const native = nativeNotifications();
  if (native) {
    try {
      const current = await native.checkPermissions();
      const permission = current.display === 'granted' ? current : await native.requestPermissions();
      if (permission.display === 'granted') {
        await native.createChannel?.({ id:'fuel-alerts', name:'Akaryakıt fiyat alarmları', description:'Doğrulanmış fiyat değişimleri', importance:5, visibility:1, vibration:true });
        return { ok:true, native:true, message:'Android bildirim izni etkin. Doğrulanmış fiyat değişimleri bu kanaldan gösterilecek.' };
      }
      return { ok:false, native:true, message:'Android bildirim izni kapalı. Ayarlar > Uygulamalar > Yakıt Alarmı > Bildirimler bölümünden izin verin.' };
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
      await native.createChannel?.({ id:'fuel-alerts', name:'Akaryakıt fiyat alarmları', description:'Doğrulanmış fiyat değişimleri', importance:5, visibility:1, vibration:true });
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
