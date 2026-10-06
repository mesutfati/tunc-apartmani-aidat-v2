# Araç bilgi ve bakım kaynakları — 2026-10-06

## Uygulama kaynak politikası

Sürüş Cepte teknik depo, tüketim, motor ve trim alanlarını mümkün olduğunda üretici teknik tablolarından alır. Bakım/onarım ipuçları teknik veri yerine geçmez; güvenlik-kritik işlemde araç kullanım kılavuzu ve yetkili/uzman servis önceliklidir. Dış sitelerin yazıları uygulamaya kopyalanmaz; kullanıcıya kaynak bağlantısı ve kısa, özgün özet gösterilir.

## Kullanılan/önerilen kaynaklar

- **Toyota Türkiye teknik tabloları:** Seçili Toyota profillerinin depo, tüketim, motor ve güç alanları için birincil kaynak.
  - https://www.toyota.com.tr/araba-modelleri/corolla-sedan/ozellikler
  - https://www.toyota.com.tr/content/dam/toyota/nmsc/turkey/cars/e-brosur/corolla/Corolla-Teknik-ve-Donanim-Ozellikleri-01-2026.pdf
- **NHTSA vPIC:** Ücretsiz ve resmi çevrimiçi model/yıl/marka keşfi ve ileride VIN doğrulama fallback'i. Türkiye donanım, depo ve tüketim verisi için tek başına kesin kaynak değildir.
  - https://vpic.nhtsa.dot.gov/api/
- **iFixit Otomobil ve Kamyonet:** Model/nesil bazlı topluluk onarım kılavuzları ve soru-cevap içerikleri. Uygulama yalnızca dış bağlantı/keşif bağlantısı verir; üretici onayı gibi sunmaz.
  - https://tr.ifixit.com/Device/Car_and_Truck
- **Avis Türkiye Araç Bakım İpuçları:** MAF, klima, hararet, DSG, antifriz, akü, egzoz ve genel bakım başlıkları. Genel öneri kaynağıdır; modelin resmi bakım aralığı yerine geçmez.
  - https://www.avis.com.tr/arac-bakim-ipuclari
- **Michelin Türkiye:** Periyodik bakım, motor yağı, fren, akü, lastik basıncı ve 1,6 mm yasal diş derinliği gibi temel güvenlik/bakım konuları. Lastik üreticisi perspektifi olarak gösterilir.
  - https://www.michelin.com.tr/blog/articles/yeni-suruculer-icin-temel-arac-bakimi-ve-kontrolleri
- **Bosch Car Service Türkiye:** Profesyonel servis/onarım ve arıza değerlendirmesi için destek kaynağı olarak kullanılabilir; kritik arızalarda kullanıcıyı servise yönlendirme amacı taşır.
  - https://www.boschcarservice.com/tr/tr/blog/diger-hizmetler/arac-tamir/

## Ürün kararı

- Araç profili seçildiğinde model görseli teknik veriden ayrı bir katman olarak yüklenir. Görsel çevrimiçi Wikimedia Commons aramasından gelebilir; görsel bulunamazsa marka/model temsili fallback gösterilir.
- Görsel teknik kanıt değildir; görsel açıklaması ve kaynak bağlantısı görünür tutulur.
- Çevrimiçi katalog araması NHTSA vPIC ile model/yıl keşfeder. Motor, yakıt, depo ve tüketim alanı sonuçta bulunmuyorsa otomatik değer uydurulmaz; kullanıcıdan tamamlaması istenir.
- Bir model/yıl/motor/trim kaydı Türkiye pazarı için doğrulanmadıkça "resmi Türkiye verisi" etiketi kullanılmaz.
