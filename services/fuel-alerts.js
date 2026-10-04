export const FUEL_ALERT_SOURCES = [
  {
    id: 'puis',
    name: 'PÜİS duyuruları',
    url: 'https://www.puis.org.tr/tum-haberler',
    level: 'Sektör duyurusu',
    signal: 'Beklenti veya sektör açıklaması',
    note: 'PÜİS açıklaması erken sinyal olabilir; tutar ve yürürlük tarihi kesinleşmeden kesin fiyat kabul edilmez.',
  },
  {
    id: 'epgis',
    name: 'EPGİS haberleri',
    url: 'https://epgis.org.tr/haberler',
    level: 'Sektör duyurusu',
    signal: 'Beklenti veya sektör açıklaması',
    note: 'Sektör açıklaması olarak takip edilir; uygulama bunu resmi pompa fiyatı olarak göstermez.',
  },
  {
    id: 'epdk-alerts',
    name: 'EPDK duyuruları ve akaryakıt fiyatları',
    url: 'https://www.epdk.gov.tr/Detay/Icerik/3-0-158/akaryak%C4%B1tfiyat',
    level: 'Resmi kurum',
    signal: 'Kesinleşmiş düzenleme veya bayi fiyatı referansı',
    note: 'Vergi, düzenleme ve resmi fiyat referansı için birincil doğrulama noktasıdır.',
  },
  {
    id: 'resmi-gazete',
    name: 'Resmî Gazete',
    url: 'https://www.resmigazete.gov.tr/',
    level: 'Resmi kayıt',
    signal: 'Yürürlüğe giren karar ve vergi değişikliği',
    note: 'Bir değişikliğin hukuken yürürlüğe girip girmediğini kontrol etmek için kullanılır.',
  },
  {
    id: 'sector-news',
    name: 'Ekonomi basını (ikincil doğrulama)',
    url: 'https://www.ekonomim.com/ekonomi/akaryakit',
    level: 'İkincil kaynak',
    signal: 'Sektör kaynaklı beklenti haberi',
    note: 'Tek başına bildirim üretmez; PÜİS/EPDK/Resmî Gazete ile eşleşirse kullanıcıya gösterilir.',
  },
];

export const alertPolicy = {
  futureNotice: 'Beklenti',
  confirmedNotice: 'Doğrulandı',
  rule: 'Gelecek fiyat değişikliği yalnızca kaynağın yayımladığı tarih, ürün ve tutar açıkça görüldüğünde “beklenti” etiketiyle gösterilir. Resmi veya en az iki bağımsız canlı kaynak doğrulaması yoksa kesin zam/indirim denmez.',
};
