function nativeGeolocation() { return globalThis.Capacitor?.Plugins?.Geolocation || null; }

function permissionStatus(value) {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  return 'prompt';
}

export async function checkLocationPermission() {
  const native = nativeGeolocation();
  if (native) {
    try {
      const permission = await native.checkPermissions();
      const status = permissionStatus(permission.location);
      return { ok:status === 'granted', permission:status, status, serviceEnabled:null, native:true };
    } catch (error) {
      return { ok:false, permission:'unknown', status:'unavailable', serviceEnabled:null, native:true, message:error?.message || 'Android konum izni durumu okunamadı.' };
    }
  }
  if (!navigator.geolocation) return { ok:false, permission:'unsupported', status:'unavailable', serviceEnabled:false, native:false, message:'Bu tarayıcı konum servisini desteklemiyor.' };
  try {
    const permission = await navigator.permissions?.query?.({ name:'geolocation' });
    const status = permissionStatus(permission?.state);
    return { ok:status === 'granted', permission:status, status, serviceEnabled:null, native:false };
  } catch {
    return { ok:false, permission:'prompt', status:'prompt', serviceEnabled:null, native:false };
  }
}

export async function requestCurrentPosition() {
  const native = nativeGeolocation();
  if (native) {
    let permission;
    try {
      permission = await native.checkPermissions();
      if (permission.location !== 'granted') permission = await native.requestPermissions();
      const status = permissionStatus(permission.location);
      if (status !== 'granted') return { ok:false, permission:status, status:'denied', serviceEnabled:null, message:'Android konum izni kapalı. Ayarlar > Uygulamalar > Sürüş Cepte > İzinler > Konum yolundan izin verin.' };
      const result = await native.getCurrentPosition({ enableHighAccuracy:true, timeout:12000, maximumAge:0 });
      return { ok:true, permission:'granted', status:'granted', serviceEnabled:true, latitude:result.coords.latitude, longitude:result.coords.longitude, accuracy:result.coords.accuracy ?? null, capturedAt:new Date(result.timestamp || Date.now()).toISOString() };
    } catch (error) {
      return { ok:false, permission:permissionStatus(permission?.location), status:'service-off', serviceEnabled:false, message:'İzin verilmiş olsa da cihaz konum servisi kapalı veya konum alınamadı. Android Ayarları > Konum bölümünü açın.', error:error?.message || String(error) };
    }
  }
  if (!navigator.geolocation) return { ok:false, permission:'unsupported', status:'unavailable', serviceEnabled:false, message:'Bu tarayıcı konum servisini desteklemiyor.' };
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    p => resolve({ ok:true, permission:'granted', status:'granted', serviceEnabled:true, latitude:p.coords.latitude, longitude:p.coords.longitude, accuracy:p.coords.accuracy ?? null, capturedAt:new Date(p.timestamp || Date.now()).toISOString() }),
    error => resolve({ ok:false, permission:error?.code === 1 ? 'denied' : 'granted', status:error?.code === 1 ? 'denied' : 'service-off', serviceEnabled:false, message:error?.code === 1 ? 'Konum izni verilmedi.' : 'Konum izni verilmiş olsa da cihaz konum servisi kapalı veya konum alınamadı.' }),
    { enableHighAccuracy:true, timeout:12000, maximumAge:0 }
  ));
}

// Android güvenlik modeli nedeniyle konum servisi gizlice ve sürekli açılamaz.
// Uygulama ilk açılışta izin ister; sürüş/acil/park/istasyon akışlarında ön planda tekrar ölçüm yapar.
