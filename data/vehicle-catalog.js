export const VEHICLE_PROFILES = [
  {
    id:'toyota-corolla-sedan-petrol-2026',
    brand:'Toyota',
    model:'Corolla Sedan',
    variant:'1.5L Benzinli Multidrive S',
    fuel:'Benzin',
    tank:50,
    consumption:6.1,
    engine:'1.5L · 125 HP · CVT',
    details:['WLTP birleşik tüketim: 6,1–6,3 L/100 km','Yakıt deposu: 50 L','Toyota Safety Sense 3'],
    sourceLabel:'Toyota Türkiye Corolla teknik özellikleri',
    sourceUrl:'https://www.toyota.com.tr/araba-modelleri/corolla-sedan/ozellikler'
  },
  {
    id:'toyota-corolla-sedan-hybrid-2026',
    brand:'Toyota',
    model:'Corolla Sedan Hybrid',
    variant:'1.8L Hybrid e-CVT',
    fuel:'Hibrit',
    tank:43,
    consumption:4.5,
    engine:'1.8L Hybrid · 140 HP · e-CVT',
    details:['WLTP birleşik tüketim: 4,5–4,7 L/100 km','Yakıt deposu: 43 L','Benzinli hibrit sistem'],
    sourceLabel:'Toyota Türkiye Corolla teknik ve donanım özellikleri (Ocak 2026)',
    sourceUrl:'https://www.toyota.com.tr/content/dam/toyota/nmsc/turkey/cars/e-brosur/corolla/Corolla-Teknik-ve-Donanim-Ozellikleri-01-2026.pdf'
  },
  {
    id:'toyota-corolla-cross-hybrid-2026',
    brand:'Toyota',
    model:'Corolla Cross Hybrid',
    variant:'1.8L Hybrid e-CVT · 4x2',
    fuel:'Hibrit',
    tank:36,
    consumption:5.0,
    engine:'1.8L Hybrid · 140 HP · e-CVT',
    details:['WLTP birleşik tüketim: 5,0–5,1 L/100 km','Yakıt deposu: 36 L','Benzinli hibrit sistem'],
    sourceLabel:'Toyota Türkiye Corolla Cross Hybrid teknik ve donanım özellikleri (Nisan 2026)',
    sourceUrl:'https://www.toyota.com.tr/content/dam/toyota/nmsc/turkey/cars/e-brosur/corolla-cross/TOYOTA_CorollaCross_TeknikDonanim_2026_HR-1.pdf'
  }
];

export const MANUAL_VEHICLE_PROFILE = {
  id:'manual', brand:'', model:'', variant:'', fuel:'Benzin', tank:50, consumption:null, engine:'', details:[], sourceLabel:'Kullanıcı girişi', sourceUrl:''
};

export function vehicleProfileById(id) {
  return VEHICLE_PROFILES.find(profile => profile.id === id) || MANUAL_VEHICLE_PROFILE;
}

export function vehicleFuelKey(fuel) {
  const value = String(fuel || '').toLocaleLowerCase('tr-TR');
  if (value.includes('motor')) return 'motorin';
  if (value.includes('lpg')) return 'lpg';
  return 'benzin';
}
