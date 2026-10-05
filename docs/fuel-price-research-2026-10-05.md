# Yakıt fiyatı doğrulama araştırması — 5 Ekim 2026

## Sonuç

Uygulamadaki yüksek değerlerin ana nedeni tek bir rakamın yanlış çevrilmesi değil, farklı kapsam ve tarihlerdeki ticari kaynakların aynı basit ortalamaya karıştırılmasıydı. Özellikle LPG’de Lukoil’in istek URL’sinde `priceDate=2026-10-05` bulunmasına rağmen sayfanın kendi **Fiyat Tarihi** alanı `02.10.2026` dönüyordu. Bu kaynak İstanbul LPG için 42,44 TL/L verdi; aynı yenilemede Petrol Ofisi 40,60 TL/L ve Aytemiz 41,02 TL/L verdi. Eski tarihli Lukoil değeri artık güncel ortalamaya dahil edilmiyor; aynı örnekte gösterilen ortalama 40,81 TL/L oldu.

Buna ek olarak, bazı dağıtıcı sayfaları seçilen ilin ilçelerini listelerken bazıları il/bölge özeti yayınlıyor. İstanbul Anadolu ve İstanbul Avrupa ayrı kapsamlar. Bir dağıtıcıda tam ilçe satırı bulunamadığında ülke geneli veya başka bölge satırlarının ortalamasını ilçe fiyatı gibi kullanmak güvenilir değildi. Bu nedenle İstanbul’da kapsam eşleşmesi zorunlu hale getirildi. İstanbul dışındaki illerde ise yalnızca seçilen ile ait resmi şehir sayfasının ilçe satırları üzerinden kontrollü şehir ortalaması kullanılabiliyor.

## Kaynakların niteliği

EPDK resmi otorite ve referans kaynağıdır. Resmi Pompa Fiyatları ekranı bayi otomasyonundan gelen fiili fiyatlara en yakın katmandır; il/marka bültenleri ise il, bölge veya dağıtıcı beyanı niteliğindedir. EPDK seçimsiz GET yanıtı tek başına fiyat döndürmüyor; JSF oturumu, ViewState, cookie ve POST sorgusu gerekiyor. SOAP WSDL erişilebilir olsa da canlı SOAP binding her zaman çalışmıyor. Bu nedenle başarısız EPDK servisi fiyat gibi kullanılmıyor.

Petrol Ofisi’nin resmi HTML tablosunda KDV dahil ve KDV hariç değerler ayrı span sınıflarıyla veriliyor. Uygulama yalnızca KDV dahil değerleri okumalı. Kaynak sayfada görünür fiyat tarihi yoksa tarih uydurulmamalı.

Aytemiz benzin ve motorin sayfaları il/ilçe tablosu ve güncelleme zamanı veriyor. LPG sayfasında `Oto LPG` il/bölge tablosu bulunuyor, ancak bazı sayfalarda güncelleme tarihi `-` ve dipnot tarih içermiyor. Bu durumda kontrol zamanı gösteriliyor, kaynak tarihi icat edilmiyor.

Sunpet ve M Oil resmi HTML tablolarında ilçe düzeyinde bölgesel değerler sunuyor. Sunpet’te responsive masaüstü/mobil tablolarının tekrarlı olabilmesi, M Oil’de şehir kimliklerinin opak olması nedeniyle başlık ve seçilen il doğrulaması gerekiyor. M Oil sayfasında LPG sütunu yok; Gazyağı LPG olarak yorumlanmıyor.

Lukoil resmi sayfasında pompa ve LPG görünümleri ayrı. Pompa tablosu ilçe düzeyinde, LPG tablosu şehir/bölge düzeyinde. Ürün birimleri ve tarih sayfadaki başlıklardan alınmalı. 5 Ekim URL’sine rağmen LPG sayfasında 2 Ekim fiyat tarihi görülmesi, URL parametresine güvenilmemesi gerektiğini gösterdi.

Opet’in HTML’i fiyat tablosu değil React kabuğu döndürüyor. İncelenen canlı API erişimi başarısız ve arayüzde doğrulanamayan eski bir fallback tarihi bulunuyor. Opet bu sürümde ortalamaya dahil edilmiyor.

## Uygulanan düzeltmeler

- Kaynak tarihleri sayfanın kendi `Fiyat Tarihi`, `Son Güncelleme` veya tarihli dipnot alanından okunuyor.
- Aytemiz ve Lukoil için seçilen ürünün ilgili sayfası kullanılıyor; LPG isteğinde benzin sayfasının tarihi artık kullanılmıyor.
- Kaynak tarihleri arasında en güncel doğrulanabilir gün seçiliyor. Daha eski tarihli sağlayıcı değerleri ortalamaya alınmıyor.
- Dışlanan sağlayıcı adı ve nedeni fiyat ekranının meta bilgisinde gösteriliyor.
- Sağlayıcının seçilen il/ilçe/bölge satırı bulunmuyorsa İstanbul’da geniş kapsamlı il ortalaması ilçe fiyatı olarak kullanılmıyor.
- İstanbul Anadolu ve İstanbul Avrupa ayrımı korunuyor.
- İstanbul dışındaki illerde, sağlayıcının seçilen şehre ait ilçe tablosu varsa bu tablonun kontrollü şehir ortalaması kullanılabiliyor.
- Kaynakta ilgili ürün yoksa (örneğin Sunpet veya M Oil LPG) bu kaynak artık fiyat ortalamasına katkı vermiyor.
- Kaynaklar modalı, kaynağın güncel ortalamaya katkı verdiğini, kapsam dışında kaldığını veya eski tarihli olduğu için dışlandığını ayrı gösteriyor.
- Fiyat kartı açıklaması, ortalamanın yalnızca aynı ürün, uyumlu kapsam ve uyumlu tarih koşullarını sağlayan kaynaklardan oluştuğunu belirtiyor.

## Doğrulama

Canlı regresyon kontrollerinde benzin, motorin ve LPG için İstanbul, Ankara, İzmir ve Bursa sorguları çalıştırıldı. Değerler beklenen yakıt aralıklarında kaldı. İstanbul LPG’de Lukoil 2 Ekim kaydı dışlandı ve iki güncel/uyumlu kaynakla 40,81 TL/L gösterildi. İstanbul benzin ve motorin ile Ankara, İzmir ve Bursa testlerinde şehir/ilçe kapsamı korunarak birden fazla kaynak kullanıldı.

## Kaynaklar

[1]: https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat "EPDK resmi akaryakıt fiyatları"
[2]: https://lisans.epdk.gov.tr/epvys-web/faces/pages/lisans/petrolBayilik/pompaFiyatlariOzetSorgula.xhtml "EPDK Pompa Fiyatları ekranı"
[3]: https://bildirim.epdk.gov.tr/bildirim-portal/faces/pages/tarife/petrol/illereGorePetrolAkaryakitFiyatSorgula.xhtml "EPDK petrol il raporu"
[4]: https://bildirim.epdk.gov.tr/bildirim-portal/faces/pages/tarife/lpg/illereGoreLPGFiyatSorgula.xhtml "EPDK LPG il ve firma raporu"
[5]: https://www.petrolofisi.com.tr/akaryakit-fiyatlari "Petrol Ofisi resmi akaryakıt fiyatları"
[6]: https://www.petrolofisi.com.tr/akaryakit-fiyatlari/akaryakit-ve-lpg-otogaz-fiyatlandirma-politikamiz "Petrol Ofisi fiyatlandırma politikası"
[7]: https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari "Aytemiz resmi benzin fiyatları"
[8]: https://www.aytemiz.com.tr/akaryakit-fiyatlari/lpg-fiyatlari "Aytemiz resmi LPG fiyatları"
[9]: https://www.sunpettr.com.tr/yakit-fiyatlari "Sunpet resmi yakıt fiyatları"
[10]: https://moil.com.tr/akaryakit-fiyatlari "M Oil resmi güncel pompa fiyatları"
[11]: https://www.lukoil.com.tr/akaryakit-fiyatlari "Lukoil resmi pompa ve LPG fiyatları"
[12]: https://www.opet.com.tr/akaryakit-fiyatlari "Opet resmi akaryakıt fiyatları"


## Ek güvenlik politikası

- Birden fazla kaynak aynı doğrulanabilir tarihe sahipse yalnızca o tarihteki değerler “tarih uyumlu canlı kaynak ortalaması” olarak etiketlenir ve fiyat değişimi alarmı üretilebilir.
- Kaynak tarihleri doğrulanamıyorsa fiyat tamamen gizlenmez; ancak kartta “canlı kaynaklar okundu; tarih uyumu doğrulanmadı” gösterilir ve doğrulanmış alarm üretilmez.
- Tek eski tarihli kaynak, tarihsiz diğer tabloların güncel sonucu gibi kullanılmaz. Örneğin Lukoil LPG sayfasının 02.10.2026 kaydı, 05.10.2026 kontrolünde Petrol Ofisi ve Aytemiz tablolarına karıştırılmamıştır.

## Konum erişimi davranışı

Android, konum servisini uygulamanın gizlice açmasına veya kullanıcıdan habersiz sürekli koordinat almasına izin vermez. Uygulama ilk girişte gerçek Capacitor Geolocation iznini ister. İzin verilmezse ana ekranda konumun neden gerekli olduğu ve Android ayar yolu görünür; “Konumu aç / tekrar dene” düğmesi sistem izin isteğini yeniden başlatır. Cihazın genel Konum anahtarı kapalıysa ayrıca Ayarlar > Konum uyarısı verilir. İstasyon, park, kaza/acil durum ve ön plan sürüş akışları ihtiyaç olduğunda yeniden ölçüm yapar; gizli arka plan takip iddiası yoktur.


## NSoft API entegrasyonu (5 Ekim 2026)

İncelenen `Yakıt Alarmı 4.1.38` APK’sının kullandığı canlı fiyat endpointi doğrulandı: `https://api.nsoft.com.tr/fuel/prices?city=<01-81 plaka kodu>`. API yanıtında `price_date`, `generated_at`, ilçe listesi ve `bp_kursunsuz`, `bp_diesel`, `otogaz` gibi ürün alanları bulunuyor. Sürüş Cepte’ye bu kaynak `NSoft Yakıt Alarmı API` adıyla ayrı sağlayıcı olarak eklendi; NSoft değeri artık aynı ürün, il/ilçe kapsamı ve tarih uyumu kurallarından geçerek diğer kaynaklarla ortalamaya katılabiliyor.

NSoft, birinci taraf dağıtıcı kaynağı olarak etiketlenmiyor; APK’de kullanılan toplu veri sağlayıcısı olarak kaynaklar ekranında ayrı gösteriliyor. NSoft’un API anahtarı kaynak depoya yazılmadı. Web sunucusunda `NSOFT_FUEL_API_KEY` ortam değişkeninden, native APK derlemesinde ise yalnızca build çıktısındaki `www/runtime-config.js` dosyasına build zamanı aktarılıyor. Anahtar yoksa NSoft sağlayıcısı sessizce sahte değer üretmiyor; kaynaklar ekranında yapılandırılmadı hatası gösteriliyor ve mevcut diğer sağlayıcılar çalışmaya devam ediyor.

İlk canlı entegrasyon testi İstanbul benzin, Ankara motorin ve İzmir LPG için başarılı oldu. Örnek olarak İstanbul Kadıköy’de NSoft, Aytemiz, Sunpet ve Lukoil aynı tarihli canlı katkı verdi; Petrol Ofisi daha eski tarihli olduğu için ortalamaya alınmadı. İzmir LPG’de kaynak tarihi güncel kalan tek kaynak NSoft olduğu için uygulama tek kaynak uyarısını korudu ve doğrulanmış ortalama iddiası yapmadı.
