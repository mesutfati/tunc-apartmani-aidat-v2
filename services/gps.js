export async function requestCurrentPosition() {
  if (!navigator.geolocation) return { ok:false, message:'Bu tarayıcı konum servisini desteklemiyor.' };
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    p => resolve({ ok:true, latitude:p.coords.latitude, longitude:p.coords.longitude }),
    () => resolve({ ok:false, message:'Konum izni verilmedi; demo konumu kullanılacak.' }),
    { enableHighAccuracy:false, timeout:5000, maximumAge:60000 }
  ));
}
// Capacitor background geolocation plugin entegrasyonu sonraki aşamada burada yapılacak.
