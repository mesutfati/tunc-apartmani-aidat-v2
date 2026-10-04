# Sürüş Cepte

Hafif, mobil öncelikli vanilla HTML/CSS/JavaScript sürücü yardımcısı. Yakıt fiyatları, sürüş, park, kaza tutanağı, acil durum, sigorta, bakım ve araç sağlığını tek uygulamada toplar.

## Web önizleme

```bash
npm run dev
```

## Android debug APK

```bash
npm install
npx cap add android
npm run apk:debug
```

Üretilen dosya: `android/app/build/outputs/apk/debug/app-debug.apk`

Gerçek fiyat API’si, OAuth, OCR, arka plan GPS ve bildirimler `services/` altındaki adapter sınırlarıyla sonraki aşamaya ayrılmıştır.
