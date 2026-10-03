# Kaynak notları

## Akaryakıt

- **EPDK resmi akaryakıt fiyatları:** https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat
  - EPDK sayfası pompa fiyatlarını bayi otomasyon sisteminden gelen fiili fiyatlar olarak tanımlar.
  - İllere göre bayi fiyatları raporu ve resmi XML web servisi bağlantısını yayınlar.
  - Uygulamadaki `services/fuel-prices.js` EPDK’yi birincil otorite/geri dönüş kaynağı olarak gösterir.
- **Petrol Ofisi canlı il fiyatları:** https://www.petrolofisi.com.tr/akaryakit-fiyatlari
  - Tarihli ve il bazlı benzin, motorin ve otogaz pompa fiyatlarını yayımlar.
  - Uygulama canlı erişim mümkün olduğunda bu sayfadan il referansını okur; ilçe satırlarında il referansı açıkça belirtilir.

Bildirim politikası: Uygulama haber sitelerinden veya sosyal medya tahminlerinden “yarın zam gelecek” bildirimi üretmez. Yalnızca aynı yakıt ve il için iki ayrı canlı kaynak okumasında fiyat farkı doğrulanırsa “fiyat artışı/düşüşü doğrulandı” bildirimi oluşturur. Canlı kaynak erişilemezse fiyat yerine `—` gösterilir ve bildirim üretilmez.

## OBD-II

- **OBD-II PID tablosu / SAE J1979 dönüşümleri:** https://www.csselectronics.com/pages/obd2-pid-table-on-board-diagnostics-j1979
  - Motor suyu PID 05, yakıt düzeltmeleri PID 06/07, devir PID 0C, hız PID 0D, gaz kelebeği PID 11, yakıt seviyesi PID 2F ve voltaj PID 42 dönüşümleri için referans alınır.
- **Capacitor Bluetooth LE:** https://github.com/capacitor-community/bluetooth-le
- **Bluetooth Classic Serial:** https://github.com/e-is/capacitor-bluetooth-serial

## OCR

- **Capacitor Community Image To Text:** https://github.com/capacitor-community/image-to-text
  - Android’de cihaz içi ML Kit, kamera ile alınan yerel dosyayı metne dönüştürür.
  - Plugin Android tarafında Google/Firebase yapılandırması isteyebilir; APK öncesi derleme kontrolünde ayrıca doğrulanacaktır.
