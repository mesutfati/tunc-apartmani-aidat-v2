# Sürüş Cepte — geliştirme yol haritası ve OBD fikirleri

## Bu iterasyonda uygulananlar

- **Geçmiş sürüşler:** Kayıt başlığı, tarih, tür, mesafe, süre ve not düzenlenebilir; kayıt silinebilir.
- **Geçmiş parklar:** Başlık, tarih ve not düzenlenebilir; GPS yeniden ölçülebilir; haritada açma ve silme eylemleri görünür kartlarda.
- **Yüksek doğruluklu GPS:** Aktif sürüş kaydında `enableHighAccuracy` kullanılır; GPS yoksa kilometre 0 kalır, tahmin üretilmez.
- **Otomatik park önerisi:** Kullanıcı ayarlardan açarsa, ön plandaki aktif sürüşte yaklaşık üç dakika sabit ve doğruluğu uygun konum algılanır. Uygulama parkı kendiliğinden kesin kayıt yapmaz; kullanıcı **Park olarak kaydet** veya **Yok say** seçer.
- **Dürüst çalışma sınırı:** Uygulama tamamen kapalıyken arka planda gizli GPS takibi yapılmaz. Sürekli arka plan takibi için ayrıca Android foreground service, kalıcı bildirim ve ayrı izin tasarımı gerekir.

## OBD bağlantısı gerçekleştiğinde önerilen katmanlar

### 1. Canlı araç paneli

Sadece adaptör gerçekten bağlı ve PID yanıtı alınmışsa gösterilir:

- Motor devri (RPM)
- Soğutma suyu sıcaklığı
- Akü/şarj voltajı
- Motor yükü
- Gaz kelebeği konumu
- Anlık ve ortalama tüketim için ölçüm temeli
- Yakıt düzeltmeleri (STFT/LTFT), araç destekliyorsa

Her ölçümde **PID adı, son okuma zamanı, birim ve veri kaynağı** gösterilir.

### 2. Arıza kodu merkezi

- DTC kodunu, araçtan dönen ham kodu ve açıklamasını gösterir.
- Kodu silme eylemi varsayılan olarak eklenmez; kullanıcı açıkça isterse ayrıca onaylanır.
- “Acil dur”, “en kısa sürede kontrol”, “izle” gibi seviyeler yalnızca ölçüm/standart eşik kanıtıyla üretilir.
- OBD verisi tıbbi/servis teşhisi gibi kesin sonuç diye sunulmaz; servis kontrolü önerilir.

### 3. Sürüş ve bakım zekâsı

- Hararet, düşük voltaj, anormal rölanti veya tekrarlayan DTC için zaman çizelgesi.
- Gerçek OBD ölçümleriyle bakım geçmişini yan yana gösterme.
- Aynı rota veya benzer sürüşlerde tüketim karşılaştırması.
- Bakım hatırlatıcısını kilometre ve gerçek ölçüm eğilimleriyle destekleme.

### 4. Görsel kart sistemi

- **Durum kartı:** Bağlı / veri bekleniyor / bağlantı kesildi.
- **Renk anlamı:** Turkuaz = normal veri akışı, sarı = izlenmeli, mercan = dikkat/acil.
- **Mini grafikler:** Son 10 dakikanın RPM, voltaj ve sıcaklık çizgisi; veri yoksa boş grafik yerine açık “ölçüm yok” durumu.
- **Kademeli ayrıntı:** Ana ekranda yalnızca kritik özet; karta dokununca detay, birim ve kaynak.

## Değişmez güven kuralları

1. OBD bağlantısı yoksa skor veya “araç sağlığı iyi” sonucu gösterilmez.
2. Eksik PID, eski veri veya uyumsuz araç protokolü açıkça yazılır.
3. Hiçbir grafik için demo/test ölçümü gerçek araç ölçümü gibi kullanılmaz.
4. Arka plan GPS ve OBD taraması kullanıcıya görünür durum, izin ve pil etkisi bilgisiyle açılır.
5. Bir sonraki özellik eklenmeden önce web akışı, Android bridge ve gerçek cihaz sınırı ayrı ayrı doğrulanır.
