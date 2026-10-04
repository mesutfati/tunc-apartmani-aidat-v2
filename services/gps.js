function nativeGeolocation() { return globalThis.Capacitor?.Plugins?.Geolocation || null; }

export async function requestCurrentPosition() {
  const native = nativeGeolocation();
  if (native) {
    try {
      const permission = await native.checkPermissions();
      if (permission.location !== 'granted') {
        const requested = await native.requestPermissions();
        if (requested.location !== 'granted') return { ok:false, message:'Android konum izni kapalı. Ayarlar > Uygulamalar > Sürüş Cepte > İzinler > Konum yolundan izin verin.' };
      }
      const result = await native.getCurrentPosition({ enableHighAccuracy:true, timeout:12000, maximumAge:0 });
      return { ok:true, latitude:result.coords.latitude, longitude:result.coords.longitude, accuracy:result.coords.accuracy ?? null, capturedAt:new Date(result.timestamp || Date.now()).toISOString() };
    } catch (error) {
      return { ok:false, message:'Cihaz konum servisi kapalı veya konum alınamadı. Android Ayarları > Konum bölümünü açın.', error:error?.message || String(error) };
    }
  }
  if (!navigator.geolocation) return { ok:false, message:'Bu tarayıcı konum servisini desteklemiyor.' };
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    p => resolve({ ok:true, latitude:p.coords.latitude, longitude:p.coords.longitude, accuracy:p.coords.accuracy ?? null, capturedAt:new Date(p.timestamp || Date.now()).toISOString() }),
    () => resolve({ ok:false, message:'Konum izni verilmedi veya cihaz konum servisi kapalı; koordinat kaydedilmedi.' }),
    { enableHighAccuracy:true, timeout:12000, maximumAge:0 }
  ));
}
// Gerçek arka plan GPS izleme/foreground service entegrasyonu sonraki native aşamada yapılacak.
