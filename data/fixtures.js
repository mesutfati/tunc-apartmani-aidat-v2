export const districts = [
  { name:'Kadıköy', benzin:52.48, motorin:55.12, lpg:27.16 },
  { name:'Ataşehir', benzin:52.56, motorin:55.18, lpg:27.24 },
  { name:'Beşiktaş', benzin:52.62, motorin:55.21, lpg:27.28 },
  { name:'Üsküdar', benzin:52.51, motorin:55.14, lpg:27.18 },
  { name:'Bakırköy', benzin:52.68, motorin:55.29, lpg:27.32 },
  { name:'Şişli', benzin:52.59, motorin:55.19, lpg:27.26 },
  { name:'Sarıyer', benzin:52.72, motorin:55.33, lpg:27.38 },
  { name:'Maltepe', benzin:52.46, motorin:55.09, lpg:27.12 },
  { name:'Pendik', benzin:52.41, motorin:55.04, lpg:27.08 },
  { name:'Avcılar', benzin:52.64, motorin:55.25, lpg:27.30 }
];

export const seedState = {
  view:'home',
  fuelType:'benzin',
  location:{ city:'İstanbul', district:'Kadıköy' },
  favorites:['Kadıköy', 'Beşiktaş'],
  pricesOnlyFavorites:false,
  gps:true,
  notificationTab:'current',
  vehicleTab:'vehicles',
  selectedVehicleId:null,
  vehicles:[],
  user:{ loggedIn:false, name:'', email:'' },
  trips:[
    { id:'trip-demo', title:'Ev → Ofis', date:'Bugün, 08:42', km:12.4, duration:'26 dk', type:'İş', active:false },
    { id:'trip-seed', title:'Kadıköy → Üsküdar', date:'Dün, 19:10', km:8.1, duration:'21 dk', type:'Kişisel', active:false }
  ],
  activeTrip:null,
  parks:[{ id:'park-seed', title:'Rıhtım Otoparkı', date:'Dün, 18:46', note:'İskeleye 3 dk' }],
  accidents:[],
  hgs:[{ id:'hgs-seed', title:'15 Temmuz Şehitler Köprüsü', date:'28 Eyl', amount:47.25 }],
  settings:{ notifications:true, autoBackup:false, motionTracking:false, mileage:28460 },
  notifications:[
    { id:'n1', kind:'down', date:'Bugün · 09:00', text:'Motorin için gece yarısından itibaren litre başına 1,18 ₺ indirim bekleniyor.', seen:false },
    { id:'n2', kind:'info', date:'Dün · 17:20', text:'İstanbul Anadolu Yakası fiyat listesi güncellendi.', seen:true }
  ]
};

export const fuelLabels = { benzin:'Benzin', motorin:'Motorin', lpg:'LPG' };
