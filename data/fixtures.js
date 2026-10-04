export const districts = [
  { name:'Adalar' }, { name:'Arnavutköy' }, { name:'Ataşehir' }, { name:'Avcılar' }, { name:'Bağcılar' },
  { name:'Bahçelievler' }, { name:'Bakırköy' }, { name:'Başakşehir' }, { name:'Bayrampaşa' }, { name:'Beşiktaş' },
  { name:'Beykoz' }, { name:'Beylikdüzü' }, { name:'Beyoğlu' }, { name:'Büyükçekmece' }, { name:'Çatalca' },
  { name:'Çekmeköy' }, { name:'Esenler' }, { name:'Esenyurt' }, { name:'Eyüpsultan' }, { name:'Fatih' },
  { name:'Gaziosmanpaşa' }, { name:'Güngören' }, { name:'Kadıköy' }, { name:'Kağıthane' }, { name:'Kartal' },
  { name:'Küçükçekmece' }, { name:'Maltepe' }, { name:'Pendik' }, { name:'Sancaktepe' }, { name:'Sarıyer' },
  { name:'Silivri' }, { name:'Sultanbeyli' }, { name:'Sultangazi' }, { name:'Şile' }, { name:'Şişli' },
  { name:'Tuzla' }, { name:'Ümraniye' }, { name:'Üsküdar' }, { name:'Zeytinburnu' },
];

export const seedState = {
  view:'home',
  fuelType:'benzin',
  location:{ city:'İstanbul', district:'Kadıköy' },
  favorites:['Kadıköy', 'Beşiktaş'],
  pricesOnlyFavorites:false,
  gps:true,
  notificationTab:'current',
  priceSnapshots:{},
  vehicleTab:'vehicles',
  selectedVehicleId:null,
  vehicles:[],
  user:{ loggedIn:false, name:'', email:'' },
  trips:[],
  activeTrip:null,
  parks:[],
  accidents:[],
  receipts:[],
  healthSnapshot:null,
  healthReport:null,
  obdDevice:null,
  hgs:[],
  settings:{ notifications:true, autoBackup:false, motionTracking:false, mileage:0 },
  notifications:[]
};

export const fuelLabels = { benzin:'Benzin', motorin:'Motorin', lpg:'LPG' };
