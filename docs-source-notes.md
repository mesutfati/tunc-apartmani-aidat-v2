
## APK ve EPDK çalışma notu

- ZIP’in `server.js` yaklaşımındaki GET, form POST ve WSDL SOAP denemeleri `services/early-warning.js` içine taşındı.
- Testte EPDK SOAP 1.1 yanıtı `Sorgu Yetkisi Yok!` döndürdü. Bu, uygulama hatası olarak gizlenmez; erken uyarı ekranında resmi ölçüm yetkisinin bulunmadığı açıkça gösterilir.
- Preview server’ı EPDK resmi ölçümü yoksa seçili yakıt tipini mevcut beşli canlı dağıtıcı ortalamasıyla etiketli fallback olarak sunar. Fallback, resmi EPDK sonucu gibi gösterilmez.
- Capacitor APK’da `/api` sunucusu bulunmadığında erken uyarı modülü doğrudan EPDK/TCMB adapterını ve canlı dağıtıcı fiyat adapterını dener; ağ veya yetki yoksa puan uydurmaz.

## Yakındaki istasyonlar

- İstasyon adı, marka, koordinat ve mesafe bilgisi `services/nearby-stations.js` üzerinden OpenStreetMap Overpass API’den alınır.
- Yalnızca OPET, Shell, Petrol Ofisi, BP, TotalEnergies, MOİL, Aytemiz ve Sunpet gibi tanınan marka adları listelenir; sonuçlar GPS mesafesine göre en yakından uzağa sıralanır.
- İstasyonların şubeye özel pompa fiyatı bu kaynakta güvenilir biçimde bulunmadığı için karttaki fiyat, seçili ilçe için canlı kaynakların doğrulanmış litre ortalaması olarak açıkça etiketlenir; şube fiyatı gibi sunulmaz.
- Yol tarifi, koordinatlı park kaydında Android `geo:` URI’siyle; webde Google Maps arama bağlantısıyla açılır.

## Sürücü güvenliği ve hatırlatıcılar

- İnternet yokken Acil Durum Merkezi, kaza tutanağı, GPS kaydı ve fotoğraflar cihazda localStorage içinde tutulur; paylaşım bağlantısı bağlantı geri geldiğinde kullanılabilir.
- Fiyat ekranı kontrol zamanını güncel/uyarı/eski olarak etiketler; fiyat kaynağının yayın tarihi yoksa tarih uydurulmaz.
- Sigorta poliçesi bitişi ve tarihli bakım kayıtları Android yerel bildirim kanalında planlanır. Kilometre bazlı bakım ayrıca uygulama açıldığında gerçek kilometreyle kontrol edilir.
- Uygulama kapalıyken canlı fiyat değişikliği taraması, ayrı bir sunucu/WorkManager görevi gerektirir; bu paket fiyatı kendiliğinden uydurmaz ve yalnızca canlı yenilemede doğrulanmış alarm üretir.

## Belge tarayıcı ve OCR doğrulama notu (2026-10-05)

- Google ML Kit resmi Android belge tarayıcı dokümanı: https://developers.google.com/ml-kit/vision/doc-scanner/android
- Document Scanner SDK adı: `play-services-mlkit-document-scanner`.
- Belge tarayıcı modelleri, tarama mantığı ve arayüz Google Play Services üzerinden dinamik indirilir; resmi doküman yaklaşık 300 KB uygulama indirme boyutu artışı ve ilk kullanımda indirme beklemesi belirtir.
- API Android API 21+ ve yaklaşık 1.7 GB minimum cihaz RAM gerektirir; desteklenmeyen cihazlarda uygulama standart kamera akışına düşer.
- Uygulama JPEG çıktı, otomatik kenar/perspektif düzeltme ve kaza belgesinde iki sayfaya kadar tarama kullanır; ardından her sayfayı iki OCR geçişiyle işler.
