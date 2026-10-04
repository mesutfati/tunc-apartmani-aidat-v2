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

## Resmi fiyat otoritesi ve ek kaynaklar

- **EPDK Akaryakıt Fiyatları:** https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat
  - EPDK aynı sayfada fiili pompa fiyatlarını, bayi tavan/tavsiye fiyatlarını, illere göre bayi fiyat raporunu ve petrol/LPG web servislerini listeler. EPDK sayfası, pompa fiyatlarının Bayi Otomasyon Sisteminden gelen fiili fiyatlar olduğunu; tavan/tavsiye raporlarının ise dağıtıcı bildirimlerine dayandığını açıkça ayırır.
  - Açık XML servisinin WSDL’i: http://lisansws.epdk.gov.tr/services/bildirimPetrolAkaryakitFiyatlari?wsdl . Servis sorgu yetkisi istediği için uygulamanın ticari kaynakları tamamen EPDK verisiymiş gibi göstermemesi gerekir; EPDK uygulamada resmi otorite ve doğrulama referansı olarak gösterilir.
- **EPDK Petrol ve LPG Piyasası Fiyatlandırma Raporu:** https://www.epdk.gov.tr/Detay/DownloadDocument?id=Y209o1bexzA=
  - Rapor, benzin/motorin için CIF MED ürün fiyatı ve TCMB gösterge kuru ile hesaplanan ürün fiyatını; dağıtıcı/bayi marjlarını ve Hazine ve Maliye Bakanlığı tarafından belirlenen ÖTV/KDV’yi ayrı bileşenler olarak açıklar. LPG için Sonatrach propan/bütan referansı ayrıca belirtilir.
- **Serbest fiyatlandırma açıklaması:** https://www.opet.com.tr/akaryakit-fiyatlari-nasil-olusur
  - 1 Ocak 2005’ten beri serbest fiyatlandırma uygulanır. Dağıtıcı depo/tavsiye fiyatını, bayi ise rekabet ve bölgesel maliyetlere göre pompa fiyatını belirler. Bu nedenle Türkiye’de normal koşullarda bütün istasyonların tek bir fiyatını belirleyen tek kurum yoktur; EPDK düzenler, izler ve raporlar.
- **M Oil canlı pompa fiyatları:** https://moil.com.tr/akaryakit-fiyatlari
  - İlçe tablosu ve sayfa üzerinde fiyat tarihi bulunur; il seçiminde tüm iller listelenir.
- **Lukoil Türkiye canlı pompa fiyatları:** https://www.lukoil.com.tr/akaryakit-fiyatlari
  - İlçe tablosu, KDV dahil fiyat tarihi ve il seçimi bulunur.
- **İl merkezi koordinatları:** https://gist.githubusercontent.com/abdullahoguk/ee03c26a23dca6eda9c480b4967e77b6/raw/il.json
  - Çevre il fallback’i için yalnızca yaklaşık mesafe sıralaması üretmek üzere kullanılır; çevre il fiyatı seçili ilin kesin istasyon fiyatı olarak sunulmaz.

## Gönderilen erken uyarı ZIP’i

`akaryakit-erken-uyari-tum-iller.zip` içindeki model uygulamaya bağımlılıksız `services/early-warning.js` olarak aktarıldı. ZIP’teki 81 il trafik kodları `data/early-warning-provinces.json` ve `data/province-codes.js` içinde korunur.

- **EPDK il bazlı akaryakıt servisi:** `sorguNo=72` ve il trafik kodu ile çağrılır.
- **EPDK LPG servisi:** Aynı il kodu üzerinden ayrı ölçüm olarak çağrılır.
- **TCMB günlük kur XML’i:** USD satış değeri için kullanılır.
- **Risk formülü:** ZIP’teki yaklaşım korunur: pozitif USD değişimi %55, pozitif yakıt değişimi %45 ağırlıkla birleştirilir; en az iki tarihli ölçüm yoksa `VERİ YOK` gösterilir.
- **Güvenlik sınırı:** Bu skor kesin zam tahmini değildir. EPDK servisi erişilemezse uygulama puan veya fiyat uydurmaz; hata ve son kontrol zamanı kullanıcıya gösterilir. Mevcut pompa fiyat kartları ise ayrı çoklu dağıtıcı adapterından beslenir.

## Android bildirim izni

- **Android resmi bildirim izni:** https://developer.android.com/develop/ui/views/notifications/notification-permission
  - Android 13 (API 33)+ için `POST_NOTIFICATIONS` manifest bildirimi ve kullanıcı etkileşimiyle runtime izin isteği gerekir. Yeni kurulumda izin verilene kadar bildirimler kapalıdır.
- **Capacitor Local Notifications:** https://capacitorjs.com/docs/apis/local-notifications
  - Android’de `checkPermissions()` ve `requestPermissions()` çağrıları gerekir; yerel bildirimler `schedule()` ile oluşturulur. Uygulama artık web Notification API’si yoksa native Capacitor adapterını kullanır.
