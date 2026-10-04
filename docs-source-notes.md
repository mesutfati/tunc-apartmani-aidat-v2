# Kaynak notları

## Güncel akaryakıt fiyatı

Uygulamadaki güncel fiyat kartları tek bir ticari sitenin rakamını kesin gerçek gibi kopyalamaz. Sunucu tarafındaki `services/fuel-prices.js` aynı il/ilçe ve yakıt tipi için erişilebilen birinci taraf dağıtıcı sayfalarını okur:

- **EPDK resmi akaryakıt fiyatları:** https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat
  - Resmi otorite ve bayi fiyatı referansıdır. Uygulamada doğrulama kaynağı olarak ayrıca gösterilir.
- **Petrol Ofisi:** https://www.petrolofisi.com.tr/akaryakit-fiyatlari
  - İl/bölge bazlı KDV dahil pompa fiyatı tablosu.
- **Aytemiz:** https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari
  - İlçe bazlı tarih damgalı benzin/motorin tablosu; LPG için Aytemiz LPG sayfası kullanılır.
- **Sunpet:** https://www.sunpettr.com.tr/yakit-fiyatlari
  - İstanbul Anadolu ve Avrupa ilçe tablolarından benzin/motorin verisi okunur.
- **Opet:** https://www.opet.com.tr/akaryakit-fiyatlari
  - Resmi fiyat sayfası kaynak kataloğunda bulunur; dinamik API erişimi açıldığında ortalamaya eklenmeye hazırdır.

Erişilebilen kaynakların rakamları **basit aritmetik ortalama** olarak hesaplanır. En az iki kaynak aynı il/ilçe için okunabiliyorsa kartta “kaynak ortalaması” etiketi gösterilir. Yalnızca tek kaynak okunursa bu açıkça “tek kaynak” olarak yazılır; hiçbir kaynak yoksa `—` gösterilir. Sabit demo fiyatı, eski fiyat veya tahmin kullanılmaz.

## Gelecekteki zam/indirim duyuruları

Güncel fiyat tablosu ile “zam gelecek” bilgisi ayrı tutulur. Önceden duyuru için uygulamada şu sayfalar kaynak kataloğu olarak takip edilir:

- **PÜİS duyuruları:** https://www.puis.org.tr/tum-haberler — sektör açıklaması ve erken sinyal olabilir; kesin fiyat değildir.
- **EPDK duyuruları ve fiyat sayfası:** https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat — resmi kurum kararı ve bayi fiyatı referansı.
- **Resmî Gazete:** https://www.resmigazete.gov.tr/ — yürürlüğe giren vergi ve düzenleme kararlarının hukuki kaydı.
- **Ekonomi basını:** https://www.ekonomim.com/ekonomi/akaryakit — yalnızca ikincil doğrulama; tek başına bildirim üretmez.

### Bildirim politikası

- PÜİS veya ekonomi basınında görülen “beklenti” içerikleri kesin zam gibi sunulmaz; ürün, tutar ve yürürlük tarihi açıkça yazıyorsa **Beklenti** etiketiyle gösterilir. EPGİS'in fiyat duyurusu faaliyetlerine 2022'de ara verdiği bilgisi doğrulandığından aktif kaynak listesine dahil edilmez.
- EPDK veya Resmî Gazete tarafından doğrulanmayan bir haber “kesinleşti” şeklinde bildirilmez.
- Güncel fiyat değişikliği bildirimi yalnızca aynı ürün/il için iki ayrı canlı dağıtıcı kaynağında ortalama değişimi görüldüğünde oluşturulur.
- Kaynak erişilemezse uygulama rakam uydurmaz ve bildirim üretmez.
- Her kartta sağlayıcının yayınladığı tarih ayrı, uygulamanın yaptığı son kontrol zamanı ayrı gösterilir; sağlayıcı tarih yayınlamıyorsa bu alan açıkça belirtilir.
- APK sürümünde kullanıcı Fiyatlar ekranındaki **Yenile** düğmesine bastığında kontrol yapılır. Arka planda sürekli web taraması ve ileri tarihli zam tahmini bu ilk teslimde yapılmaz; bu sınır arayüzde de açıklanır.

## OBD-II

- **OBD-II PID tablosu / SAE J1979 dönüşümleri:** https://www.csselectronics.com/pages/obd2-pid-table-on-board-diagnostics-j1979
  - Motor suyu PID 05, yakıt düzeltmeleri PID 06/07, devir PID 0C, hız PID 0D, gaz kelebeği PID 11, yakıt seviyesi PID 2F ve voltaj PID 42 dönüşümleri için referans alınır.
- **Capacitor Bluetooth LE:** https://github.com/capacitor-community/bluetooth-le
- **Bluetooth Classic Serial:** https://github.com/e-is/capacitor-bluetooth-serial

## OCR

- **Capacitor Community Image To Text:** https://github.com/capacitor-community/image-to-text
  - Android’de cihaz içi ML Kit, kamera ile alınan yerel dosyayı metne dönüştürür.
