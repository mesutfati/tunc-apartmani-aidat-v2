# Çevrimiçi araç kataloğu araştırması — 2026-10-06

## Sonuç

Mevcut `data/vehicle-catalog.js` 95 profil içeriyor; fakat profillerde `year` alanı yok ve sürüm/trim/motor varyantları eksiksiz bir Türkiye araç veri tabanı değildir. Bu nedenle kullanıcıya "bütün araçlar tam" denmemelidir.

Önerilen mimari: uygulamada küçük bir yerel katalog/fallback, çevrimiçi katalog API’si için sunucu proxy’si ve kaynağı/tarihçesi görünür düzenlenebilir profil. APK güncellemesi gerektirmeden yeni model eklemek, uygulamanın değil sunucu tarafındaki katalog/API verisinin güncellenmesine bağlı olur.

## İncelenen kaynaklar

### CarAPI
URL: https://carapi.app/features/json-api-specs/

CarAPI sayfası 1900’dan günümüze 90.000+ model, 1990’dan günümüze 77.000+ trim, model yılı/make/model/submodel/trim, motor, yakıt türü ve yakıt ekonomisi uç noktaları sunduğunu belirtiyor. Mileage örneğinde `fuel_tank_capacity`, şehir/otoyol/birleşik MPG ve elektrik menzili alanları var. Engine örneğinde engine type, fuel type, motor hacmi, güç, tork, aktarma ve şanzıman alanları var. Kapsamın ABD’de satılan araçlara göre olduğu açıkça yazıyor; bu nedenle Türkiye donanım/trim eşleşmesinde tek başına kesin kaynak kabul edilmemeli. Ücretli Base/Plus/Premium planlarına göre özellikler değişiyor.

### NHTSA vPIC
URL: https://vpic.nhtsa.dot.gov/api/

ABD Ulaştırma Bakanlığı’nın vPIC API’si üretici tarafından gönderilen VIN ve araç verilerini kullanıyor. Marka, model, model yılı, araç türü ve VIN decode uç noktaları var; ayrıca VIN başına ayrıntılı üretici değişkenleri dönebiliyor. Resmi ve yararlı bir VIN doğrulama/fallback kaynağıdır; Türkiye pazarı ve tam yakıt deposu/tüketim/trim kataloğu için tek başına yeterli değildir. API trafik hızı kontrolü uyguluyor.

### Auto.dev Specifications API
URL: https://docs.auto.dev/v2/products/specifications

`GET https://api.auto.dev/specs/{vin}` ile VIN üzerinden motor, yakıt, ölçüler, aktarma, güvenlik ve diğer teknik özellikleri döndürüyor. Doküman örneğinde `fuelTankCapacity`, fuel type, engine size, horsepower, torque, drivetrain ve transmission alanları mevcut. Bearer API anahtarı gerektiriyor; ücretsiz planda Specifications API yok, Growth/Scale planlarında var. VIN ile kullanıcı aracını doğrulama için değerlendirilebilir; serbest marka-model-yıl araması için doğrudan yeterli değildir.

### API Ninjas Cars API
URL: https://api-ninjas.com/api/cars

`/v2/cars` endpointi model, generation, badge, year, fuel, transmission, drive, engine code ve güç filtreleriyle arama sunuyor. Doküman 84.177 araç ve her sonuçta motor, güç, yakıt, şanzıman ve tam teknik özellik sayfası döndüğünü belirtiyor. Aynı model designation altında farklı motor/şanzıman/gövde seçeneklerini ayrı sonuçlar olarak tutuyor. `X-Api-Key` gerektiriyor ve endpoint Premium plan olarak işaretlenmiş. Motosiklet için ayrıca Motorcycles API bağlantısı var. Türkiye’ye özgü resmi donanım doğrulaması ayrıca yapılmalı.

## Uygulama kararı

1. Yerel 95 profil katalog uygulama çevrimdışı açıldığında çalışmaya devam eder.
2. Araç ekleme ekranına yıl, marka, model, gövde, motor hacmi, motor gücü, yakıt türü, şanzıman ve trim seçenekleri eklenir.
3. Önce sunucu proxy’si çevrimiçi katalog sağlayıcısından sonuç arar; API anahtarı APK/web istemcisine konmaz.
4. Sonuçta kaynak adı, son güncelleme zamanı, pazarı/kapsamı ve güven düzeyi gösterilir.
5. Türkiye resmi üretici PDF/web kaynakları olan profiller yüksek güvenli; üçüncü taraf/ABD kapsamlı API profilleri "çevrimiçi teknik veri — Türkiye donanımıyla birebir olmayabilir" etiketiyle gösterilir.
6. Depo/tüketim bilgisi doğrulanmıyorsa değer otomatik yazılmaz; menzil hesabı yalnızca kullanıcı onayı veya güvenilir teknik veri ile açılır.
7. Yeni 2027 modelleri, sunucu katalog sağlayıcısında görünür hale geldiğinde APK güncellemesi olmadan uygulamaya getirilebilir; sağlayıcının Türkiye kapsamına girmeyen model için manuel profil fallback’i kalır.

## Kaynak politikası

Arama motoru sonuçlarından veya rastgele otomotiv sayfalarından otomatik teknik veri çekilmemeli. Üretici teknik tabloları birincil kaynak, yapılandırılmış API’ler yardımcı kaynak olmalı; her alanın kaynağı ve tazelik tarihi saklanmalıdır. Bir modelin farklı motor/yakıt/trim seçenekleri tek satırda birleştirilmemelidir.
