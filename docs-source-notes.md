
## APK ve EPDK çalışma notu

- ZIP’in `server.js` yaklaşımındaki GET, form POST ve WSDL SOAP denemeleri `services/early-warning.js` içine taşındı.
- Testte EPDK SOAP 1.1 yanıtı `Sorgu Yetkisi Yok!` döndürdü. Bu, uygulama hatası olarak gizlenmez; erken uyarı ekranında resmi ölçüm yetkisinin bulunmadığı açıkça gösterilir.
- Preview server’ı EPDK resmi ölçümü yoksa seçili yakıt tipini mevcut beşli canlı dağıtıcı ortalamasıyla etiketli fallback olarak sunar. Fallback, resmi EPDK sonucu gibi gösterilmez.
- Capacitor APK’da `/api` sunucusu bulunmadığında erken uyarı modülü doğrudan EPDK/TCMB adapterını ve canlı dağıtıcı fiyat adapterını dener; ağ veya yetki yoksa puan uydurmaz.
