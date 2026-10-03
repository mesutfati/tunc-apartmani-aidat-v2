export const districts = [
  { name:'Kadıköy' }, { name:'Ataşehir' }, { name:'Beşiktaş' }, { name:'Üsküdar' },
  { name:'Bakırköy' }, { name:'Şişli' }, { name:'Sarıyer' }, { name:'Maltepe' },
  { name:'Pendik' }, { name:'Avcılar' }
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
